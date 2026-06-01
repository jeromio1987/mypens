import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const settings = await prisma.userSettings.findUnique({ where: { id: 'default' } })
    const customerId = settings?.stripeCustomerId
    if (!customerId) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 404 })
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/upgrade`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
