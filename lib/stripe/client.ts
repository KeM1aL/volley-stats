import Stripe from "stripe";

// Lazy initialization to avoid build-time errors when env vars aren't available
let _stripe: Stripe | null = null;

// Server-side Stripe client - lazily initialized
export const getStripe = (): Stripe => {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(secretKey, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });
  }
  return _stripe;
};

// For backwards compatibility - will throw at runtime if key not available
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as any)[prop];
  },
});

// Get the Stripe publishable key for client-side use
export const getStripePublishableKey = () => {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
};
