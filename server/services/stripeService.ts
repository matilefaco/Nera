import Stripe from 'stripe';

let stripeInstance: any = null;

export function getStripe(): any {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
    // @ts-ignore
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}
