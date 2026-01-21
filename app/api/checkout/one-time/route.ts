import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { getProductPriceId, PRODUCT_INFO } from "@/lib/stripe/products";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { priceId, productKey } = await request.json();

    // Resolve price ID from product key if provided
    const resolvedPriceId = productKey
      ? getProductPriceId(productKey)
      : priceId;

    if (!resolvedPriceId) {
      return NextResponse.json(
        { error: "Invalid product or price" },
        { status: 400 }
      );
    }

    // Verify this is a one-time purchase product
    if (productKey && productKey in PRODUCT_INFO) {
      const productInfo = PRODUCT_INFO[productKey as keyof typeof PRODUCT_INFO];
      if (productInfo.type === "subscription") {
        return NextResponse.json(
          { error: "Use /api/checkout/subscription for subscriptions" },
          { status: 400 }
        );
      }
    }

    // Check if user already has a Stripe customer ID
    // Note: Type assertion needed until database types are regenerated after migration
    const { data: subscription } = await (supabase as any)
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    let customerId = (subscription as { stripe_customer_id: string | null } | null)?.stripe_customer_id;

    // Create a new customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      });
      customerId = customer.id;
    }

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: resolvedPriceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?purchase=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/upgrade?canceled=true`,
      metadata: {
        user_id: user.id,
        product_key: productKey || "",
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
