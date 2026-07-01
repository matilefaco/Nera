import express from "express";
import admin from "firebase-admin";
import { getDb } from "../firebaseAdmin.js";
import { logger, maskUid } from "../utils/logger.js";
import { deleteUser, deleteUserBySlug } from "../services/userDeletionService.js";

const router = express.Router();

/**
 * ADMIN GUARD
 * Verifica header 'x-admin-grant-secret'
 */
const requireAdminSecret = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const secret = process.env.ADMIN_GRANT_SECRET;
  if (!secret) {
     logger.error("ADMIN", "ADMIN_GRANT_SECRET config missing");
     return res.status(500).json({ error: "Admin configuration missing" });
  }

  const provided = req.headers['x-admin-grant-secret'];
  if (!provided || provided !== secret) {
     logger.warn("ADMIN", "Unauthorized admin grant access attempt", {
       ip: req.ip
     });
     return res.status(401).json({ error: "Unauthorized" });
  }

  next();
};

/**
 * POST /grant-plan
 * Manually grant a plan to a beta user without touching Stripe.
 * Payload: { email, targetUid, plan, days, reason }
 */
router.post("/grant-plan", requireAdminSecret, async (req, res) => {
  try {
    const { email, targetUid, plan, days = 30, reason } = req.body;

    if (!email && !targetUid) {
      return res.status(400).json({ error: "Must provide email or targetUid" });
    }

    if (!plan || !["free", "essencial", "pro"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan. Must be 'free', 'essencial', or 'pro'" });
    }

    if (!reason) {
      return res.status(400).json({ error: "Must provide a reason" });
    }

    const db = getDb();
    let userDoc: admin.firestore.DocumentSnapshot | null = null;
    let uid = "";

    if (targetUid) {
      const doc = await db.collection("users").doc(targetUid).get();
      if (doc.exists) {
        userDoc = doc;
        uid = targetUid;
      }
    } else if (email) {
      const snap = await db.collection("users").where("email", "==", email.toLowerCase()).limit(1).get();
      if (!snap.empty) {
        userDoc = snap.docs[0];
        uid = userDoc.id;
      }
    }

    if (!userDoc || !userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const data = userDoc.data() || {};
    const userEmail = data.email || "unknown";

    const durationDays = Math.min(Math.max(Number(days) || 30, 1), 180);
    const now = admin.firestore.Timestamp.now();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    const manualPlanGrant = {
      grantedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      plan,
      reason,
      grantedBy: "admin_api"
    };

    if (plan === "essencial" || plan === "pro") {
      updateData.plan = plan;
      updateData.planRank = plan === "pro" ? 2 : 1;
      updateData.planExpiresAt = expiresAt.toISOString();
      updateData.stripeSubscriptionStatus = "manual_grant";
      updateData.billingSource = "manual_grant";
      updateData.manualPlanGrant = manualPlanGrant;
    } else {
      // Revoke back to free
      updateData.plan = "free";
      updateData.planRank = 0;
      updateData.planExpiresAt = null;
      updateData.stripeSubscriptionStatus = "canceled_or_none";
      updateData.billingSource = "manual_grant_revoked";
      updateData.manualPlanGrant = admin.firestore.FieldValue.delete();
    }

    const batch = db.batch();
    
    const userRef = db.collection("users").doc(uid);
    batch.update(userRef, updateData);

    const auditRef = db.collection("audit_logs").doc("admin_plan_grants").collection("events").doc();
    batch.set(auditRef, {
      targetUid: uid,
      targetEmail: prefixEmail(userEmail),
      plan,
      durationDays: plan === "free" ? 0 : durationDays,
      reason,
      grantedAt: now,
      grantedBy: "admin_api"
    });

    await batch.commit();

    logger.info("ADMIN", `Manual ${plan} grant applied`, { targetUid: maskUid(uid), reason });

    return res.status(200).json({
      success: true,
      message: `Plan ${plan} granted successfully to ${userEmail}`,
      plan,
      expiresAt: plan === "free" ? null : expiresAt.toISOString(),
      uid
    });
  } catch (error: any) {
    logger.error("ADMIN", "Error in grant-plan", { error: error.message });
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

function prefixEmail(email: string) {
  if (!email || !email.includes("@")) return "***@***";
  const parts = email.split("@");
  return `${parts[0].substring(0, 3)}***@${parts[1]}`;
}

/**
 * POST /delete-user
 * Exclui com segurança um usuário por UID ou Slug (modo dryRun ativo por padrão).
 * Headers: x-admin-grant-secret
 * Payload: { uid?: string, slug?: string, dryRun?: boolean }
 */
router.post("/delete-user", requireAdminSecret, async (req, res) => {
  try {
    const { uid, slug, dryRun = true } = req.body;

    if (!uid && !slug) {
      return res.status(400).json({ error: "Deve fornecer uid ou slug para exclusão." });
    }

    let report;
    const options = { dryRun, includeThirdPartyAnonymization: false };
    if (uid) {
      report = await deleteUser(uid, options);
    } else if (slug) {
      report = await deleteUserBySlug(slug, options);
    }

    return res.status(200).json({
      success: true,
      dryRun,
      report
    });
  } catch (error: any) {
    logger.error("ADMIN", "Erro no endpoint delete-user", { error: error.message });
    return res.status(error.message.includes("não foi encontrado") ? 404 : 500).json({ error: error.message });
  }
});

export default router;
