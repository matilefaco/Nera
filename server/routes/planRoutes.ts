import express from "express";
import admin from "firebase-admin";
import { db } from "../firebaseAdmin.ts";
import { sendReferralRewardEmail } from "../emails/sendEmail.ts";
import Stripe from "stripe";

const router = express.Router();

let stripeModule: Stripe | null = null;

function getStripe() {
  if (!stripeModule) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is missing in environment");
    }
    stripeModule = new Stripe(key, {
      apiVersion: "2025-01-27" as any,
    });
  }
  return stripeModule;
}

/**
 * CREATE CHECKOUT SESSION
 */
router.post("/create-checkout", async (req, res) => {
  const { plan, professionalId, email } = req.body;

  if (!plan || !professionalId || !email) {
    return res.status(400).json({ error: "Missing required fields: plan, professionalId, email" });
  }

  try {
    const stripe = getStripe();
    const priceId = plan === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_ESSENCIAL;

    if (!priceId) {
      return res.status(400).json({ error: `Price ID for plan ${plan} not configured` });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      customer_email: email,
      client_reference_id: professionalId,
      success_url: `${process.env.APP_URL}/planos?success=true`,
      cancel_url: `${process.env.APP_URL}/planos?canceled=true`,
      metadata: {
        professionalId,
        plan,
      },
    });

    res.json({ checkoutUrl: session.url });
  } catch (err: any) {
    console.error("[STRIPE CHECKOUT ERROR]", err.message);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

/**
 * STRIPE WEBHOOK
 */
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // Fallback for dev without signature validation if desired, but better to be strict
      event = JSON.parse(req.body.toString());
    }
  } catch (err: any) {
    console.error(`[STRIPE WEBHOOK ERROR] Verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[STRIPE WEBHOOK] Received event: ${event.type}`);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;
    const plan = session.metadata?.plan || 'pro'; // fallback or extracted from line items

    if (!userId) {
      console.warn('[STRIPE WEBHOOK] Missing client_reference_id in session');
      return res.status(400).json({ error: 'Missing client_reference_id' });
    }

    try {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        console.warn(`[STRIPE WEBHOOK] User not found: ${userId}`);
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = userDoc.data();
      const referredBy = userData?.referredBy;

      // Handle Referral Reward (10 BRL)
      if (referredBy) {
        console.log(`[REFERRAL] Processing reward for user ${userId} referred by ${referredBy}`);
        const referrerQuery = await db.collection('users').where('referralCode', '==', referredBy).limit(1).get();
        
        if (!referrerQuery.empty) {
          const referrerDoc = referrerQuery.docs[0];
          const referrerData = referrerDoc.data();
          const referrerId = referrerDoc.id;

          await db.collection('users').doc(referrerId).update({
            credits: admin.firestore.FieldValue.increment(10)
          });

          if (referrerData?.email) {
            await sendReferralRewardEmail({
              referrerEmail: referrerData.email,
              referrerName: referrerData.name || 'Parceira Nera',
              refereeName: userData?.name || 'Uma nova indicação',
              amount: 10
            });
          }
        }
      }

      // Update User Plan
      await userRef.update({
        plan: plan,
        indexable: true,
        planRank: plan === 'pro' ? 2 : 1,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        planExpiresAt: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString(), // ~1 month
        updatedAt: new Date().toISOString()
      });

      console.log(`[STRIPE WEBHOOK] User ${userId} upgraded to ${plan}`);

    } catch (err: any) {
      console.error('[STRIPE WEBHOOK ERROR] Error processing event:', err.message);
      return res.status(500).json({ error: 'Internal processing error' });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer;

    try {
      const usersSnap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
      if (!usersSnap.empty) {
        const userDoc = usersSnap.docs[0];
        await userDoc.ref.update({
          plan: 'free',
          updatedAt: new Date().toISOString()
        });
        console.log(`[STRIPE WEBHOOK] Subscription deleted for customer ${customerId}, reverted to free plan`);
      }
    } catch (err: any) {
      console.error('[STRIPE WEBHOOK ERROR] Error deleting subscription:', err.message);
    }
  }

  res.json({ received: true });
});

// Helper for status
router.get("/status", async (req, res) => {
  res.json({ message: "Plan routes active" });
});

export default router;
