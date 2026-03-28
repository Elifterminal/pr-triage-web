import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY.trim(), {
      apiVersion: '2026-03-25.dahlia',
      typescript: true,
      maxNetworkRetries: 3,
      timeout: 30000,
    });
  }
  return _stripe;
}

// Re-export as `stripe` for convenience — lazy initialized
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Price IDs — set these in env after creating products in Stripe Dashboard
export const PRICE_IDS = {
  PRO: process.env.STRIPE_PRO_PRICE_ID!,
  TEAM: process.env.STRIPE_TEAM_PRICE_ID!,
} as const;

export const PLAN_FROM_PRICE: Record<string, string> = {};

// Build reverse lookup at runtime (only when price IDs are configured)
if (process.env.STRIPE_PRO_PRICE_ID) {
  PLAN_FROM_PRICE[process.env.STRIPE_PRO_PRICE_ID] = 'PRO';
}
if (process.env.STRIPE_TEAM_PRICE_ID) {
  PLAN_FROM_PRICE[process.env.STRIPE_TEAM_PRICE_ID] = 'TEAM';
}
