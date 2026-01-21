/**
 * Stripe Product Configuration
 *
 * These IDs should be set in environment variables after creating
 * the products in your Stripe dashboard.
 *
 * Products to create in Stripe:
 *
 * SUBSCRIPTIONS:
 * - Premium Monthly: $4.99/month
 * - Premium Annual: $49.99/year (save ~17%)
 * - Max Monthly: $9.99/month
 * - Max Annual: $99.99/year (save ~17%)
 *
 * ONE-TIME PURCHASES:
 * - Team Slot: $2.99
 * - Match Pack 3: $1.49
 * - Match Pack 5: $1.99
 * - Match Pack 10: $2.99
 *
 * BUNDLES:
 * - Starter Pack (1 team + 5 matches): $3.99 (~15% off)
 * - Season Pack (2 teams + 10 matches): $7.99 (~20% off)
 */

export const STRIPE_PRODUCTS = {
  // Subscriptions
  PREMIUM_MONTHLY: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || "",
  PREMIUM_ANNUAL: process.env.STRIPE_PRICE_PREMIUM_ANNUAL || "",
  MAX_MONTHLY: process.env.STRIPE_PRICE_MAX_MONTHLY || "",
  MAX_ANNUAL: process.env.STRIPE_PRICE_MAX_ANNUAL || "",

  // One-time purchases
  TEAM_SLOT: process.env.STRIPE_PRICE_TEAM_SLOT || "",
  MATCH_PACK_3: process.env.STRIPE_PRICE_MATCH_PACK_3 || "",
  MATCH_PACK_5: process.env.STRIPE_PRICE_MATCH_PACK_5 || "",
  MATCH_PACK_10: process.env.STRIPE_PRICE_MATCH_PACK_10 || "",

  // Bundles
  STARTER_PACK: process.env.STRIPE_PRICE_STARTER_PACK || "",
  SEASON_PACK: process.env.STRIPE_PRICE_SEASON_PACK || "",
} as const;

export type StripeProductKey = keyof typeof STRIPE_PRODUCTS;

/**
 * Product metadata for display purposes
 */
export const PRODUCT_INFO = {
  PREMIUM_MONTHLY: {
    name: "Premium Monthly",
    description: "2 teams, unlimited matches",
    tier: "premium" as const,
    price: "$4.99",
    interval: "month",
    type: "subscription" as const,
  },
  PREMIUM_ANNUAL: {
    name: "Premium Annual",
    description: "2 teams, unlimited matches (save ~17%)",
    tier: "premium" as const,
    price: "$49.99",
    interval: "year",
    type: "subscription" as const,
  },
  MAX_MONTHLY: {
    name: "Max Monthly",
    description: "Unlimited teams and matches",
    tier: "max" as const,
    price: "$9.99",
    interval: "month",
    type: "subscription" as const,
  },
  MAX_ANNUAL: {
    name: "Max Annual",
    description: "Unlimited teams and matches (save ~17%)",
    tier: "max" as const,
    price: "$99.99",
    interval: "year",
    type: "subscription" as const,
  },
  TEAM_SLOT: {
    name: "Team Slot",
    description: "Add 1 additional team slot (never expires)",
    price: "$2.99",
    type: "one-time" as const,
    entitlementType: "team_slot" as const,
    quantity: 1,
  },
  MATCH_PACK_3: {
    name: "Match Pack (3)",
    description: "3 additional matches (never expire)",
    price: "$1.49",
    type: "one-time" as const,
    entitlementType: "match_pack" as const,
    quantity: 3,
  },
  MATCH_PACK_5: {
    name: "Match Pack (5)",
    description: "5 additional matches (never expire)",
    price: "$1.99",
    type: "one-time" as const,
    entitlementType: "match_pack" as const,
    quantity: 5,
  },
  MATCH_PACK_10: {
    name: "Match Pack (10)",
    description: "10 additional matches (never expire)",
    price: "$2.99",
    type: "one-time" as const,
    entitlementType: "match_pack" as const,
    quantity: 10,
  },
  STARTER_PACK: {
    name: "Starter Pack",
    description: "1 team slot + 5 matches (~15% off)",
    price: "$3.99",
    type: "bundle" as const,
    items: [
      { type: "team_slot" as const, quantity: 1 },
      { type: "match_pack" as const, quantity: 5 },
    ],
  },
  SEASON_PACK: {
    name: "Season Pack",
    description: "2 team slots + 10 matches (~20% off)",
    price: "$7.99",
    type: "bundle" as const,
    items: [
      { type: "team_slot" as const, quantity: 2 },
      { type: "match_pack" as const, quantity: 10 },
    ],
  },
} as const;

/**
 * Map product URL parameter to Stripe price ID
 */
export function getProductPriceId(productParam: string): string | null {
  const productMap: Record<string, StripeProductKey> = {
    "premium-monthly": "PREMIUM_MONTHLY",
    "premium-annual": "PREMIUM_ANNUAL",
    "max-monthly": "MAX_MONTHLY",
    "max-annual": "MAX_ANNUAL",
    "team-slot": "TEAM_SLOT",
    "match-pack-3": "MATCH_PACK_3",
    "match-pack-5": "MATCH_PACK_5",
    "match-pack-10": "MATCH_PACK_10",
    "starter-pack": "STARTER_PACK",
    "season-pack": "SEASON_PACK",
  };

  const key = productMap[productParam];
  return key ? STRIPE_PRODUCTS[key] : null;
}

/**
 * Get tier from Stripe price ID
 */
export function getTierFromPriceId(priceId: string): "premium" | "max" | null {
  if (
    priceId === STRIPE_PRODUCTS.PREMIUM_MONTHLY ||
    priceId === STRIPE_PRODUCTS.PREMIUM_ANNUAL
  ) {
    return "premium";
  }
  if (
    priceId === STRIPE_PRODUCTS.MAX_MONTHLY ||
    priceId === STRIPE_PRODUCTS.MAX_ANNUAL
  ) {
    return "max";
  }
  return null;
}
