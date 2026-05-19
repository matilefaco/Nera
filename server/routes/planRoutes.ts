import express from "express";
import admin from "firebase-admin";
import { getDb } from "../firebaseAdmin.js";
import { sendReferralRewardEmail, sendTrialWillEndEmail } from "../emails/sendEmail.js";
import Stripe from "stripe";
import { logger, maskToken, maskUid } from "../utils/logger.js";
import { requireFirebaseAuth, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { PUBLIC_APP_URL } from "../utils.js";

const router = express.Router();

const isDev = process.env.NODE_ENV !== "production";

let stripeModule: Stripe | null = null;

function getStripe() {
  if (!stripeModule) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is missing in environment");
    }
    
    // Audit log for environment mode
    const isTestMode = key.startsWith("sk_test");
    logger.info("STRIPE", "Initializing Stripe SDK", { 
      meta: { 
        mode: isTestMode ? "test" : "live",
        nodeEnv: process.env.NODE_ENV,
        apiVersion: "2023-10-16"
      } 
    });

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
    
    const priceId = plan === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_ESSENCIAL;

    if (!priceId) {
      logger.error("STRIPE", "Price ID not configured", { professionalId: maskUid(uid), meta: { plan } });
      return res.status(400).json({ error: `O plano ${plan} não está configurado corretamente (Price ID ausente no ambiente). Por favor, contate o suporte.` });
    }

    // Check for credits before creating session params
    const credits = userData?.credits || 0;

    const isUpgrade = userData?.onboardingCompleted === true;

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
      payment_method_collection: "always",
      success_url: `${PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: isUpgrade ? `${PUBLIC_APP_URL}/planos?canceled=true` : `${PUBLIC_APP_URL}/checkout/canceled`,
      metadata: {
        professionalId: uid,
        plan,
        creditsUsed: credits >= 10 ? 'true' : 'false',
        source: isUpgrade ? 'upgrade' : 'signup'
      },
      subscription_data: {
        metadata: {
          professionalId: uid,
          plan,
          source: isUpgrade ? 'upgrade' : 'signup'
        }
      }
    };

    if (plan === 'essencial' && !userData?.trialUsed) {
      sessionParams.subscription_data = {
        ...sessionParams.subscription_data,
        trial_period_days: 15,
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

    // Debug price IDs check (optional/logging)
    const envPro = process.env.STRIPE_PRICE_PRO;
    const envEssencial = process.env.STRIPE_PRICE_ESSENCIAL;

    try {
      const subscriptions = await stripe.subscriptions.list({ customer: userData.stripeCustomerId, status: 'active', limit: 1 });
      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        const priceId = sub.items.data[0]?.price?.id;
        
        let planType = 'unknown';
        if (priceId === envPro) planType = 'pro';
        else if (priceId === envEssencial) planType = 'essencial';
        
        logger.info("STRIPE", "Customer subscription verified", { uid, subId: sub.id, priceId, planType });
      } else {
        logger.warn("STRIPE", "No active subscription found for customer", { uid, customer: userData.stripeCustomerId });
      }
    } catch (e: any) {
      logger.error("STRIPE", "Error checking subscription price", { err: e.message });
    }

    const params: any = {
      customer: userData.stripeCustomerId,
      return_url: `${PUBLIC_APP_URL}/planos`,
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
        params.return_url = `${PUBLIC_APP_URL}/planos`;
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

    const targetPriceId = process.env.STRIPE_PRICE_PRO;

    if (!targetPriceId) {
      logger.error("STRIPE", "STRIPE_PRICE_PRO not configured", { professionalId: maskUid(uid) });
      return res.status(400).json({ error: "O plano Pro não está configurado corretamente (Price ID ausente). Por favor, contate o suporte." });
    }

    // P0 FIX: Include 'trialing' and 'past_due' to allow upgrades for users in those states
    const subscriptions = await stripe.subscriptions.list({ 
      customer: userData.stripeCustomerId, 
      status: 'all', 
      limit: 5
    });

    // Filter for active-ish subscriptions manually to be robust
    const activeSub = subscriptions.data.find(s => ['active', 'trialing', 'past_due', 'incomplete'].includes(s.status));

    if (!activeSub) {
      logger.warn("STRIPE", "No valid subscription found for upgrade", { 
        professionalId: maskUid(uid), 
        customerId: userData.stripeCustomerId,
        foundCount: subscriptions.data.length,
        statuses: subscriptions.data.map(s => s.status)
      });
      return res.status(400).json({ error: "Nenhuma assinatura ativa encontrada para atualizar. Se você cancelou recentemente, aguarde o processamento ou contate o suporte." });
    }

    const currentItem = activeSub.items.data[0];

    if (!currentItem) {
      return res.status(400).json({ error: "Assinatura encontrada mas sem itens válidos." });
    }

    // Update the subscription
    await stripe.subscriptions.update(activeSub.id, {
      items: [{
        id: currentItem.id,
        price: targetPriceId,
      }],
      proration_behavior: 'always_invoice', // Immediately invoice the difference
      metadata: {
        plan: 'pro',
        professionalId: uid,
        upgradeSource: 'essencial-to-pro',
        upgradedAt: new Date().toISOString()
      }
    });

    // Removed optimistic update. Access will be granted via Stripe webhook (customer.subscription.updated)
    // confirmed through the system to ensure actual payment/verification.
    
    logger.info("STRIPE", "Direct upgrade to pro initiated via Stripe API", { professionalId: maskUid(uid), subId: sub.id, targetPriceId });
    
    res.json({ success: true, message: "Seu plano está sendo atualizado. Isso pode levar alguns instantes." });

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
    const userId = session.client_reference_id || (session.metadata?.professionalId as string);
    const plan = session.metadata?.plan || 'pro'; 

    if (isDev) {
      logger.info("STRIPE", "Processing checkout.session.completed", { professionalId: maskUid(userId!), meta: { plan, sessionId: session.id } });
    }

    if (!userId) {
      logger.error("STRIPE", "Critical: Missing userId in session (no client_reference_id or metadata.professionalId)", { requestId: req.requestId, sessionId: session.id });
      return res.status(400).json({ error: 'Missing userId identification' });
    }

    if (!session.subscription) {
      // Possible if it's a one-time payment or skipped, but we expect subscription mode
      logger.warn("STRIPE", "Missing subscription in checkout session", { requestId: req.requestId, meta: { sessionId: maskToken(session.id) } });
      return res.json({ received: true, warning: 'No subscription found in session' });
    }

    try {
      const stripe = getStripe(); 
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;
      const planExpiresAt = new Date(subscription.current_period_end * 1000).toISOString();

      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        logger.error("STRIPE", "User not found in Firestore during checkout Completion", { professionalId: maskUid(userId), meta: { sessionId: session.id } });
        // Maybe log to a failed_webhooks collection for manual recovery
        return res.status(404).json({ error: 'User not found in system' });
      }

      if (isDev) {
        logger.info("STRIPE", "Updating plan for user", { professionalId: maskUid(userId), meta: { plan } });
      }

      const userData = userDoc.data();
      const creditsUsed = session.metadata?.creditsUsed === 'true';

      // Idempotency Guard: Skip if subscription is already processed and plan matches
      if (userData?.stripeSubscriptionId === session.subscription && userData?.plan === plan) {
        logger.info("STRIPE", "[StripeSync] source=webhook-checkout-completed action=skipped_already_synced", { 
          professionalId: maskUid(userId), 
          subscriptionId: session.subscription 
        });
        return res.json({ received: true, alreadySynced: true });
      }

      // Update User Plan - Mandatory Fields
      const updateData: any = {
        plan: plan,
        indexable: true,
        planRank: plan === 'pro' ? 2 : 1,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        stripeSubscriptionStatus: subscription.status, // trialing, active, etc.
        planExpiresAt: planExpiresAt,
        trialUsed: true,
        lastStripeSyncAt: new Date().toISOString(),
        stripeSyncSource: 'checkout_completed',
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

        const needsUpdate = userData.planExpiresAt !== newExpiry.toISOString() || 
                           userData.stripeSubscriptionStatus !== subscription.status;

        if (needsUpdate) {
          const updateData: any = {
            planExpiresAt: newExpiry.toISOString(),
            stripeSubscriptionStatus: subscription.status,
            lastStripeSyncAt: new Date().toISOString(),
            stripeSyncSource: 'invoice_paid',
            updatedAt: new Date().toISOString()
          };

          // Fallback: If plan is still free or missing, update it from subscription
          const priceId = subscription.items?.data?.[0]?.price?.id;
          if (priceId && (!userData.plan || userData.plan === 'free')) {
            const envPro = process.env.STRIPE_PRICE_PRO;
            const envEssencial = process.env.STRIPE_PRICE_ESSENCIAL;

            if (priceId === envPro) {
              updateData.plan = 'pro';
              updateData.planRank = 2;
            } else if (priceId === envEssencial) {
              updateData.plan = 'essencial';
              updateData.planRank = 1;
            } else {
              // Fallback to metadata
              const metaPlan = (subscription.metadata as any)?.plan;
              if (metaPlan === 'pro' || metaPlan === 'essencial') {
                updateData.plan = metaPlan;
                updateData.planRank = metaPlan === 'pro' ? 2 : 1;
              }
            }
          }

          await userDoc.ref.update(updateData);
          logger.info("STRIPE", "[StripeSync] source=webhook-invoice-paid action=synced_plan_expiry", { professionalId: maskUid(userId) });
        } else {
          logger.info("STRIPE", "[StripeSync] source=webhook-invoice-paid action=skipped_redundant_update", { professionalId: maskUid(userId) });
        }

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
    const professionalIdFromMeta = (subscription.metadata as any)?.professionalId;

    logger.info("STRIPE", "Received customer.subscription.updated", { requestId: req.requestId, meta: { subscriptionId: maskToken(subscriptionId), professionalIdFromMeta } });

    try {
      let userQuery = await db.collection('users').where('stripeSubscriptionId', '==', subscriptionId).limit(1).get();
      
      if (userQuery.empty) {
        userQuery = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
      }

      if (userQuery.empty && professionalIdFromMeta) {
        const docRef = db.collection('users').doc(professionalIdFromMeta);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          // Wrap it in a pseudo-QuerySnapshot structure to reuse logic below
          userQuery = { empty: false, docs: [docSnap] } as any;
        }
      }

      if (!userQuery.empty) {
        const userDoc = userQuery.docs[0];
        const userData = userDoc.data();
        const userId = userDoc.id;

        const currentExpiry = userData.planExpiresAt;
        const newExpiryStr = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;

        // Idempotency: check if update is actually needed
        const hasStatusChange = userData.stripeSubscriptionStatus !== subscription.status;
        const hasExpiryChange = newExpiryStr && currentExpiry !== newExpiryStr;
        const hasCancelChange = userData.cancelAtPeriodEnd !== subscription.cancel_at_period_end;
        
        if (!hasStatusChange && !hasExpiryChange && !hasCancelChange) {
           logger.info("STRIPE", "[StripeSync] source=webhook-subscription-updated action=skipped_redundant_update", { professionalId: maskUid(userId) });
           return res.json({ received: true });
        }

        const updateData: any = {
          stripeSubscriptionStatus: subscription.status,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          lastStripeSyncAt: new Date().toISOString(),
          stripeSyncSource: 'subscription_updated_webhook',
          updatedAt: new Date().toISOString()
        };

        if (subscription.current_period_end) {
          updateData.planExpiresAt = new Date(subscription.current_period_end * 1000).toISOString();
        }

        // P0: If status is 'canceled' or 'unpaid', reset plan to 'free'
        if (['canceled', 'unpaid', 'incomplete_expired'].includes(subscription.status)) {
          updateData.plan = 'free';
          updateData.planRank = 0;
          updateData.indexable = false;
          logger.info("STRIPE", "Access revoked via subscription.updated status", { professionalId: userId, status: subscription.status });
        }

        // Handle Plan Change from Stripe Portal (Upgrade/Downgrade)
        const priceId = subscription.items?.data?.[0]?.price?.id;
        if (priceId) {
          const envPro = process.env.STRIPE_PRICE_PRO;
          const envEssencial = process.env.STRIPE_PRICE_ESSENCIAL;

          if (envPro && priceId === envPro) {
            updateData.plan = 'pro';
            updateData.planRank = 2;
            updateData.indexable = true;
          } else if (envEssencial && priceId === envEssencial) {
            updateData.plan = 'essencial';
            updateData.planRank = 1;
            updateData.indexable = true;
          } else {
            // Fallback to metadata if price IDs don't match exactly
            const metaPlan = (subscription.metadata as any)?.plan;
            if (metaPlan === 'pro' || metaPlan === 'essencial') {
              updateData.plan = metaPlan;
              updateData.planRank = metaPlan === 'pro' ? 2 : 1;
              updateData.indexable = true;
              logger.info("STRIPE", "Plan synced from subscription metadata", { professionalId: maskUid(userQuery.docs[0].id), plan: metaPlan });
            }
          }
        }

        await userQuery.docs[0].ref.update(updateData);
        logger.info("STRIPE", "Subscription sync updated", { professionalId: maskUid(userQuery.docs[0].id), status: subscription.status });
      } else {
        logger.warn("STRIPE", "Customer for subscription.updated not found in system", { meta: { customerId: maskToken(customerId as string), subscriptionId } });
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

/**
 * CONFIRM CHECKOUT SESSIONS (Synchronous Activation)
 */
router.post("/confirm-checkout", requireFirebaseAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  const db = getDb();
  const uid = req.uid;
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  try {
    const stripe = getStripe();
    // Retrieve session with expanded data
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    // 1. Security Check: Metadata or client_reference_id must match caller UID
    const sessionUid = session.client_reference_id || (session.metadata?.professionalId as string);
    if (sessionUid !== uid) {
      logger.warn("STRIPE", "Unauthorized attempt to confirm session", { uid, sessionUid, sessionId });
      return res.status(403).json({ error: "Unauthorized. This checkout session does not belong to you." });
    }

    // 2. Validate Session Status
    if (session.status !== 'complete' && session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
       logger.warn("STRIPE", "Checkout session not yet complete", { uid, status: session.status, paymentStatus: session.payment_status });
       return res.status(400).json({ error: "Checkout session is not complete or paid." });
    }

    // 3. Extract Subscription Info
    const subscription = session.subscription as Stripe.Subscription;
    if (!subscription) {
      return res.status(400).json({ error: "No subscription found in this session." });
    }

    // Status check for subscription
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
       return res.status(400).json({ error: `Subscription status is ${subscription.status}, expected active or trialing.` });
    }

    const plan = session.metadata?.plan || 'essencial';
    const planExpiresAt = new Date(subscription.current_period_end * 1000).toISOString();

    // 4. Update Firestore Immediately
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const userData = userDoc.data();
    
    // Idempotency Guard: If already synced with this subscription and plan, skip redundant write
    if (userData?.stripeSubscriptionId === subscription.id && userData?.plan === plan) {
      logger.info("STRIPE", "[StripeSync] source=confirm-checkout action=skipped_already_synced", { 
        uid, 
        subId: subscription.id 
      });
      return res.json({ 
        success: true, 
        plan, 
        status: subscription.status,
        alreadySynced: true
      });
    }

    const updateData: any = {
      plan: plan,
      planRank: plan === 'pro' ? 2 : 1,
      indexable: true,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
      planExpiresAt: planExpiresAt,
      trialUsed: true,
      lastStripeSyncAt: new Date().toISOString(),
      stripeSyncSource: 'confirm_checkout_sync',
      updatedAt: new Date().toISOString()
    };

    // If credits were used, reset them
    if (session.metadata?.creditsUsed === 'true') {
      updateData.credits = 0;
    }

    await userRef.update(updateData);

    logger.info("STRIPE", "Checkout session confirmed synchronously", { uid, plan, sessionId });

    return res.json({ 
      success: true, 
      plan, 
      status: subscription.status 
    });

  } catch (err: any) {
    logger.error("STRIPE", "Failed to confirm checkout session", { uid, sessionId, error: err.message });
    return res.status(500).json({ 
      error: "Failed to confirm checkout session", 
      details: err.message 
    });
  }
});

/**
 * ADMIN: RECONCILE USER PLAN WITH STRIPE
 * Securely fixes users that have paid but are still "free"
 */
router.post("/reconcile-user", requireFirebaseAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  const db = getDb();
  const callerUid = req.uid;
  const { targetUid, targetEmail } = req.body;

  try {
    // 1. Verify caller is Admin OR targeting themselves
    const callerDoc = await db.collection("users").doc(callerUid!).get();
    const isAdmin = callerDoc.exists && callerDoc.data()?.role === 'admin';
    const isSelf = targetUid === callerUid;

    if (!isAdmin && !isSelf) {
      logger.warn("ADMIN", "Unauthorized attempt to reconcile user", { callerUid, targetUid });
      return res.status(403).json({ error: "Unauthorized. Admin role required or must be yourself." });
    }

    if (!targetUid && !targetEmail && !isSelf) {
      return res.status(400).json({ error: "Missing targetUid or targetEmail" });
    }

    const effectiveTargetUid = targetUid || callerUid;

    // 2. Find Target User
    let userDoc: admin.firestore.DocumentSnapshot | null = null;
    if (effectiveTargetUid) {
      userDoc = await db.collection("users").doc(effectiveTargetUid).get();
    } else if (targetEmail) {
      const snap = await db.collection("users").where("email", "==", targetEmail.toLowerCase().trim()).limit(1).get();
      if (!snap.empty) userDoc = snap.docs[0];
    }

    if (!userDoc || !userDoc.exists) {
      return res.status(404).json({ error: "Target user not found" });
    }

    const userData = userDoc.data()!;
    const userId = userDoc.id;
    const email = userData.email;
    let customerId = userData.stripeCustomerId;

    const stripe = getStripe();

    // 3. Find Customer in Stripe if not in DB
    if (!customerId && email) {
      const customers = await stripe.customers.list({ email: email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    if (!customerId) {
      return res.status(404).json({ 
        error: "Stripe customer not found for this user",
        details: "No stripeCustomerId in DB and no matching email in Stripe."
      });
    }

    // 4. Find Active Subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 5
    });
    
    // Also check trialing and past_due
    const trialing = await stripe.subscriptions.list({
      customer: customerId,
      status: 'trialing',
      limit: 1
    });

    const pastDue = await stripe.subscriptions.list({
      customer: customerId,
      status: 'past_due',
      limit: 1
    });

    const allSubs = [...subscriptions.data, ...trialing.data, ...pastDue.data];

    if (allSubs.length === 0) {
      // If no active, trialing or past_due subs, but user has premium, reset them
      if (userData.plan && userData.plan !== 'free') {
        const updateData = {
          plan: 'free',
          planRank: 0,
          indexable: false,
          stripeSubscriptionStatus: 'canceled_or_none',
          lastStripeSyncAt: new Date().toISOString(),
          stripeSyncSource: 'reconcile_reset',
          updatedAt: new Date().toISOString()
        };
        await db.collection("users").doc(userId).update(updateData);
        return res.status(200).json({
          success: true,
          message: "No active subscriptions found. Premium access revoked.",
          customerId
        });
      }

      return res.status(200).json({
        success: false,
        message: "No active or trialing subscriptions found for this customer.",
        customerId
      });
    }

    // 5. Determine Plan and Update DB - Use the most "active" subscription
    const sub = allSubs[0];
    const priceId = sub.items.data[0]?.price?.id;
    const envPro = process.env.STRIPE_PRICE_PRO;
    const envEssencial = process.env.STRIPE_PRICE_ESSENCIAL;

    let plan: 'pro' | 'essencial' | 'free' = 'free';
    let planRank = 0;

    if (envPro && priceId === envPro) {
      plan = 'pro';
      planRank = 2;
    } else if (envEssencial && priceId === envEssencial) {
      plan = 'essencial';
      planRank = 1;
    } else {
      // Fallback to metadata
      const metaPlan = (sub.metadata as any)?.plan;
      if (metaPlan === 'pro' || metaPlan === 'essencial') {
        plan = metaPlan;
        planRank = metaPlan === 'pro' ? 2 : 1;
      }
    }

    if (plan === 'free') {
      return res.status(200).json({
        success: false,
        message: "Active subscription found but Price ID or Metadata did not match known plans.",
        priceId,
        metadata: sub.metadata,
        customerId
      });
    }

    // Update Data
    const updateData: any = {
      plan,
      planRank,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripeSubscriptionStatus: sub.status,
      planExpiresAt: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      lastStripeSyncAt: new Date().toISOString(),
      stripeSyncSource: 'manual_reconcile',
      updatedAt: new Date().toISOString(),
      indexable: true,
      trialUsed: sub.status === 'trialing' ? true : (userData.trialUsed || false)
    };

    await db.collection("users").doc(userId).update(updateData);

    logger.info("ADMIN", "Manual reconcile success", { userId: maskUid(userId), plan, callerUid: maskUid(callerUid!) });

    return res.json({
      success: true,
      message: `User plan reconciled to ${plan.toUpperCase()}`,
      updatedFields: updateData
    });

  } catch (err: any) {
    logger.error("ADMIN", "Reconcile failed", { error: err.message, callerUid: maskUid(callerUid!) });
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// Helper for status
router.get("/status", async (req, res) => {
  res.json({ message: "Plan routes active" });
});

export default router;
