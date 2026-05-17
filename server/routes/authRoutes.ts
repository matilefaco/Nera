import express from "express";
import admin from "firebase-admin";
import { sendPasswordResetEmail } from "../emails/sendEmail.js";
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
    // This link handles the actual password change on Firebase's default handlers
    // or we can point it to our custom page if we have one.
    // For now, we point to /login so the user can see a success message or just be back at the entry point.
    const actionCodeSettings = {
      url: `${PUBLIC_APP_URL}/login?reset_success=1`,
      handleCodeInApp: false, // Firebase handles the reset UI by default
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
      // Still return success to the user for security/privacy
    }

    return res.json({ 
      success: true, 
      message: "Se este e-mail estiver cadastrado, você receberá as instruções em instantes." 
    });

  } catch (error: any) {
    // If user not found, we still return success for privacy
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

export default router;
