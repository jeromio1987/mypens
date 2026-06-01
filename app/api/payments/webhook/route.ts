import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function upsertTier(tier: 'free' | 'premium', stripeCustomerId?: string) {
  await prisma.userSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', tier, ...(stripeCustomerId ? { stripeCustomerId } : {}) },
    update: { tier, ...(stripeCustomerId ? { stripeCustomerId } : {}) },
  })
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature') ?? ''

  let event: ReturnType<typeof stripe.webhooks.constructEvent>
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const customerId = typeof session.customer === 'string' ? session.customer : undefined
      await upsertTier('premium', customerId)
      break
    }
    case 'customer.subscription.deleted':
    case 'invoice.payment_failed':
      await upsertTier('free')
      break
  }

  return NextResponse.json({ received: true })
}
