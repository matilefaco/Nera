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
      apiVersion: "2023-10-16" as any,
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
    console.log("[CHECKOUT DEBUG] plan:", plan);
    console.log("[CHECKOUT DEBUG] professionalId exists:", !!professionalId);
    console.log("[CHECKOUT DEBUG] email exists:", !!email);
    console.log("[CHECKOUT DEBUG] STRIPE_SECRET_KEY exists:", !!process.env.STRIPE_SECRET_KEY);
    console.log("[CHECKOUT DEBUG] STRIPE_SECRET_KEY mode:", process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ? "test" : process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : "invalid");
    console.log("[CHECKOUT DEBUG] STRIPE_PRICE_ESSENCIAL exists:", !!process.env.STRIPE_PRICE_ESSENCIAL);
    console.log("[CHECKOUT DEBUG] STRIPE_PRICE_PRO exists:", !!process.env.STRIPE_PRICE_PRO);
    
    const priceId = plan === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_ESSENCIAL;
    console.log("[CHECKOUT DEBUG] selected priceId exists:", !!priceId);
    console.log("[CHECKOUT DEBUG] selected priceId prefix valid:", priceId?.startsWith("price_"));

    if (!priceId) {
      console.error("[CHECKOUT ERROR] Price ID missing for plan:", plan);
      return res.status(400).json({ error: `O plano ${plan} não está configurado corretamente (Price ID ausente). Por favor, contate o suporte.` });
    }

    // Check for credits before creating session params
    const userDoc = await db.collection("users").doc(professionalId).get();
    const credits = userDoc.data()?.credits || 0;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
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
      success_url: `${process.env.APP_URL}/checkout/success`,
      cancel_url: `${process.env.APP_URL}/checkout/canceled`,
      metadata: {
        professionalId,
        plan,
        creditsUsed: credits >= 10 ? 'true' : 'false'
      },
    };

    if (credits >= 10) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.floor(credits * 100),
        currency: "brl",
        duration: "once",
        name: `Crédito de indicação Nera (R$${credits})`
      });
      sessionParams.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({ checkoutUrl: session.url });
  } catch (err: any) {
    console.error("[STRIPE CHECKOUT ERROR]", err.message);
    res.status(500).json({ 
      error: "Failed to create checkout session",
      details: err.message
    });
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
    const plan = session.metadata?.plan || 'pro'; 

    console.log(`[STRIPE WEBHOOK] Processing checkout.session.completed: session_id=${session.id}, userId=${userId}, plan=${plan}`);

    if (!userId) {
      console.warn('[STRIPE WEBHOOK ERROR] Missing client_reference_id in session');
      return res.status(400).json({ error: 'Missing client_reference_id' });
    }

    if (!session.subscription) {
      console.error("[STRIPE WEBHOOK ERROR] Missing subscription in checkout session id:", session.id);
      return res.status(400).json({ error: "Missing subscription" });
    }

    try {
      const stripe = getStripe(); 
      console.log(`[STRIPE WEBHOOK] Fetching subscription details for: ${session.subscription}`);
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;
      const planExpiresAt = new Date(subscription.current_period_end * 1000).toISOString();
      console.log(`[STRIPE WEBHOOK] Subscription period end: ${planExpiresAt}`);

      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        console.warn(`[STRIPE WEBHOOK ERROR] User ${userId} not found in Firestore during checkout.session.completed`);
        return res.status(404).json({ error: 'User not found' });
      }

      console.log(`[STRIPE WEBHOOK] Found user: ${userDoc.data()?.email}. Updating plan to ${plan}...`);

      const userData = userDoc.data();
      const referredBy = userData?.referredBy;
      const creditsUsed = session.metadata?.creditsUsed === 'true';

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
      const updateData: any = {
        plan: plan,
        indexable: true,
        planRank: plan === 'pro' ? 2 : 1,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        planExpiresAt: planExpiresAt,
        updatedAt: new Date().toISOString()
      };

      if (creditsUsed) {
        updateData.credits = 0;
        console.log(`[STRIPE WEBHOOK] Reset credits for user ${userId}`);
      }

      await userRef.update(updateData);

      console.log(`[STRIPE WEBHOOK SUCCESS] User ${userId} (${userData?.email}) successfully upgraded to ${plan} until ${planExpiresAt}`);

    } catch (err: any) {
      console.error('[STRIPE WEBHOOK ERROR] Error processing checkout.session.completed:', err.message);
      return res.status(500).json({ error: 'Internal processing error' });
    }
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as any;
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;

    console.log(`[STRIPE WEBHOOK] Received invoice.paid for customer ${customerId}`);

    if (!subscriptionId || !customerId) {
      console.error('[STRIPE WEBHOOK ERROR] Missing critical data in invoice.paid event');
      return res.status(400).json({ error: 'Missing critical data' });
    }

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId as string) as any;
      const newExpiry = new Date(subscription.current_period_end * 1000);

      const usersSnap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
      
      if (!usersSnap.empty) {
        await usersSnap.docs[0].ref.update({
          planExpiresAt: newExpiry.toISOString(),
          updatedAt: new Date().toISOString()
        });
        console.log(`[STRIPE WEBHOOK SUCCESS] Plan renewed for customer ${customerId} until ${newExpiry.toISOString()}`);
      } else {
        console.warn(`[STRIPE WEBHOOK] User with stripeCustomerId ${customerId} not found for renewal`);
      }
    } catch (err: any) {
      console.error('[STRIPE WEBHOOK ERROR] Critical error processing invoice.paid:', err.message);
      return res.status(500).json({ error: 'Internal error updating renewal' });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer;

    console.log(`[STRIPE WEBHOOK] Received customer.subscription.deleted for customer ${customerId}`);

    try {
      const usersSnap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
      if (!usersSnap.empty) {
        const userDoc = usersSnap.docs[0];
        await userDoc.ref.update({
          plan: 'free',
          planRank: 0,
          indexable: false,
          planExpiresAt: null,
          stripeSubscriptionId: null,
          updatedAt: new Date().toISOString()
        });
        console.log(`[STRIPE WEBHOOK SUCCESS] Subscription deleted for customer ${customerId}, plan reset to free`);
      } else {
        console.warn(`[STRIPE WEBHOOK] User with stripeCustomerId ${customerId} not found for deletion`);
      }
    } catch (err: any) {
      console.error('[STRIPE WEBHOOK ERROR] Error deleting subscription:', err.message);
      return res.status(500).json({ error: 'Internal error processing deletion' });
    }
  }

  res.json({ received: true });
});

// Helper for status
router.get("/status", async (req, res) => {
  res.json({ message: "Plan routes active" });
});

export default router;
