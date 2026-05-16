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
    
    // Prevent double subscriptions
    if (userData?.plan && userData.plan !== 'free') {
      logger.warn("STRIPE", "Blocked attempt to create duplicate checkout session", { professionalId: maskUid(uid) });
      return res.status(403).json({ error: "Você já possui uma assinatura ativa. Para alterar seu plano, entre em contato com o suporte." });
    }

    const email = userData?.email;

    if (!email) {
       return res.status(400).json({ error: "User email not found" });
    }

    const stripe = getStripe();
    if (isDev) {
      logger.info("STRIPE", "Initiating checkout session", { professionalId: maskUid(uid), meta: { plan } });
    }
    
    const OFFICIAL_PRICES: Record<string, string> = {
      essencial: 'price_1TQhKBLqzItSzLk0NlC9xVRh',
      pro: 'price_1TQhKALqzItSzLk0D1andoSs'
    };
    
    const priceId = plan === 'pro' 
      ? (process.env.STRIPE_PRICE_PRO || OFFICIAL_PRICES.pro)
      : (process.env.STRIPE_PRICE_ESSENCIAL || OFFICIAL_PRICES.essencial);

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
      payment_method_collection: "if_required",
      success_url: `${process.env.APP_URL}/checkout/success`,
      cancel_url: `${process.env.APP_URL}/checkout/canceled`,
      metadata: {
        professionalId: uid,
        plan,
        creditsUsed: credits >= 10 ? 'true' : 'false'
      },
    };

    if (plan === 'essencial' && !userData?.trialUsed) {
      sessionParams.subscription_data = {
        trial_period_days: 15,
        trial_settings: {
          end_behavior: {
            missing_payment_method: "cancel"
          }
        }
      };
    }

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
 * CREATE CUSTOMER PORTAL SESSION
 */
router.post("/create-portal", requireFirebaseAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  const db = getDb();
  const uid = req.uid;

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userDoc.data();
    
    if (!userData?.stripeCustomerId) {
      logger.warn("STRIPE", "User tried opening portal without stripeCustomerId", { uid });
      return res.status(400).json({ error: "Você não possui uma assinatura ativa." });
    }

    const stripe = getStripe();
    if (isDev) {
      logger.info("STRIPE", "Initiating customer portal session", { professionalId: maskUid(uid) });
    }

    const OFFICIAL_PRICES: Record<string, string> = {
      essencial: 'price_1TQhKBLqzItSzLk0NlC9xVRh',
      pro: 'price_1TQhKALqzItSzLk0D1andoSs'
    };

    try {
      const subscriptions = await stripe.subscriptions.list({ customer: userData.stripeCustomerId, status: 'active', limit: 1 });
      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        const priceId = sub.items.data[0]?.price?.id;
        logger.info("STRIPE", "Customer subscription verified", { uid, subId: sub.id, priceId });
      } else {
        logger.warn("STRIPE", "No active subscription found for customer", { uid, customer: userData.stripeCustomerId });
      }
    } catch (e: any) {
      logger.error("STRIPE", "Error checking subscription price", { err: e.message });
    }

    const params: any = {
      customer: userData.stripeCustomerId,
      return_url: `${(process.env.APP_URL && process.env.APP_URL !== 'undefined') ? process.env.APP_URL : (req.headers.origin || 'https://usenera.com')}/planos`,
    };

    // Ignore STRIPE_PORTAL_CONFIGURATION_ID initially to use the Dashboard's default configuration
    if (process.env.STRIPE_PORTAL_CONFIGURATION_ID && process.env.STRIPE_PORTAL_CONFIGURATION_ID !== 'undefined') {
      logger.info("STRIPE", "Found STRIPE_PORTAL_CONFIGURATION_ID in env, but ignoring it to force Dashboard default configuration", { configurationId: process.env.STRIPE_PORTAL_CONFIGURATION_ID });
    }

    let session;
    try {
      session = await stripe.billingPortal.sessions.create(params);
    } catch (err: any) {
      if (err.message?.includes('configuration')) {
        logger.warn("STRIPE", "Failed to create portal session with configuration, falling back", { uid, error: err.message });
        delete params.configuration;
        session = await stripe.billingPortal.sessions.create(params);
      } else if (err.message?.includes('return_url')) {
        logger.warn("STRIPE", "Failed to create portal session with return_url, falling back to default", { uid, error: err.message });
        params.return_url = `https://usenera.com/planos`;
        session = await stripe.billingPortal.sessions.create(params);
      } else {
        throw err;
      }
    }

    res.json({ url: session.url });
  } catch (err: any) {
    logger.error("STRIPE", "Failed to create portal session", { requestId: req.requestId, error: err, errMessage: err.message });
    res.status(500).json({ 
      error: "Ocorreu um erro ao abrir o portal: " + err.message,
      details: err.message
    });
  }
});

/**
 * UPGRADE DIRECTLY TO PRO
 */
router.post("/upgrade-to-pro", requireFirebaseAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  const db = getDb();
  const uid = req.uid;

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userDoc.data();
    
    if (!userData?.stripeCustomerId) {
      logger.warn("STRIPE", "User tried upgrading without stripeCustomerId", { uid });
      return res.status(400).json({ error: "Você não possui uma assinatura ativa." });
    }

    if (userData.plan !== 'essencial') {
      return res.status(400).json({ error: "Seu plano atual não permite este tipo de atualização." });
    }

    const stripe = getStripe();
    if (isDev) {
      logger.info("STRIPE", "Initiating direct upgrade to pro", { professionalId: maskUid(uid) });
    }

    const OFFICIAL_PRICES: Record<string, string> = {
      essencial: 'price_1TQhKBLqzItSzLk0NlC9xVRh',
      pro: 'price_1TQhKALqzItSzLk0D1andoSs'
    };

    const targetPriceId = process.env.STRIPE_PRICE_PRO || OFFICIAL_PRICES.pro;

    const subscriptions = await stripe.subscriptions.list({ 
      customer: userData.stripeCustomerId, 
      status: 'active', 
      limit: 1 
    });

    if (subscriptions.data.length === 0) {
      return res.status(400).json({ error: "Nenhuma assinatura ativa encontrada para atualizar." });
    }

    const sub = subscriptions.data[0];
    const currentItem = sub.items.data[0];

    // Update the subscription
    await stripe.subscriptions.update(sub.id, {
      items: [{
        id: currentItem.id,
        price: targetPriceId,
      }],
      proration_behavior: 'always_invoice', // Immediately invoice the difference
    });

    // We can confidently update the user document to reflect the change.
    await db.collection("users").doc(uid).update({
      plan: 'pro',
      planRank: 2
    });

    logger.info("STRIPE", "Direct upgrade to pro completed", { professionalId: maskUid(uid), subId: sub.id, targetPriceId });
    
    res.json({ success: true, message: "Plano atualizado com sucesso!" });

  } catch (err: any) {
    logger.error("STRIPE", "Failed to upgrade to pro", { requestId: req.requestId, error: err, errMessage: err.message });
    res.status(500).json({ 
      error: "Ocorreu um erro ao tentar atualizar o plano: " + err.message,
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

  const eventId = event.id;
  if (!eventId) {
    logger.warn("STRIPE", "Webhook event missing ID", { requestId: req.requestId });
    return res.status(400).json({ error: "Missing event ID" });
  }

  try {
    const eventRef = db.collection('stripe_webhook_events').doc(eventId);
    
    await eventRef.create({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      type: event.type
    });
  } catch (err: any) {
    if (err.code === 6 || (err.message && err.message.includes('ALREADY_EXISTS'))) {
      logger.info("STRIPE", "Duplicate webhook event ignored", { requestId: req.requestId, meta: { eventId, eventType: event.type } });
      return res.json({ received: true, duplicate: true });
    }
    logger.error("STRIPE", "Error checking webhook idempotency", { requestId: req.requestId, error: err, meta: { eventId } });
    return res.status(500).json({ error: 'Internal idempotency error' });
  }

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
      const creditsUsed = session.metadata?.creditsUsed === 'true';

      // Update User Plan
      const updateData: any = {
        plan: plan,
        indexable: true,
        planRank: plan === 'pro' ? 2 : 1,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        planExpiresAt: planExpiresAt,
        trialUsed: true,
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
    const amountPaid = invoice.amount_paid || 0;

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
        const userDoc = usersSnap.docs[0];
        const userData = userDoc.data();
        const userId = userDoc.id;

        await userDoc.ref.update({
          planExpiresAt: newExpiry.toISOString(),
          updatedAt: new Date().toISOString()
        });
        logger.info("STRIPE", "Plan successfully renewed", { professionalId: maskUid(userId) });

        // Handle Referral Reward (10 BRL)
        const referredBy = userData?.referredBy;
        const referralRewarded = userData?.referralRewarded;

        if (amountPaid > 0 && referredBy && !referralRewarded) {
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
            
            // Mark as rewarded to prevent duplicate rewards on subsequent invoices
            await userDoc.ref.update({
              referralRewarded: true
            });
            logger.info("STRIPE", "Referral rewarded on first real payment", { professionalId: maskUid(userId) });
          }
        }
      } else {
        logger.warn("STRIPE", "Customer for renewal not found in system", { meta: { customerId: maskToken(customerId) } });
      }
    } catch (err: any) {
      logger.error("STRIPE", "Critical error processing invoice.paid", { requestId: req.requestId, error: err });
      return res.status(500).json({ error: 'Internal error updating renewal' });
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as any;
    const customerId = invoice.customer;
    const hosted_invoice_url = invoice.hosted_invoice_url;
    const next_payment_attempt = invoice.next_payment_attempt;
    const attempt_count = invoice.attempt_count;

    logger.info("STRIPE", "Received invoice.payment_failed", { requestId: req.requestId, meta: { customerId: maskToken(customerId as string) } });

    try {
      const usersSnap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
      if (!usersSnap.empty) {
        await usersSnap.docs[0].ref.update({
          paymentStatus: 'past_due',
          lastPaymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
          failedPaymentAttemptCount: attempt_count || 1,
          stripeHostedInvoiceUrl: hosted_invoice_url || null,
          nextPaymentAttemptAt: next_payment_attempt || null
        });
        logger.info("STRIPE", "Payment failed status updated", { professionalId: maskUid(usersSnap.docs[0].id) });
      } else {
        logger.warn("STRIPE", "Customer for payment failure not found in system", { meta: { customerId: maskToken(customerId as string) } });
      }
    } catch (err: any) {
      logger.error("STRIPE", "Error processing invoice.payment_failed", { requestId: req.requestId, error: err });
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const subscriptionId = subscription.id;
    const customerId = subscription.customer;

    logger.info("STRIPE", "Received customer.subscription.updated", { requestId: req.requestId, meta: { subscriptionId: maskToken(subscriptionId) } });

    try {
      let userQuery = await db.collection('users').where('stripeSubscriptionId', '==', subscriptionId).limit(1).get();
      if (userQuery.empty) {
        userQuery = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
      }

      if (!userQuery.empty) {
        const updateData: any = {
          stripeSubscriptionStatus: subscription.status,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          updatedAt: new Date().toISOString()
        };

        if ((subscription as any).current_period_end) {
          updateData.currentPeriodEnd = new Date((subscription as any).current_period_end * 1000).toISOString();
        }

        // Handle Plan Change from Stripe Portal (Upgrade/Downgrade)
        const priceId = subscription.items?.data?.[0]?.price?.id;
        if (priceId) {
          const OFFICIAL_PRICES: Record<string, string> = {
            essencial: 'price_1TQhKBLqzItSzLk0NlC9xVRh',
            pro: 'price_1TQhKALqzItSzLk0D1andoSs'
          };
          const envPro = process.env.STRIPE_PRICE_PRO || OFFICIAL_PRICES.pro;
          const envEssencial = process.env.STRIPE_PRICE_ESSENCIAL || OFFICIAL_PRICES.essencial;

          if (priceId === envPro) {
            updateData.plan = 'pro';
            updateData.planRank = 2;
            updateData.indexable = true;
          } else if (priceId === envEssencial) {
            updateData.plan = 'essencial';
            updateData.planRank = 1;
            updateData.indexable = true;
          }
        }

        await userQuery.docs[0].ref.update(updateData);
        logger.info("STRIPE", "Subscription sync updated", { professionalId: maskUid(userQuery.docs[0].id) });
      } else {
        logger.warn("STRIPE", "Customer for subscription.updated not found in system", { meta: { customerId: maskToken(customerId as string) } });
      }
    } catch (err: any) {
      logger.error("STRIPE", "Error processing customer.subscription.updated", { requestId: req.requestId, error: err });
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
