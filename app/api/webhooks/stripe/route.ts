import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { getTierFromPriceId, PRODUCT_INFO, STRIPE_PRODUCTS } from "@/lib/stripe/products";
import { createSubscriptionApi } from "@/lib/api/subscriptions";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Create a Supabase client with service role for webhook handling
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const subscriptionApi = createSubscriptionApi(supabase as any);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const customerId = session.customer as string;

  if (!userId) {
    console.error("No user_id in checkout session metadata");
    return;
  }

  // Set Stripe customer ID for user
  await subscriptionApi.setStripeCustomerId(userId, customerId);

  // Handle subscription checkout
  if (session.mode === "subscription" && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    await handleSubscriptionUpdate(subscription);
  }

  // Handle one-time purchase
  if (session.mode === "payment") {
    const productKey = session.metadata?.product_key;

    if (productKey && productKey in PRODUCT_INFO) {
      const productInfo = PRODUCT_INFO[productKey as keyof typeof PRODUCT_INFO];

      if (productInfo.type === "one-time" && "entitlementType" in productInfo) {
        // Create entitlement for one-time purchase
        await subscriptionApi.createEntitlement({
          user_id: userId,
          type: productInfo.entitlementType,
          quantity: productInfo.quantity,
          quantity_used: 0,
          status: "active",
          stripe_payment_intent_id: session.payment_intent as string,
        });
      } else if (productInfo.type === "bundle" && "items" in productInfo) {
        // Create entitlements for each bundle item
        for (const item of productInfo.items) {
          await subscriptionApi.createEntitlement({
            user_id: userId,
            type: item.type,
            quantity: item.quantity,
            quantity_used: 0,
            status: "active",
            stripe_payment_intent_id: session.payment_intent as string,
          });
        }
      }
    }
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Get user ID from customer metadata or lookup
  const customer = await stripe.customers.retrieve(customerId);
  const userId = (customer as Stripe.Customer).metadata?.user_id;

  if (!userId) {
    console.error("No user_id found for customer:", customerId);
    return;
  }

  // Get the price ID from the subscription
  const priceId = subscription.items.data[0]?.price.id;
  const tier = getTierFromPriceId(priceId);

  if (!tier) {
    console.error("Unknown price ID:", priceId);
    return;
  }

  // Map Stripe subscription status to our status
  const statusMap: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "past_due",
    incomplete: "active", // Still allow access during payment processing
    incomplete_expired: "expired",
  };

  const status = statusMap[subscription.status] || "active";

  // Update subscription
  // Note: Type assertions needed for Stripe subscription properties
  const subAny = subscription as any;
  await subscriptionApi.updateSubscription(userId, {
    tier,
    status: status as any,
    stripe_subscription_id: subscription.id,
    current_period_start: new Date(
      subAny.current_period_start * 1000
    ).toISOString(),
    current_period_end: new Date(
      subAny.current_period_end * 1000
    ).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    // Clear trial fields if subscription is now active
    ...(subscription.status === "active" && {
      trial_start: null,
      trial_end: null,
    }),
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Get user ID from customer
  const customer = await stripe.customers.retrieve(customerId);
  const userId = (customer as Stripe.Customer).metadata?.user_id;

  if (!userId) {
    console.error("No user_id found for customer:", customerId);
    return;
  }

  // Downgrade to free tier
  await subscriptionApi.updateSubscription(userId, {
    tier: "free",
    status: "active",
    stripe_subscription_id: null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
  });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Payment successful - subscription should already be updated via subscription.updated event
  console.log("Payment succeeded for invoice:", invoice.id);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string;

  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = subscription.customer as string;
  const customer = await stripe.customers.retrieve(customerId);
  const userId = (customer as Stripe.Customer).metadata?.user_id;

  if (!userId) {
    console.error("No user_id found for customer:", customerId);
    return;
  }

  // Mark subscription as past_due
  await subscriptionApi.updateSubscription(userId, {
    status: "past_due",
  });
}
