import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe, PRICE_IDS } from '@/lib/stripe';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan } = await req.json();

    if (plan !== 'PRO' && plan !== 'TEAM') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS];
    if (!priceId) {
      return NextResponse.json({ error: `Price ID not configured for ${plan}. PRO=${process.env.STRIPE_PRO_PRICE_ID ? 'set' : 'MISSING'}, TEAM=${process.env.STRIPE_TEAM_PRICE_ID ? 'set' : 'MISSING'}, SK=${process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.substring(0, 10) + '...' : 'MISSING'}` }, { status: 500 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, stripeCustomerId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { userId: session.user.id },
        });
        customerId = customer.id;
        await db.user.update({
          where: { id: session.user.id },
          data: { stripeCustomerId: customerId },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Stripe customer create error:', message);
        return NextResponse.json({ error: `Failed to create Stripe customer: ${message}` }, { status: 500 });
      }
    }

    // Create checkout session
    try {
      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.NEXTAUTH_URL || 'https://pr-triage-web.vercel.app'}/settings?upgraded=true`,
        cancel_url: `${process.env.NEXTAUTH_URL || 'https://pr-triage-web.vercel.app'}/settings`,
        metadata: { userId: session.user.id, plan },
      });

      return NextResponse.json({ url: checkoutSession.url });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Stripe checkout session error:', message);
      return NextResponse.json({ error: `Stripe checkout failed: ${message}` }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Checkout route error:', message);
    return NextResponse.json({ error: `Checkout error: ${message}` }, { status: 500 });
  }
}
