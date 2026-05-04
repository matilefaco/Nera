import express from "express";
import admin from "firebase-admin";
import { getDb } from "../firebaseAdmin.js";
import { sendReferralRewardEmail, sendTrialWillEndEmail } from "../emails/sendEmail.js";
import Stripe from "stripe";
const router = express.Router();
const isDev = process.env.NODE_ENV !== "production";
let stripeModule = null;
function getStripe() {
    if (!stripeModule) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
            throw new Error("STRIPE_SECRET_KEY is missing in environment");
        }
        stripeModule = new Stripe(key, {
            apiVersion: "2023-10-16",
        });
    }
    return stripeModule;
}
/**
 * CREATE CHECKOUT SESSION
 */
router.post("/create-checkout", async (req, res) => {
    const db = getDb();
    const { plan, professionalId, email } = req.body;
    if (!plan || !professionalId || !email) {
        return res.status(400).json({ error: "Missing required fields: plan, professionalId, email" });
    }
    try {
        const stripe = getStripe();
        if (isDev) {
            console.log("[DEV CHECKOUT] Initiating checkout session for plan:", plan);
        }
        const priceId = plan === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_ESSENCIAL;
        if (!priceId) {
            console.error("[CHECKOUT ERROR] Price ID not configured. Check environment variables.");
            return res.status(400).json({ error: `O plano ${plan} não está configurado corretamente (Price ID ausente). Por favor, contate o suporte.` });
        }
        // Check for credits before creating session params
        const userDoc = await db.collection("users").doc(professionalId).get();
        const credits = userDoc.data()?.credits || 0;
        const sessionParams = {
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
    }
    catch (err) {
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
    const db = getDb();
    const stripe = getStripe();
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        if (webhookSecret && sig) {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        }
        else {
            // Fallback for dev without signature validation if desired, but better to be strict
            event = JSON.parse(req.body.toString());
        }
    }
    catch (err) {
        console.error(`[STRIPE WEBHOOK ERROR] Verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    console.log(`[STRIPE WEBHOOK] Received event: ${event.type}`);
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const plan = session.metadata?.plan || 'pro';
        if (isDev) {
            console.log(`[DEV WEBHOOK] Processing checkout.session.completed for userId=${userId}, plan=${plan}`);
        }
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
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            const planExpiresAt = new Date(subscription.current_period_end * 1000).toISOString();
            const userRef = db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            if (!userDoc.exists) {
                console.warn(`[STRIPE WEBHOOK ERROR] User context not found during checkout completion`);
                return res.status(404).json({ error: 'User not found' });
            }
            if (isDev) {
                console.log(`[DEV WEBHOOK] Updating plan for user ${userId} to ${plan}...`);
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
            const updateData = {
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
            console.log(`[STRIPE WEBHOOK SUCCESS] User successfully upgraded to ${plan}`);
        }
        catch (err) {
            console.error('[STRIPE WEBHOOK ERROR] Error processing checkout.session.completed:', err.message);
            return res.status(500).json({ error: 'Internal processing error' });
        }
    }
    if (event.type === 'customer.subscription.trial_will_end') {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        if (isDev) {
            console.log(`[DEV WEBHOOK] Trial strictly ending soon for customer ${customerId}`);
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
                        trialEndAt: new Date(subscription.trial_end * 1000).toISOString()
                    });
                    console.log(`[STRIPE WEBHOOK SUCCESS] Trial warning email sent`);
                }
            }
        }
        catch (err) {
            console.error('[STRIPE WEBHOOK ERROR] Error handling trial_will_end:', err.message);
        }
    }
    if (event.type === 'invoice.paid') {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;
        console.log(`[STRIPE WEBHOOK] Received invoice.paid for customer ${customerId}`);
        if (!subscriptionId || !customerId) {
            console.error('[STRIPE WEBHOOK ERROR] Missing critical data in invoice.paid event');
            return res.status(400).json({ error: 'Missing critical data' });
        }
        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const newExpiry = new Date(subscription.current_period_end * 1000);
            const usersSnap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
            if (!usersSnap.empty) {
                await usersSnap.docs[0].ref.update({
                    planExpiresAt: newExpiry.toISOString(),
                    updatedAt: new Date().toISOString()
                });
                console.log(`[STRIPE WEBHOOK SUCCESS] Plan successfully renewed`);
            }
            else {
                console.warn(`[STRIPE WEBHOOK] Customer for renewal not found in system`);
            }
        }
        catch (err) {
            console.error('[STRIPE WEBHOOK ERROR] Critical error processing invoice.paid:', err.message);
            return res.status(500).json({ error: 'Internal error updating renewal' });
        }
    }
    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
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
                console.log(`[STRIPE WEBHOOK SUCCESS] Subscription ended, plan reset to free`);
            }
            else {
                console.warn(`[STRIPE WEBHOOK] Customer for deletion not found in system`);
            }
        }
        catch (err) {
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
