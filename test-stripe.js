require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function checkPrices() {
  try {
    const pro = await stripe.prices.retrieve(process.env.STRIPE_PRICE_PRO);
    console.log("Pro price exists in this mode!");
  } catch (e) {
    console.log("Pro price error:", e.message);
  }
  
  try {
    const essencial = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ESSENCIAL);
    console.log("Essencial price exists in this mode!");
  } catch (e) {
    console.log("Essencial price error:", e.message);
  }
}

checkPrices();
