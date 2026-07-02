import express from "express";
import admin from "firebase-admin";
import { requireFirebaseAuth, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../emails/sendEmail.js";
import { logger, maskEmail } from "../utils/logger.js";
import {
  PUBLIC_APP_URL,
  generateSlug,
  generateReferralCode,
} from "../utils.js";

const router = express.Router();

/**
 * POST /api/auth/register
 * Creates a new user via Admin SDK to avoid default Firebase emails and control branding.
 */
router.post("/register", requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
  const authUid = req.uid;
  if (!authUid) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const { uid: bodyUid, name, email: bodyEmail, referredBy, plan } = req.body;

  // Derive email preferencialmente from req.user?.email, fallback to bodyEmail
  const tokenEmail = req.user?.email;
  const finalEmail = (tokenEmail || bodyEmail || "").trim().toLowerCase();

  if (!name || !finalEmail) {
    return res.status(400).json({ error: "Dados incompletos" });
  }

  // Se body.uid existir e body.uid !== req.uid: retornar 403.
  if (bodyUid && bodyUid !== authUid) {
    return res.status(403).json({ error: "Acesso negado. UID divergente." });
  }

  // Se body.email existir e req.user.email existir e body.email !== req.user.email: retornar 403
  if (bodyEmail && tokenEmail && bodyEmail.trim().toLowerCase() !== tokenEmail.trim().toLowerCase()) {
    return res.status(403).json({ error: "Acesso negado. Email divergente." });
  }

  const cleanEmail = finalEmail;
  const cleanName = name.trim();
  const signupPlan = "free";

  try {
    const db = admin.firestore();

    // Antes de criar, buscar users/{req.uid}
    const userDocRef = db.collection("users").doc(authUid);
    const userDoc = await userDocRef.get();

    // Se users/{req.uid} já existir: retornar 409
    if (userDoc.exists) {
      return res.status(409).json({
        ok: false,
        code: "USER_ALREADY_EXISTS",
        message: "User already exists",
      });
    }

    // START: Robust Unique Slug Generation
    let slug = generateSlug(cleanName);
    let isSlugUnique = false;
    let attempts = 0;
    const maxAttempts = 5;

    while (!isSlugUnique && attempts < maxAttempts) {
      const currentSlug =
        attempts === 0
          ? slug
          : `${slug}-${Math.floor(Math.random() * 90) + 10}`;

      // Use a transaction to check and reserve both users and slugs collections
      const slugCheck = await db.runTransaction(async (transaction) => {
        const slugRef = db.collection("slugs").doc(currentSlug);
        const usersQuery = db
          .collection("users")
          .where("slug", "==", currentSlug)
          .limit(1);

        const [slugDoc, usersSnap] = await Promise.all([
          transaction.get(slugRef),
          transaction.get(usersQuery),
        ]);

        if (!slugDoc.exists && usersSnap.empty) {
          // Reserve it in slugs collection immediately
          transaction.set(slugRef, {
            uid: authUid,
            slug: currentSlug,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            source: "registration",
          });
          return currentSlug;
        }
        return null;
      });

      if (slugCheck) {
        slug = slugCheck;
        isSlugUnique = true;
      } else {
        attempts++;
      }
    }
    // END: Robust Unique Slug Generation

    if (!isSlugUnique) {
      logger.error("AUTH", "Slug generation failed", { name: cleanName });
      return res.status(400).json({
        ok: false,
        code: "SLUG_UNAVAILABLE",
        message: "Esse link já está em uso. Escolha outro.",
      });
    }

    // 2. High & transactional uniqueness for referralCode
    let referralCode = "";
    let isCodeUnique = false;
    let codeAttempts = 0;
    const maxCodeAttempts = 5;

    while (!isCodeUnique && codeAttempts < maxCodeAttempts) {
      const candidateCode = codeAttempts === 0
        ? generateReferralCode(cleanName)
        : generateReferralCode(cleanName + Math.floor(Math.random() * 1000));

      const isUnique = await db.runTransaction(async (transaction) => {
        const codeRef = db.collection("referral_codes").doc(candidateCode);
        const usersQuery = db
          .collection("users")
          .where("referralCode", "==", candidateCode)
          .limit(1);

        const [codeDoc, usersSnap] = await Promise.all([
          transaction.get(codeRef),
          transaction.get(usersQuery),
        ]);

        if (!codeDoc.exists && usersSnap.empty) {
          // Reserve it in referral_codes collection
          transaction.set(codeRef, {
            uid: authUid,
            code: candidateCode,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return true;
        }
        return false;
      });

      if (isUnique) {
        referralCode = candidateCode;
        isCodeUnique = true;
      } else {
        codeAttempts++;
      }
    }

    if (!isCodeUnique) {
      // Fallback to high entropy random code
      referralCode = `REF${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    }

    // 3. Normalization & Validation of referredBy code
    let validReferredBy: string | null = null;
    if (referredBy && typeof referredBy === "string") {
      const cleanReferredBy = referredBy.trim().toUpperCase().replace(/\s+/g, "");
      if (/^[A-Z0-9]{4,10}$/.test(cleanReferredBy)) {
        // confirm that there is exactly one professional in users collection with that code
        const referrerQuery = await db.collection("users")
          .where("referralCode", "==", cleanReferredBy)
          .limit(2)
          .get();
        if (referrerQuery.size === 1) {
          validReferredBy = cleanReferredBy;
        } else {
          logger.warn("AUTH", "referredBy code not found or not unique", { cleanReferredBy, size: referrerQuery.size });
        }
      } else {
        logger.warn("AUTH", "referredBy code format invalid", { cleanReferredBy });
      }
    }

    // Create only the safe fields
    await userDocRef.set({
      uid: authUid,
      name: cleanName,
      email: cleanEmail,
      slug,
      referralCode,
      referredBy: validReferredBy,
      onboardingCompleted: false,
      credits: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      specialty: "",
      bio: "",
      location: "",
      whatsapp: "",
      avatar: "",
      plan: "free",
      signupPlan: signupPlan,
    });

    logger.info("AUTH", "Firestore profile initialized", { uid: authUid });

    // 3. Generate verification link (premium flow)
    const actionCodeSettings = {
      url: `${PUBLIC_APP_URL}/verificar-email?verified=1`,
      handleCodeInApp: false,
    };

    try {
      const firebaseLink = await admin
        .auth()
        .generateEmailVerificationLink(cleanEmail, actionCodeSettings);
      const urlObj = new URL(firebaseLink);
      const finalLink = `${PUBLIC_APP_URL}/auth/action${urlObj.search}`;

      // 4. Send Premium Email via Resend
      const emailResult = await sendVerificationEmail({
        email: cleanEmail,
        verificationUrl: finalLink,
      });

      if (!emailResult.success) {
        logger.error(
          "AUTH",
          "Premium verification email failed during signup",
          { uid: authUid, error: emailResult.error }
        );
        return res.json({
          ok: true,
          code: "VERIFICATION_EMAIL_FAILED",
          message:
            "Sua conta foi criada, mas não conseguimos enviar o e-mail agora. Tente reenviar em instantes.",
        });
      }
    } catch (linkError: any) {
      logger.error("AUTH", "Failed to generate or send verification link", {
        uid: authUid,
        error: linkError.message,
        code: linkError.code,
      });
      // Do not fail the registration, user and profile were already created successfully
      return res.json({
        ok: true,
        code: "VERIFICATION_EMAIL_FAILED",
        message:
          "Sua conta foi criada, mas tivemos um problema ao gerar o link de verificação para este ambiente. Você pode tentar reenviar o e-mail depois.",
      });
    }

    logger.info("AUTH", "Registration completed successfully", { uid: authUid });

    return res.json({
      ok: true,
      uid: authUid,
      message: "Conta criada com sucesso.",
    });
  } catch (error: any) {
    logger.error("AUTH", "Registration failed", {
      email: maskEmail(cleanEmail),
      error: error.message,
    });

    let code = "REGISTER_FAILED";
    let status = 400; // Use 400 for most client errors
    let message = "Não foi possível concluir agora. Tente novamente.";

    if (
      error.code === "auth/email-already-exists" ||
      error.code === "auth/email-already-in-use"
    ) {
      code = "EMAIL_ALREADY_EXISTS";
      message = "Este e-mail já está cadastrado.";
    } else if (error.code === "auth/invalid-email") {
      code = "INVALID_EMAIL";
      message = "Informe um e-mail válido.";
    } else if (
      error.code === "auth/weak-password" ||
      error.code === "auth/invalid-password"
    ) {
      code = "WEAK_PASSWORD";
      message = "Use uma senha com pelo menos 6 caracteres.";
    } else {
      status = 500;
      message = `Não foi possível concluir agora. Erro interno: ${error.code || 'Desconhecido'}`;
      code = error.code || "REGISTER_FAILED";
    }

    return res.status(status).json({
      ok: false,
      code,
      message,
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Generates a Firebase password reset link and sends it via Resend
 */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Email inválido" });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. Generate the reset link using Firebase Admin
    const actionCodeSettings = {
      url: `${PUBLIC_APP_URL}/login?reset_success=1`,
      handleCodeInApp: false,
    };

    const link = await admin
      .auth()
      .generatePasswordResetLink(cleanEmail, actionCodeSettings);

    // 2. Send the email using our premium Resend template
    const result = await sendPasswordResetEmail({
      email: cleanEmail,
      resetUrl: link,
    });

    if (!result.success) {
      logger.error("AUTH", "Failed to send password reset email", {
        email: maskEmail(cleanEmail),
        error: result.error,
      });
    }

    return res.json({
      success: true,
      message:
        "Se este e-mail estiver cadastrado, você receberá as instruções em instantes.",
    });
  } catch (error: any) {
    if (error.code === "auth/user-not-found") {
      logger.info("AUTH", "Password reset requested for non-existent user", {
        email: maskEmail(cleanEmail),
      });
      return res.json({
        success: true,
        message:
          "Se este e-mail estiver cadastrado, você receberá as instruções em instantes.",
      });
    }

    logger.error("AUTH", "Error generating password reset link", {
      email: maskEmail(cleanEmail),
      error: error.message,
    });

    return res.status(500).json({
      error: "Erro interno",
      message:
        "Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.",
    });
  }
});

/**
 * POST /api/auth/send-verification
 * Generates a Firebase email verification link and sends it via Resend
 */
router.post("/send-verification", async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Email inválido" });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const actionCodeSettings = {
      // Use the proper app URL for redirection after verification
      url: `${PUBLIC_APP_URL}/verificar-email?verified=1`,
      handleCodeInApp: false,
    };

    logger.info("AUTH", "Generating verification link", {
      email: maskEmail(cleanEmail),
    });

    // Generate link via Firebase Admin
    const firebaseLink = await admin
      .auth()
      .generateEmailVerificationLink(cleanEmail, actionCodeSettings);

    // Construct the custom handler link to provide a premium brand experience
    const urlObj = new URL(firebaseLink);
    const finalLink = `${PUBLIC_APP_URL}/auth/action${urlObj.search}`;

    logger.info("AUTH", "Dispatching premium verification email via Resend", {
      email: maskEmail(cleanEmail),
    });

    // Send via Resend using our premium template
    const result = await sendVerificationEmail({
      email: cleanEmail,
      verificationUrl: finalLink,
    });

    if (!result.success) {
      logger.error("AUTH", "Premium email delivery failed", {
        email: maskEmail(cleanEmail),
        error: result.error,
      });
      // We return success to the client to prevent user enumeration or leaked failures,
      // but the log above captures the critical failure for support/audit.
      return res.json({ success: true, warning: "Delivery delayed" });
    }

    logger.info("AUTH", "Premium verification email sent successfully", {
      email: maskEmail(cleanEmail),
      resendId: result.id,
    });

    return res.json({ success: true });
  } catch (error: any) {
    // If user not found, we don't necessarily want to leak that, but for verification it's usually
    // called when we know the user exists (after signup or while logged in).
    logger.error("AUTH", "Error generating verification link", {
      email: maskEmail(cleanEmail),
      error: error.message,
    });

    return res.json({ success: true }); // Return success regardless for privacy/UX consistency
  }
});

export default router;
