import express from "express";
import admin from "firebase-admin";
import { sendPasswordResetEmail, sendVerificationEmail } from "../emails/sendEmail.js";
import { logger, maskEmail } from "../utils/logger.js";
import { PUBLIC_APP_URL, generateSlug, generateReferralCode } from "../utils.js";

const router = express.Router();

/**
 * POST /api/auth/register
 * Creates a new user via Admin SDK to avoid default Firebase emails and control branding.
 */
router.post("/register", async (req, res) => {
  const { name, email, password, referredBy, plan } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "Dados incompletos" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const signupPlan = (plan === 'essencial' || plan === 'pro') ? plan : 'free';

  try {
    // 1. Create User in Firebase Auth via Admin SDK
    // This gives us complete control over the email verification flow
    const userRecord = await admin.auth().createUser({
      email: cleanEmail,
      password: password,
      displayName: cleanName,
      emailVerified: false
    });

    logger.info("AUTH", "User created via Admin SDK", { uid: userRecord.uid, email: maskEmail(cleanEmail) });

    // 2. Initialize Firestore Profile with standard fields
    const db = admin.firestore();
    
    // START: Robust Unique Slug Generation
    let slug = generateSlug(cleanName);
    let isSlugUnique = false;
    let attempts = 0;
    const maxAttempts = 5;

    while (!isSlugUnique && attempts < maxAttempts) {
      const currentSlug = attempts === 0 ? slug : `${slug}-${Math.floor(Math.random() * 90) + 10}`;
      
      // Use a transaction to check and reserve both users and slugs collections
      const slugCheck = await db.runTransaction(async (transaction) => {
        const slugRef = db.collection("slugs").doc(currentSlug);
        const usersQuery = db.collection("users").where("slug", "==", currentSlug).limit(1);
        
        const [slugDoc, usersSnap] = await Promise.all([
          transaction.get(slugRef),
          transaction.get(usersQuery)
        ]);

        if (!slugDoc.exists && usersSnap.empty) {
          // Reserve it in slugs collection immediately
          transaction.set(slugRef, {
            uid: userRecord.uid,
            slug: currentSlug,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            source: "registration"
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
        message: "Esse link já está em uso. Escolha outro."
      });
    }

    const referralCode = generateReferralCode(cleanName);

    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      name: cleanName,
      email: cleanEmail,
      slug,
      referralCode,
      referredBy: referredBy || null,
      onboardingCompleted: false,
      credits: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      specialty: '',
      bio: '',
      location: '',
      whatsapp: '',
      avatar: '',
      plan: 'free',
      signupPlan: signupPlan
    });

    logger.info("AUTH", "Firestore profile initialized", { uid: userRecord.uid });

    // 3. Generate verification link (premium flow)
    const actionCodeSettings = {
      url: `${PUBLIC_APP_URL}/verificar-email?verified=1`,
      handleCodeInApp: false,
    };

    const firebaseLink = await admin.auth().generateEmailVerificationLink(cleanEmail, actionCodeSettings);
    const urlObj = new URL(firebaseLink);
    const finalLink = `${PUBLIC_APP_URL}/auth/action${urlObj.search}`;

    // 4. Send Premium Email via Resend
    const emailResult = await sendVerificationEmail({
      email: cleanEmail,
      verificationUrl: finalLink
    });

    logger.info("AUTH", "Registration completed successfully", { uid: userRecord.uid });

    if (!emailResult.success) {
      logger.error("AUTH", "Premium verification email failed during signup", { 
        uid: userRecord.uid, 
        error: emailResult.error 
      });
      return res.json({ 
        ok: true,
        code: "VERIFICATION_EMAIL_FAILED",
        message: "Sua conta foi criada, mas não conseguimos enviar o e-mail agora. Tente reenviar em instantes."
      });
    }

    return res.json({ 
      ok: true, 
      uid: userRecord.uid,
      message: "Conta criada com sucesso." 
    });

  } catch (error: any) {
    logger.error("AUTH", "Registration failed", { email: maskEmail(cleanEmail), error: error.message });
    
    let code = "REGISTER_FAILED";
    let status = 400; // Use 400 for most client errors
    let message = "Não foi possível concluir agora. Tente novamente.";

    if (error.code === 'auth/email-already-exists' || error.code === 'auth/email-already-in-use') {
      code = "EMAIL_ALREADY_EXISTS";
      message = "Este e-mail já está cadastrado.";
    } else if (error.code === 'auth/invalid-email') {
      code = "INVALID_EMAIL";
      message = "Informe um e-mail válido.";
    } else if (error.code === 'auth/weak-password' || error.code === 'auth/invalid-password') {
      code = "WEAK_PASSWORD";
      message = "Use uma senha com pelo menos 6 caracteres.";
    } else {
      status = 500;
    }

    return res.status(status).json({ 
      ok: false,
      code,
      message
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Generates a Firebase password reset link and sends it via Resend
 */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: "Email inválido" });
  }

  const cleanEmail = email.trim().toLowerCase();
  
  try {
    // 1. Generate the reset link using Firebase Admin
    const actionCodeSettings = {
      url: `${PUBLIC_APP_URL}/login?reset_success=1`,
      handleCodeInApp: false,
    };

    const link = await admin.auth().generatePasswordResetLink(cleanEmail, actionCodeSettings);

    // 2. Send the email using our premium Resend template
    const result = await sendPasswordResetEmail({
      email: cleanEmail,
      resetUrl: link
    });

    if (!result.success) {
      logger.error("AUTH", "Failed to send password reset email", { 
        email: maskEmail(cleanEmail), 
        error: result.error 
      });
    }

    return res.json({ 
      success: true, 
      message: "Se este e-mail estiver cadastrado, você receberá as instruções em instantes." 
    });

  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      logger.info("AUTH", "Password reset requested for non-existent user", { email: maskEmail(cleanEmail) });
      return res.json({ 
        success: true, 
        message: "Se este e-mail estiver cadastrado, você receberá as instruções em instantes." 
      });
    }

    logger.error("AUTH", "Error generating password reset link", { 
      email: maskEmail(cleanEmail), 
      error: error.message 
    });

    return res.status(500).json({ 
      error: "Erro interno", 
      message: "Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde." 
    });
  }
});

/**
 * POST /api/auth/send-verification
 * Generates a Firebase email verification link and sends it via Resend
 */
router.post("/send-verification", async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: "Email inválido" });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const actionCodeSettings = {
      // Use the proper app URL for redirection after verification
      url: `${PUBLIC_APP_URL}/verificar-email?verified=1`,
      handleCodeInApp: false,
    };

    logger.info("AUTH", "Generating verification link", { email: maskEmail(cleanEmail) });
    
    // Generate link via Firebase Admin
    const firebaseLink = await admin.auth().generateEmailVerificationLink(cleanEmail, actionCodeSettings);

    // Construct the custom handler link to provide a premium brand experience
    const urlObj = new URL(firebaseLink);
    const finalLink = `${PUBLIC_APP_URL}/auth/action${urlObj.search}`;

    logger.info("AUTH", "Dispatching premium verification email via Resend", { email: maskEmail(cleanEmail) });

    // Send via Resend using our premium template
    const result = await sendVerificationEmail({
      email: cleanEmail,
      verificationUrl: finalLink
    });

    if (!result.success) {
      logger.error("AUTH", "Premium email delivery failed", { 
        email: maskEmail(cleanEmail), 
        error: result.error 
      });
      // We return success to the client to prevent user enumeration or leaked failures,
      // but the log above captures the critical failure for support/audit.
      return res.json({ success: true, warning: 'Delivery delayed' });
    }

    logger.info("AUTH", "Premium verification email sent successfully", { 
      email: maskEmail(cleanEmail), 
      resendId: result.id 
    });

    return res.json({ success: true });
  } catch (error: any) {
    // If user not found, we don't necessarily want to leak that, but for verification it's usually 
    // called when we know the user exists (after signup or while logged in).
    logger.error("AUTH", "Error generating verification link", { 
      email: maskEmail(cleanEmail), 
      error: error.message 
    });

    return res.json({ success: true }); // Return success regardless for privacy/UX consistency
  }
});

export default router;
