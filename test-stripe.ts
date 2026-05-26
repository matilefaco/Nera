import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16' as any
});

async function checkPrices() {
  try {
    const pro = await stripe.prices.retrieve(process.env.STRIPE_PRICE_PRO as string);
    console.log("Pro price exists in this mode!");
  } catch (e: any) {
    console.log("Pro price error:", e.message);
  }
  
  try {
    const essencial = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ESSENCIAL as string);
    console.log("Essencial price exists in this mode!");
  } catch (e: any) {
    console.log("Essencial price error:", e.message);
  }
}

checkPrices();
