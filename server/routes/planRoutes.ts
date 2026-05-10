import express from "express";
import admin from "firebase-admin";
import { getDb } from "../firebaseAdmin.js";
import { sendReferralRewardEmail, sendTrialWillEndEmail } from "../emails/sendEmail.js";
import Stripe from "stripe";
import { logger, maskToken, maskUid } from "../utils/logger.js";
import { requireFirebaseAuth, AuthenticatedRequest } from "../middleware/authMiddleware.js";

const router = express.Router();

const isDev = process.env.NODE_ENV !== "production";

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
router.post("/create-checkout", requireFirebaseAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  const db = getDb();
  const { plan } = req.body;
  const uid = req.uid; // guaranteed by requireFirebaseAuth

  if (!plan) {
    return res.status(400).json({ error: "Missing required field: plan" });
  }

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userDoc.data();
    const email = userData?.email;

    if (!email) {
       return res.status(400).json({ error: "User email not found" });
    }

    const stripe = getStripe();
    if (isDev) {
      logger.info("STRIPE", "Initiating checkout session", { professionalId: maskUid(uid), meta: { plan } });
    }
    
    const priceId = plan === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_ESSENCIAL;

    if (!priceId) {
      logger.error("STRIPE", "Price ID not configured. Check environment variables.");
      return res.status(400).json({ error: `O plano ${plan} não está configurado corretamente (Price ID ausente). Por favor, contate o suporte.` });
    }

    // Check for credits before creating session params
    const credits = userData?.credits || 0;

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
      client_reference_id: uid,
      subscription_data: {
        trial_period_days: 15,
        trial_settings: {
          end_behavior: {
            missing_payment_method: "cancel"
          }
        }
      },
      payment_method_collection: "if_required",
      success_url: `${process.env.APP_URL}/checkout/success`,
      cancel_url: `${process.env.APP_URL}/checkout/canceled`,
      metadata: {
        professionalId: uid,
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
    logger.error("STRIPE", "Failed to create checkout session", { requestId: req.requestId, error: err });
    res.status(500).json({ 
      error: "Failed to create checkout session",
      details: err.message
    });
  }
});

/**
 * STRIPE WEBHOOK
 */
router.post("/webhook", async (req, res) => {
  const db = getDb();
  const stripe = getStripe();
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  if (!webhookSecret || !sig) {
    logger.error("STRIPE", "Missing webhookSecret or signature", { requestId: req.requestId });
    return res.status(400).send('Webhook Error: Missing verification details');
  }

  // Use req.rawBody in Firebase Functions, otherwise req.body from express.raw()
  const payload = (req as any).rawBody || req.body;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err: any) {
    logger.error("STRIPE", "Verification failed", { requestId: req.requestId, error: err });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  logger.info("STRIPE", "Received webhook event", { requestId: req.requestId, meta: { eventType: event.type } });

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;
    const plan = session.metadata?.plan || 'pro'; 

    if (isDev) {
      logger.info("STRIPE", "Processing checkout.session.completed", { professionalId: maskUid(userId!), meta: { plan } });
    }

    if (!userId) {
      logger.warn("STRIPE", "Missing client_reference_id in session", { requestId: req.requestId });
      return res.status(400).json({ error: 'Missing client_reference_id' });
    }

    if (!session.subscription) {
      logger.error("STRIPE", "Missing subscription in checkout session", { requestId: req.requestId, meta: { sessionId: maskToken(session.id) } });
      return res.status(400).json({ error: "Missing subscription" });
    }

    try {
      const stripe = getStripe(); 
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;
      const planExpiresAt = new Date(subscription.current_period_end * 1000).toISOString();

      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        logger.warn("STRIPE", "User context not found during checkout completion", { professionalId: maskUid(userId) });
        return res.status(404).json({ error: 'User not found' });
      }

      if (isDev) {
        logger.info("STRIPE", "Updating plan for user", { professionalId: maskUid(userId), meta: { plan } });
      }

      const userData = userDoc.data();
      const referredBy = userData?.referredBy;
      const creditsUsed = session.metadata?.creditsUsed === 'true';

      // Handle Referral Reward (10 BRL)
      if (referredBy) {
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
      }

      await userRef.update(updateData);

      logger.info("STRIPE", "User successfully upgraded", { professionalId: maskUid(userId), meta: { plan } });

    } catch (err: any) {
      logger.error("STRIPE", "Error processing checkout.session.completed", { requestId: req.requestId, professionalId: maskUid(userId), error: err });
      return res.status(500).json({ error: 'Internal processing error' });
    }
  }

  if (event.type === 'customer.subscription.trial_will_end') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    if (isDev) {
      logger.info("STRIPE", "Trial strictly ending soon", { meta: { customerId: maskToken(customerId) }});
    }

    try {
      const usersSnap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
      if (!usersSnap.empty) {
        const userDoc = usersSnap.docs[0];
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Log the event
        await db.collection('billing_logs').add({
          userId,
          stripeCustomerId: customerId,
          type: 'trial_will_end',
          subscriptionId: subscription.id,
          createdAt: new Date().toISOString()
        });

        // Send Email if available
        if (userData?.email) {
          await sendTrialWillEndEmail({
            email: userData.email,
            name: userData.name || 'Parceira Nera',
            trialEndAt: new Date(subscription.trial_end! * 1000).toISOString()
          });
          logger.info("STRIPE", "Trial warning email sent", { professionalId: maskUid(userId) });
        }
      }
    } catch (err: any) {
      logger.error("STRIPE", "Error handling trial_will_end", { requestId: req.requestId, error: err });
    }
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as any;
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;

    logger.info("STRIPE", "Received invoice.paid", { requestId: req.requestId, meta: { customerId: maskToken(customerId) } });

    if (!subscriptionId || !customerId) {
      logger.error("STRIPE", "Missing critical data in invoice.paid event", { requestId: req.requestId });
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
        logger.info("STRIPE", "Plan successfully renewed", { professionalId: maskUid(usersSnap.docs[0].id) });
      } else {
        logger.warn("STRIPE", "Customer for renewal not found in system", { meta: { customerId: maskToken(customerId) } });
      }
    } catch (err: any) {
      logger.error("STRIPE", "Critical error processing invoice.paid", { requestId: req.requestId, error: err });
      return res.status(500).json({ error: 'Internal error updating renewal' });
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
          planRank: 0,
          indexable: false,
          planExpiresAt: null,
          stripeSubscriptionId: null,
          updatedAt: new Date().toISOString()
        });
        logger.info("STRIPE", "Subscription ended, plan reset to free", { professionalId: maskUid(userDoc.id) });
      } else {
        logger.warn("STRIPE", "Customer for deletion not found in system", { meta: { customerId: maskToken(customerId as string) } });
      }
    } catch (err: any) {
      logger.error("STRIPE", "Error deleting subscription", { requestId: req.requestId, error: err });
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
