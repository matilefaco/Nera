import express from "express";
import crypto from "crypto";
import admin from "firebase-admin";
import { google } from "googleapis";
import { getDb } from "../firebaseAdmin.js";
import { requireFirebaseAuth, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { logger, maskUid } from "../utils/logger.js";
import { PUBLIC_APP_URL } from "../utils.js";

const router = express.Router();

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function getOAuthClient(redirectUri: string) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Configuração do Google Calendar pendente no ambiente.");
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID.trim(),
    process.env.GOOGLE_CLIENT_SECRET.trim(),
    redirectUri.trim()
  );
}

// 1. Get Auth URL
router.get("/auth-url", requireFirebaseAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  let step = "init";
  try {
    step = "env_check";
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error("GOOGLE_CLIENT_ID ausente no ambiente.");
    }
    if (!process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error("GOOGLE_CLIENT_SECRET ausente no ambiente.");
    }
    if (!process.env.GOOGLE_REDIRECT_URI) {
      throw new Error("GOOGLE_REDIRECT_URI ausente no ambiente.");
    }
    
    const uid = req.uid;
    const professionalIdQuery = req.query.professionalId as string;
    if (professionalIdQuery && professionalIdQuery !== uid) {
      throw new Error("Permissão negada");
    }
    
    const professionalId = uid;
    if (!professionalId) {
      throw new Error("Missing professionalId");
    }

    step = "redirect_uri_prepare";
    const redirectUri = process.env.GOOGLE_REDIRECT_URI.trim();

    step = "oauth_client_create";
    const oauth2Client = getOAuthClient(redirectUri);

    step = "state_create";
    const state = crypto.randomUUID();
    const db = getDb();
    
    step = "firestore_state_save";
    await db.collection("oauth_states").doc(state).set({
      uid: professionalId,
      provider: "google_calendar",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: Date.now() + 10 * 60 * 1000,
      used: false
    });

    step = "generate_auth_url";
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
      state: state,
    });

    step = "response_json";
    return res.json({ 
      url: url.trim(),
      debugInfo: {
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        redirectUri,
        urlPreview: url.substring(0, 80) + '...'
      }
    });

  } catch (err: any) {
    const errorMsg = String(err instanceof Error ? err.message : err);
    return res.status(500).json({
      error: `[${step}] ${errorMsg}`, // Para o frontend exibir no toast corretamente
      debugInfo: true,
      step,
      message: errorMsg,
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasRedirectUri: !!process.env.GOOGLE_REDIRECT_URI,
      redirectUriPreview: process.env.GOOGLE_REDIRECT_URI
        ? process.env.GOOGLE_REDIRECT_URI.trim()
        : null
    });
  }
});

// 2. OAuth Callback
router.get("/callback", async (req, res) => {
  const db = getDb();
  let appUrl = '';
  // Force content-type
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  
  try {
    appUrl = PUBLIC_APP_URL ? PUBLIC_APP_URL.trim() : '';
    const redirectUri = (process.env.GOOGLE_REDIRECT_URI || `${(appUrl || '').replace(/\/+$/, "")}/api/calendar/callback`).trim();
    
    logger.info("CALENDAR", "Callback start", { 
      hasCode: !!req.query.code, 
      hasState: !!req.query.state,
      hasErrorUrl: !!req.query.error,
      appUrl
    });

    if (req.query.error) {
      logger.error("CALENDAR", "OAuth Provider returned error in query", { error: req.query.error });
      return res.redirect(`${appUrl}/profile?calendarAuth=error&error=${encodeURIComponent(String(req.query.error))}`);
    }

    const { code, state: stateParam } = req.query;
    const stateStr = stateParam as string;

    if (!code || !stateStr) {
      logger.error("CALENDAR", "Missing code or state in query params");
      return res.redirect(`${appUrl}/profile?calendarAuth=error&error=${encodeURIComponent('Missing code or state')}`);
    }

    logger.info("CALENDAR", "Code and state present, validating state", { stateStr });
    
    const stateDoc = await db.collection("oauth_states").doc(stateStr).get();
    if (!stateDoc.exists) {
      logger.error("CALENDAR", "State not found in Firestore", { stateStr });
      return res.redirect(`${appUrl}/profile?calendarAuth=error&error=${encodeURIComponent('Solicitação de autenticação não encontrada')}`);
    }

    const stateData = stateDoc.data();
    if (!stateData || stateData.provider !== "google_calendar" || stateData.used || stateData.expiresAt < Date.now()) {
      logger.error("CALENDAR", "State invalid, used or expired", { stateData });
      return res.redirect(`${appUrl}/profile?calendarAuth=error&error=${encodeURIComponent('Solicitação expirada ou já utilizada')}`);
    }

    const professionalId = stateData.uid;
    logger.info("CALENDAR", "State is valid, UID found", { professionalId: maskUid(professionalId) });

    await db.collection("oauth_states").doc(stateStr).update({ used: true });
    logger.info("CALENDAR", "State marked as used");

    const oauth2Client = getOAuthClient(redirectUri);
    logger.info("CALENDAR", "Exchanging code for tokens", { redirectUri });

    const { tokens } = await oauth2Client.getToken(code as string);
    logger.info("CALENDAR", "Tokens received", { 
      hasAccessToken: !!tokens.access_token, 
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date
    });

    await db.collection("users").doc(professionalId).update({
      "integrations.google_calendar": {
        tokens,
        connectedAt: new Date().toISOString(),
        enabled: true,
      },
    });
    logger.info("CALENDAR", "Tokens saved to Firestore successfully", { professionalId: maskUid(professionalId) });

    return res.redirect(`${appUrl}/profile?calendarAuth=success`);
  } catch (err: any) {
    logger.error("CALENDAR", "Failed to process OAuth callback - Exception caught", { error: String(err?.message || err) });
    return res.redirect(`${appUrl || '/'}profile?calendarAuth=error&error=${encodeURIComponent(String(err?.message || "Erro interno no servidor"))}`);
  }
});

// 3. Status and Toggle
router.get("/status", requireFirebaseAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  const db = getDb();
  const uid = req.uid;
  const professionalIdQuery = req.query.professionalId as string;

  if (professionalIdQuery && professionalIdQuery !== uid) {
    return res.status(403).json({ error: "Permissão negada" });
  }
  
  const professionalId = uid;

  if (!professionalId) {
    return res.status(400).json({ error: "Missing professionalId" });
  }

  try {
    const userDoc = await db.collection("users").doc(professionalId).get();
    const integration = userDoc.data()?.integrations?.google_calendar;

    res.json({
      connected: !!integration?.tokens,
      enabled: !!integration?.enabled,
    });
  } catch (err: any) {
    logger.error("CALENDAR", "Failed to fetch status", { professionalId: maskUid(professionalId), error: err });
    res.status(500).json({ 
      error: "Erro ao carregar status do calendário", 
      message: err.message || "Erro desconhecido",
      connected: false 
    });
  }
});

router.post("/toggle", requireFirebaseAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  const db = getDb();
  const uid = req.uid;
  const { professionalId, enabled } = req.body;

  if (professionalId && professionalId !== uid) {
    return res.status(403).json({ error: "Permissão negada" });
  }

  const targetId = uid || professionalId;

  if (!targetId) {
    return res.status(400).json({ error: "Missing professionalId" });
  }

  try {
    await db.collection("users").doc(targetId).update({
      "integrations.google_calendar.enabled": enabled,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/disconnect", requireFirebaseAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  const db = getDb();
  const uid = req.uid;
  const { professionalId } = req.body;

  if (professionalId && professionalId !== uid) {
    return res.status(403).json({ error: "Permissão negada" });
  }

  const targetId = uid || professionalId;

  if (!targetId) {
    return res.status(400).json({ error: "Missing professionalId" });
  }

  try {
    await db.collection("users").doc(targetId).update({
      "integrations.google_calendar": null,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * CREATE EVENT FUNCTION (Exported)
 */
export async function createGoogleCalendarEvent(appointment: any, professionalId: string) {
  const db = getDb();
  try {
    const userDoc = await db.collection("users").doc(professionalId).get();
    const integration = userDoc.data()?.integrations?.google_calendar;

    if (!integration || !integration.tokens || !integration.enabled) {
      logger.info("CALENDAR", "Skipping event creation (Integration disabled or missing tokens)", { professionalId: maskUid(professionalId) });
      return;
    }

    const oauth2Client = getOAuthClient(""); // redirectUri doesn't matter for operations
    oauth2Client.setCredentials(integration.tokens);

    // Refresh token if needed
    oauth2Client.on("tokens", (tokens) => {
      const cleanNewTokens = Object.fromEntries(Object.entries(tokens).filter(([_, v]) => v !== undefined));
      const existingTokens = integration?.tokens || {};
      const updatedTokens = {
        ...existingTokens,
        ...cleanNewTokens
      };

      db.collection("users").doc(professionalId).update({
        "integrations.google_calendar.tokens": updatedTokens
      }).catch(err => {
        logger.error("CALENDAR", "Failed to persist refreshed tokens", { professionalId: maskUid(professionalId), error: err });
      });
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Calculate start/end
    // appointment.date format is usually YYYY-MM-DD
    // appointment.time format is usually HH:mm
    const startDateTime = new Date(`${appointment.date}T${appointment.time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + (appointment.duration || 60) * 60000);

    const description = `
Cliente: ${appointment.clientName}
WhatsApp: ${appointment.clientPhone}
Serviço: ${appointment.serviceName}
${appointment.isHomeService ? `Endereço: ${appointment.addressStreet}, ${appointment.addressNumber}` : "No Studio"}
Mensagem: ${appointment.clientMessage || "Nenhuma"}
    `.trim();

    const event = {
      summary: `Nera: ${appointment.serviceName} - ${appointment.clientName}`,
      description: description,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "America/Sao_Paulo", // Should theoretically be user's timezone
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "America/Sao_Paulo",
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 120 }, // 2 hours before
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });

    logger.info("CALENDAR", "Event created successfully", { professionalId: maskUid(professionalId) });
    
    // Save event ID to appointment
    await db.collection("appointments").doc(appointment.id).update({
      googleCalendarEventId: response.data.id
    });

    return response.data;
  } catch (err: any) {
    logger.error("CALENDAR", "Google Calendar event creation failed", { professionalId: maskUid(professionalId), error: err });
  }
}

export default router;
