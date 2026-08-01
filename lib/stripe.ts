import Stripe from 'stripe'

let _stripe: Stripe | null = null

/** Lazy Stripe client — avoids build-time crash when STRIPE_SECRET_KEY is unset. */
export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  _stripe = new Stripe(key, {
    apiVersion: '2026-04-22.dahlia',
  })
  return _stripe
}

/** Back-compat: same surface as before, constructed on first property access. */
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripe()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
