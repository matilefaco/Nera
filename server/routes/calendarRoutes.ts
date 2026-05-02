import express from "express";
import { google } from "googleapis";
import { db } from "../firebaseAdmin.js";

const router = express.Router();

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function getOAuthClient(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

// 1. Get Auth URL
router.get("/auth-url", (req, res) => {
  const professionalId = req.query.professionalId as string;
  const origin = (req.headers.origin || process.env.APP_URL || "").replace(/\/+$/, "");

  if (!professionalId) {
    return res.status(400).json({ error: "Missing professionalId" });
  }

  const redirectUri = `${origin}/api/calendar/callback`;
  const oauth2Client = getOAuthClient(redirectUri);

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline", // Required to get refresh_token
    scope: SCOPES,
    prompt: "consent", // Force consent to ensure refresh_token is provided every time for safety during dev
    state: professionalId, // Pass professionalId through state
  });

  res.json({ url });
});

// 2. OAuth Callback
router.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  const professionalId = state as string;
  const origin = `${req.protocol}://${req.get("host")}`.replace(/\/+$/, "");
  const redirectUri = `${origin}/api/calendar/callback`;

  if (!code || !professionalId) {
    return res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'CALENDAR_AUTH_ERROR', error: 'Missing code or state' }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  }

  try {
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
            window.opener.postMessage({ type: 'CALENDAR_AUTH_SUCCESS' }, '*');
            window.close();
          </script>
          <p>Conexão realizada com sucesso! Você já pode fechar esta janela.</p>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("[CALENDAR CALLBACK ERROR]", err.message);
    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'CALENDAR_AUTH_ERROR', error: '${err.message}' }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  }
});

// 3. Status and Toggle
router.get("/status", async (req, res) => {
  const professionalId = req.query.professionalId as string;

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
    res.status(500).json({ error: err.message });
  }
});

router.post("/toggle", async (req, res) => {
  const { professionalId, enabled } = req.body;

  if (!professionalId) {
    return res.status(400).json({ error: "Missing professionalId" });
  }

  try {
    await db.collection("users").doc(professionalId).update({
      "integrations.google_calendar.enabled": enabled,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/disconnect", async (req, res) => {
  const { professionalId } = req.body;

  if (!professionalId) {
    return res.status(400).json({ error: "Missing professionalId" });
  }

  try {
    await db.collection("users").doc(professionalId).update({
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
  try {
    const userDoc = await db.collection("users").doc(professionalId).get();
    const integration = userDoc.data()?.integrations?.google_calendar;

    if (!integration || !integration.tokens || !integration.enabled) {
      console.log(`[CALENDAR] Skipping event creation for user ${professionalId} (Integration disabled)`);
      return;
    }

    const oauth2Client = getOAuthClient(""); // redirectUri doesn't matter for operations
    oauth2Client.setCredentials(integration.tokens);

    // Refresh token if needed
    oauth2Client.on("tokens", (tokens) => {
      if (tokens.refresh_token) {
        // Updated refresh token
        db.collection("users").doc(professionalId).update({
          "integrations.google_calendar.tokens": tokens
        });
      }
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

    console.log(`[CALENDAR] Event created: ${response.data.htmlLink}`);
    
    // Save event ID to appointment
    await db.collection("appointments").doc(appointment.id).update({
      googleCalendarEventId: response.data.id
    });

    return response.data;
  } catch (err: any) {
    console.error("[GOOGLE CALENDAR EVENT FAILED]", err.message);
  }
}

export default router;
