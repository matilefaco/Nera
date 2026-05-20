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
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(400).json({ error: "Configuração do Google Calendar pendente no ambiente." });
  }

  const uid = req.uid;
  const professionalIdQuery = req.query.professionalId as string;
  if (professionalIdQuery && professionalIdQuery !== uid) {
    return res.status(403).json({ error: "Permissão negada" });
  }
  
  const professionalId = uid;

  if (!professionalId) {
    return res.status(400).json({ error: "Missing professionalId" });
  }

  const redirectUri = (process.env.GOOGLE_REDIRECT_URI || `${PUBLIC_APP_URL.replace(/\/+$/, "")}/api/calendar/callback`).trim();
  const oauth2Client = getOAuthClient(redirectUri);

  // Generate secure state
  const state = crypto.randomUUID();
  const db = getDb();
  
  try {
    await db.collection("oauth_states").doc(state).set({
      uid: professionalId,
      provider: "google_calendar",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      used: false
    });
  } catch (err) {
    logger.error("CALENDAR", "Failed to persist OAuth state", { professionalId: maskUid(professionalId), error: err });
    return res.status(500).json({ error: "Erro ao iniciar autenticação" });
  }

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline", // Required to get refresh_token
    scope: SCOPES,
    prompt: "consent", // Force consent to ensure refresh_token is provided every time for safety during dev
    state: state, // Pass the secure random state
  });

  res.json({ url: url.trim() });
});

// 2. OAuth Callback
router.get("/callback", async (req, res) => {
  const db = getDb();
  const { code, state: stateParam } = req.query;
  const stateStr = stateParam as string;
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI || `${PUBLIC_APP_URL.replace(/\/+$/, "")}/api/calendar/callback`).trim();
  const appUrl = PUBLIC_APP_URL.trim();

  if (!code || !stateStr) {
    const safeError = JSON.stringify("Missing code or state");
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'CALENDAR_AUTH_ERROR', error: ${safeError} }, '${appUrl}');
              window.close();
            } else {
              window.location.href = '${appUrl}/profile?calendarAuth=error';
            }
          </script>
        </body>
      </html>
    `);
  }

  try {
    // Validate state
    const stateDoc = await db.collection("oauth_states").doc(stateStr).get();
    
    if (!stateDoc.exists) {
      throw new Error("Solicitação de autenticação inválida ou expirada (state not found)");
    }
    
    const stateData = stateDoc.data();
    if (!stateData || stateData.provider !== "google_calendar" || stateData.used || stateData.expiresAt < Date.now()) {
      throw new Error("Solicitação de autenticação inválida, já utilizada ou expirada");
    }
    
    const professionalId = stateData.uid;

    // Mark state as used immediately
    await db.collection("oauth_states").doc(stateStr).update({ used: true });

    const oauth2Client = getOAuthClient(redirectUri);
    const { tokens } = await oauth2Client.getToken(code as string);

    // Save tokens to Firestore
    await db.collection("users").doc(professionalId).update({
      "integrations.google_calendar": {
        tokens,
        connectedAt: new Date().toISOString(),
        enabled: true,
      },
    });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'CALENDAR_AUTH_SUCCESS' }, '${appUrl}');
              window.close();
            } else {
              window.location.href = '${appUrl}/profile?calendarAuth=success';
            }
          </script>
          <p>Conexão realizada com sucesso! Redirecionando...</p>
        </body>
      </html>
    `);
  } catch (err: any) {
    logger.error("CALENDAR", "Failed to process OAuth callback", { requestId: req.requestId, state: stateStr, error: err });
    const safeError = JSON.stringify(String(err?.message || "Erro desconhecido"));
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'CALENDAR_AUTH_ERROR', error: ${safeError} }, '${appUrl}');
              window.close();
            } else {
              window.location.href = '${appUrl}/profile?calendarAuth=error&error=erro';
            }
          </script>
        </body>
      </html>
    `);
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
