import express from "express";
import admin from "firebase-admin";
import { sendPasswordResetEmail, sendVerificationEmail } from "../emails/sendEmail.js";
import { logger, maskEmail } from "../utils/logger.js";
import { PUBLIC_APP_URL } from "../utils.js";

const router = express.Router();

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
      url: `${PUBLIC_APP_URL}/verificar-email?verified=1`,
      handleCodeInApp: false,
    };

    // Generate link via Firebase Admin
    const firebaseLink = await admin.auth().generateEmailVerificationLink(cleanEmail, actionCodeSettings);

    // Extract Firebase parameters and point to our custom handler inside the app
    // This maintains security but allows for a custom visual experience
    const urlObj = new URL(firebaseLink);
    const finalLink = `${PUBLIC_APP_URL}/auth/action${urlObj.search}`;

    // Send via Resend
    const result = await sendVerificationEmail({
      email: cleanEmail,
      verificationUrl: finalLink
    });

    if (!result.success) {
      logger.error("AUTH", "Failed to send verification email", { 
        email: maskEmail(cleanEmail), 
        error: result.error 
      });
    }

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
