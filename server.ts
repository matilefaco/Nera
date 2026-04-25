import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { 
  sendBookingPendingEmail, 
  sendProfessionalNewBookingEmail,
  sendConfirmationRequest24hEmail,
  sendRetentionEmail,
  sendBookingConfirmedEmail,
  sendBookingCancelledEmail,
  sendReviewRequestEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendWaitlistInviteEmail,
  sendBookingRescheduledEmail,
  sendBookingReminder24hEmail
} from "./server/emails/sendEmail.ts";
import { sendWhatsApp, normalizePhone, validateBrazilPhone, sendTestWhatsApp, handleInboundMessage } from "./server/services/whatsappService.ts";
function sendRawEmail(...args: any[]) { console.warn("sendRawEmail is deprecated"); return { success: false }; }
import { GoogleAuth } from "google-auth-library";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

dotenv.config();

// Helper to format Brazilian phone numbers for WhatsApp Cloud API
function formatBRNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 || cleaned.length === 11) {
    return '55' + cleaned;
  }
  return cleaned;
}

/**
 * Unified Email Guard
 * Prevents duplicate emails for the same event on an appointment.
 */
async function shouldSendEmail(appointmentId: string, eventKey: string): Promise<boolean> {
  if (!appointmentId) return true; // Can't track if no ID
  
  try {
    const doc = await db.collection('appointments').doc(appointmentId).get();
    if (!doc.exists) return true;
    
    const data = doc.data();
    if (data?.emailEvents?.[eventKey]) {
      console.log(`[EMAIL_SKIP_DUPLICATE] Event ${eventKey} already sent for ${appointmentId}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[EMAIL_GUARD_ERROR]', err);
    return true; // Send anyway on error to be safe? Or false to be safe? User says "Avoid duplicate", let's be careful.
  }
}

async function markEmailSent(appointmentId: string, eventKey: string) {
  if (!appointmentId) return;
  try {
    await db.collection('appointments').doc(appointmentId).update({
      [`emailEvents.${eventKey}`]: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error('[EMAIL_MARK_ERROR]', err);
  }
}

// WhatsApp Notification Handler (Official Meta Cloud API)
async function sendWhatsAppMeta(to: string, message: string) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    console.warn('[WhatsApp-Meta] Configuration missing (META_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID)');
    return false;
  }

  const formattedTo = formatBRNumber(to);
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: formattedTo,
        type: "text",
        text: {
          body: message
        }
      })
    });
    return resp.ok;
  } catch (err) {
    console.warn('[WhatsApp-Meta] Request failed:', err);
    return false;
  }
}

// Legacy WhatsApp Notification Handler (CallMeBot)
async function sendWhatsAppNotification(phone: string, message: string, apiKey: string) {
  try {
    const encodedMsg = encodeURIComponent(message);
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedMsg}&apikey=${apiKey}`;
    const resp = await fetch(url);
    return resp.ok;
  } catch (err) {
    console.warn('[WhatsApp] CallMeBot notification failed:', err);
    return false;
  }
}

  // Simple In-memory Rate Limiter for AI Generation
  const aiRateLimit = new Map<string, { count: number, lastReset: number }>();
  const RATE_LIMIT_WINDOW = 60 * 1000;
  const MAX_REQUESTS = 10;

  // NVIDIA AI Helper
  async function callNvidiaAI(messages: any[], options: { model?: string, temperature?: number, max_tokens?: number } = {}) {
    const model = options.model || "meta/llama-3.1-8b-instruct";
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const startTime = Date.now();
    
    if (!nvidiaKey) throw new Error("Missing NVIDIA_API_KEY");

    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${nvidiaKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens ?? 512
          }),
          signal: controller.signal
        });

        clearTimeout(timeout);
        const latency = Date.now() - startTime;

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`NVIDIA Status ${response.status}: ${body}`);
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        
        console.log(`[NVIDIA] model used: ${model}`);
        console.log(`[NVIDIA] latency: ${latency}ms`);
        console.log(`[NVIDIA] success: true`);
        
        return content;
      } catch (err: any) {
        clearTimeout(timeout);
        lastError = err;
        const isTimeout = err.name === 'AbortError';
        console.warn(`[NVIDIA] error (Attempt ${attempt + 1}):`, isTimeout ? "Timeout" : err.message);
        if (attempt === 0) console.log(`[NVIDIA] Retrying...`);
      }
    }

    console.error(`[NVIDIA] final failure:`, lastError.message);
    throw lastError;
  }

// Diagnostic for Runtime Identity
async function getRuntimeIdentity() {
  try {
    const auth = new GoogleAuth();
    const credentials = await auth.getCredentials();
    const projectId = await auth.getProjectId();
    return {
      clientEmail: (credentials as any).client_email || "default-service-account",
      projectId: projectId,
      usingDefault: !process.env.GOOGLE_APPLICATION_CREDENTIALS
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

// Initialize Firebase Admin
let db: admin.firestore.Firestore;
let defaultDb: admin.firestore.Firestore;

const initFirebase = async () => {
  try {
    const identity = await getRuntimeIdentity();
    console.log(`[FIREBASE ADMIN] Runtime Identity:`, identity);
    console.log(`[FIREBASE ADMIN] Target Project: ${firebaseConfig.projectId}`);
    
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log('[FIREBASE ADMIN] initialized = true');
    }

    // Two instances: one for configured DB, one for (default)
    db = getFirestore(firebaseConfig.firestoreDatabaseId);
    defaultDb = getFirestore(); // (default)

    console.log(`[FIREBASE ADMIN] Testing database: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);
    try {
      await db.collection('appointments').limit(1).get();
      console.log(`[FIRESTORE TEST] Success reading from ${firebaseConfig.firestoreDatabaseId || '(default)'}`);
      
      // Start background triggers
      setupBackgroundTriggers();
    } catch (err: any) {
      console.error(`[FIRESTORE TEST] Failed reading from database '${firebaseConfig.firestoreDatabaseId}':`, err.message);
      
      console.log(`[FIREBASE ADMIN] Attempting fallback to (default) database...`);
      try {
        await defaultDb.collection('appointments').limit(1).get();
        console.log(`[FIRESTORE TEST] Success reading from (default) database!`);
        console.warn(`[FIREBASE ADMIN] CRITICAL: Swapping 'db' instance to (default) because the configured one failed.`);
        db = defaultDb; // SWAP for the entire application
        
        // Start background triggers with the fallback db
        setupBackgroundTriggers();
      } catch (defaultErr: any) {
        console.error(`[FIRESTORE TEST] Failed reading from (default) database as well:`, defaultErr.message);
      }
    }
  } catch (err: any) {
    console.error('[FIREBASE ADMIN] Critical Initialization Error:', err.message);
  }
};

initFirebase();

// --- BACKGROUND TRIGGERS (OBSERVER PATTERN) ---
const emailQueue: string[] = [];
let isProcessingQueue = false;

const processEmailQueue = async () => {
  if (isProcessingQueue || emailQueue.length === 0) return;
  isProcessingQueue = true;

  while (emailQueue.length > 0) {
    const id = emailQueue.shift();
    if (!id) continue;

    console.log(`[AUTO CONFIRM EMAIL] Processing queue item: ${id}`);
    
    try {
      const doc = await db.collection('appointments').doc(id).get();
      if (!doc.exists) continue;
      
      const data = doc.data();
      if (!data) continue;

      // Status check (re-verify status hasn't changed while in queue)
      const isConfirmed = data.status === 'confirmed' || data.status === 'accepted';
      const eventKey = 'bookingConfirmedClient';
      
      if (!isConfirmed) continue;
      
      // Duplicate Protection (Check both new event log and legacy flag)
      const alreadySentLegacy = data.emailConfirmationSent === true;
      if (data.emailEvents?.[eventKey] || alreadySentLegacy) {
        console.log(`[EMAIL_SKIP_DUPLICATE] ${eventKey} already sent for ${id}`);
        // If it was legacy, mark it in the new system too
        if (alreadySentLegacy && !data.emailEvents?.[eventKey]) {
          await markEmailSent(id, eventKey);
        }
        continue;
      }

      if (!data.clientEmail) {
        console.warn(`[AUTO CONFIRM EMAIL] skipped for ${id}: missing clientEmail`);
        await markEmailSent(id, eventKey);
        continue;
      }

      // Fetch professional info
      const proDoc = await db.collection('users').doc(data.professionalId).get();
      const pro = proDoc.exists ? proDoc.data() : null;

      console.log(`[AUTO CONFIRM EMAIL] sending to ${data.clientEmail}...`);
      
      const result = await sendBookingConfirmedEmail({
        clientName: data.clientName,
        serviceName: data.serviceName,
        date: data.date,
        time: data.time,
        location: data.locationType === 'home' ? `Domicílio (${data.neighborhood})` : 'Estúdio / Local Fixo',
        clientEmail: data.clientEmail,
        professionalName: pro?.name || 'Sua Profissional',
        professionalEmail: pro?.email || '',
        bookingId: id
      });

      if (result.success) {
        console.log(`[AUTO CONFIRM EMAIL] success for ${id} (ID: ${result.id})`);
        await markEmailSent(id, eventKey);
      } else {
        const isPermanentError = result.error?.includes('verify a domain') || result.error?.includes('validation_error');
        console.warn(`[AUTO CONFIRM EMAIL] failed for ${id}: ${result.error || 'Unknown transport error'}`);
        
        if (isPermanentError) {
          console.log(`[AUTO CONFIRM EMAIL] marking as "sent" (Skipped/Permanent Error) for ${id}`);
          await markEmailSent(id, eventKey);
        }
      }
    } catch (err: any) {
      console.error(`[AUTO CONFIRM EMAIL] fatal error for ${id}:`, err.message || err);
    }

    // Rate limit safeguard: wait 1 second between emails
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  isProcessingQueue = false;
};

const setupBackgroundTriggers = () => {
  console.log('[AUTO CONFIRM EMAIL] Initializing background listener for appointments...');
  
  // Guard to avoid sending emails for existing historical confirmed bookings on cold start
  const serverStartTime = Date.now();
  
  db.collection('appointments').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async (change) => {
      // We only care about added or modified (status transitions)
      if (change.type === 'removed') return;

      const data = change.doc.data();
      const id = change.doc.id;
      const status = data.status;

      // TRIGGER: Confirmation Email
      const isConfirmed = status === 'confirmed' || status === 'accepted';
      const alreadySent = data.emailConfirmationSent === true || data.emailEvents?.bookingConfirmedClient === true;

      if (isConfirmed && !alreadySent) {
        // Additional safety: don't process very old appointments if they somehow trigger an 'added' event
        const createdAtStr = data.createdAt; // ISO string
        if (createdAtStr) {
          const createdAt = new Date(createdAtStr).getTime();
          if (Date.now() - serverStartTime < 30000 && Date.now() - createdAt > 86400000) {
            console.log(`[AUTO CONFIRM EMAIL] skipping historical confirmed appointment: ${id}`);
            await db.collection('appointments').doc(id).update({ emailConfirmationSent: true }).catch(() => {});
            return;
          }
        }

        // Add to queue if not already there
        if (!emailQueue.includes(id)) {
          console.log(`[AUTO CONFIRM EMAIL] Adding ${id} to background queue (Status: ${status})`);
          emailQueue.push(id);
          processEmailQueue();
        }
      }
    });
  }, (error) => {
    console.error('[AUTO CONFIRM EMAIL] Snapshot listener error:', error);
  });
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- DIAGNOSTIC ENDPOINT FOR EMAILS ---
  app.get("/api/debug-booking-email", async (req, res) => {
    try {
      const { appointmentId } = req.query;
      const debugInfo: any = {
        timestamp: new Date().toISOString(),
        env: {
          resendKeyPresent: !!process.env.RESEND_API_KEY,
          emailFrom: process.env.EMAIL_FROM || "Nera <agenda@usenera.com>",
          appUrl: process.env.APP_URL,
          nodeEnv: process.env.NODE_ENV
        }
      };

      if (appointmentId) {
        debugInfo.appointmentId = appointmentId;
        const apptDoc = await db.collection('appointments').doc(appointmentId as string).get();
        if (apptDoc.exists) {
          const data = apptDoc.data();
          debugInfo.appointment = {
            status: data?.status,
            clientEmail: data?.clientEmail,
            clientName: data?.clientName,
            token: !!data?.token,
            professionalId: data?.professionalId
          };

          if (data?.professionalId) {
            const proDoc = await db.collection('users').doc(data.professionalId).get();
            if (proDoc.exists) {
              debugInfo.professional = {
                email: proDoc.data()?.email,
                name: proDoc.data()?.name
              };
            }
          }
        } else {
          debugInfo.error = "Appointment not found in Firestore";
        }
      }

      res.json(debugInfo);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- NEW: DIAGNOSTIC ENDPOINT FOR CONFIRMATION FLOW ---
  app.get("/api/debug-confirmation-email", async (req, res) => {
    try {
      const { appointmentId } = req.query;
      if (!appointmentId) return res.status(400).json({ error: "Missing appointmentId" });

      process.stdout.write(`[FIRESTORE READ] Attempting to read appointments/${appointmentId}... `);
      const apptDoc = await db.collection('appointments').doc(appointmentId as string).get();
      
      if (!apptDoc.exists) {
        console.log('FAILED (not found)');
        return res.status(404).json({ error: "Appointment not found" });
      }
      console.log('SUCCESS');

      const data = apptDoc.data();
      const result: any = {
        appointmentId,
        currentStatus: data?.status,
        clientEmail: data?.clientEmail,
        professionalId: data?.professionalId,
        token: data?.token,
        hasToken: !!data?.token,
        clientName: data?.clientName,
        shouldSendConfirmationEmail: (data?.status === 'confirmed' || data?.status === 'accepted') && !!data?.clientEmail,
        reason: ""
      };

      if (data?.status !== 'confirmed' && data?.status !== 'accepted') result.reason = `Status is '${data?.status}', not 'confirmed'. `;
      if (!data?.clientEmail) result.reason += "Missing clientEmail. ";
      if (!data?.token) result.reason += "Missing token. ";
      
      if (data?.professionalId) {
        process.stdout.write(`[FIRESTORE READ] Attempting to read users/${data.professionalId}... `);
        const proDoc = await db.collection('users').doc(data.professionalId).get();
        if (proDoc.exists) {
          console.log('SUCCESS');
          result.professionalEmail = proDoc.data()?.email;
        } else {
          console.log('FAILED (not found)');
        }
      }

      res.json(result);
    } catch (err: any) {
      console.error('[FIRESTORE ERROR]', err.message);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  // --- NEW: EXECUTION ENDPOINT FOR CONFIRMATION EMAIL ---
  app.get("/api/run-confirmation-email", async (req, res) => {
    const { appointmentId, token: queryToken } = req.query;
    const response: any = {
      receivedAppointmentId: appointmentId || null,
      receivedToken: queryToken || null,
      firestoreDocFound: false,
      realDocumentId: null,
      validationPassed: false,
      sendAttempted: false,
      resendSuccess: false,
      payloadUsed: null,
      token: null,
      bookingId: null,
      publicId: null
    };

    try {
      if (!appointmentId && !queryToken) throw new Error("Missing appointmentId or token");

      let apptDoc: any = null;
      let apptRef: any = null;

      if (appointmentId) {
        apptRef = db.collection('appointments').doc(appointmentId as string);
        const apptSnap = await apptRef.get();
        if (apptSnap.exists) {
          apptDoc = apptSnap.data();
          response.firestoreDocFound = true;
          response.realDocumentId = apptSnap.id;
        }
      }

      // Fallback: Search by token if not found by ID or if ID looks like a token
      if (!apptDoc && (queryToken || appointmentId)) {
        const tokenToSearch = queryToken || appointmentId;
        const qToken = await db.collection('appointments').where('token', '==', tokenToSearch).limit(1).get();
        if (!qToken.empty) {
          apptRef = qToken.docs[0].ref;
          apptDoc = qToken.docs[0].data();
          response.firestoreDocFound = true;
          response.realDocumentId = qToken.docs[0].id;
          process.stdout.write(`[DEBUG RUN] Found appointment by token: ${qToken.docs[0].id}\n`);
        }
      }

      if (!apptDoc) {
        response.reason = "Appointment not found by ID or Token";
        return res.status(404).json(response);
      }

      response.token = apptDoc.token || "MISSING";
      response.bookingId = response.realDocumentId;
      response.clientEmail = apptDoc.clientEmail || "MISSING";
      response.createdAt = apptDoc.createdAt ? (apptDoc.createdAt.toDate ? apptDoc.createdAt.toDate().toISOString() : apptDoc.createdAt) : "MISSING";
      response.publicId = apptDoc.token ? `token_${apptDoc.token.substring(0, 5)}` : "N/A";

      const data = apptDoc;
      const proId = data?.professionalId;
      if (!proId) throw new Error("Missing professionalId in appointment");

      const proSnap = await db.collection('users').doc(proId).get();
      const pro = proSnap.exists ? proSnap.data() : null;

      const payload = {
        clientName: data?.clientName,
        serviceName: data?.serviceName,
        date: data?.date,
        time: data?.time,
        location: data?.locationType === 'home' ? `Domicílio (${data?.neighborhood})` : 'Estúdio / Local Fixo',
        clientEmail: data?.clientEmail,
        professionalName: pro?.name || 'Sua Profissional',
        professionalEmail: pro?.email || '',
        bookingId: response.realDocumentId,
        token: data?.token
      };
      response.payloadUsed = payload;

      // Validation
      if (!payload.clientEmail) throw new Error("Validation Failed: Missing clientEmail");
      if (!payload.token) throw new Error("Validation Failed: Missing token");
      
      const statusOk = (data?.status === 'confirmed' || data?.status === 'accepted');
      if (!statusOk) {
        process.stdout.write(`[DEBUG RUN] Warning: Status is ${data?.status}\n`);
        response.statusWarning = `Status is ${data?.status}, expected confirmed/accepted`;
      }
      response.validationPassed = true;

      // Send
      response.sendAttempted = true;
      const result = await sendBookingConfirmedEmail(payload);
      
      if (result.success) {
        response.resendSuccess = true;
        response.resendId = result.id;
        return res.json(response);
      } else {
        throw new Error(result.error || "Unknown Resend error");
      }

    } catch (err: any) {
      console.error(`[DEBUG RUN] Failed:`, err.message);
      response.error = err.message;
      return res.status(400).json(response);
    }
  });

  // --- NEW: FULL AUDIT ENDPOINT ---
  app.get("/api/debug-confirmation-email-full", async (req, res) => {
    const { appointmentId } = req.query;
    const audit: any = {
      routeHit: true,
      dataLoaded: false,
      validationPassed: false,
      shouldSendConfirmationEmail: false,
      sendFunctionCalled: false,
      resendAttempted: false,
      resendSuccess: false,
      exactFailureStep: "init"
    };

    try {
      if (!appointmentId) {
        audit.exactFailureStep = "missing_id";
        return res.status(400).json(audit);
      }

      audit.exactFailureStep = "loading_data";
      const apptSnap = await db.collection('appointments').doc(appointmentId as string).get();
      if (!apptSnap.exists) {
        audit.exactFailureStep = "appointment_not_found";
        return res.status(404).json(audit);
      }
      audit.dataLoaded = true;

      const data = apptSnap.data();
      const proSnap = await db.collection('users').doc(data?.professionalId).get();
      const pro = proSnap.exists ? proSnap.data() : null;

      audit.exactFailureStep = "validating";
      const hasEmail = !!data?.clientEmail;
      const hasToken = !!data?.token;
      const isConfirmed = data?.status === 'confirmed' || data?.status === 'accepted';
      
      audit.validationPassed = hasEmail && hasToken;
      audit.shouldSendConfirmationEmail = audit.validationPassed && isConfirmed;

      if (!audit.validationPassed) {
        audit.exactFailureStep = !hasEmail ? "missing_client_email" : "missing_token";
        return res.status(200).json(audit);
      }

      audit.exactFailureStep = "calling_function";
      audit.sendFunctionCalled = true;
      audit.resendAttempted = true;

      const result = await sendBookingConfirmedEmail({
        clientName: data?.clientName,
        serviceName: data?.serviceName,
        date: data?.date,
        time: data?.time,
        location: data?.locationType === 'home' ? `Domicílio (${data?.neighborhood})` : 'Estúdio / Local Fixo',
        clientEmail: data?.clientEmail,
        professionalName: pro?.name || 'Sua Profissional',
        professionalEmail: pro?.email || '',
        bookingId: appointmentId as string,
        token: data?.token
      });

      audit.resendSuccess = result.success;
      audit.resendId = result.id;
      audit.exactFailureStep = "completed";
      res.json(audit);

    } catch (err: any) {
      audit.resendError = err.message;
      res.status(500).json(audit);
    }
  });

  // --- NEW: ADVANCED FIRESTORE DIAGNOSTIC ---
  app.get("/api/debug-firestore-access", async (req, res) => {
    try {
      const identity = await getRuntimeIdentity();
      const report: any = {
        timestamp: new Date().toISOString(),
        identity,
        config: {
          configProjectId: firebaseConfig.projectId,
          configDatabaseId: firebaseConfig.firestoreDatabaseId || "(default)"
        },
        tests: []
      };

      // Test 1: Configured Database
      const test1: any = { collection: 'appointments', database: firebaseConfig.firestoreDatabaseId || "(default)" };
      try {
        const snap = await db.collection('appointments').limit(1).get();
        test1.success = true;
        test1.count = snap.size;
      } catch (err: any) {
        test1.success = false;
        test1.error = err.message;
        test1.details = "This error confirms the backend can't read this specific database.";
      }
      report.tests.push(test1);

      // Test 2: (default) Database
      const test2: any = { collection: 'appointments', database: "(default)" };
      try {
        const snap = await defaultDb.collection('appointments').limit(1).get();
        test2.success = true;
        test2.count = snap.size;
      } catch (err: any) {
        test2.success = false;
        test2.error = err.message;
      }
      report.tests.push(test2);

      // IAM Summary
      if (!test1.success && !test2.success) {
        report.diagnosis = "TOTAL ACCESS DENIED. The Service Account (listed in identity) lacks 'Cloud Datastore User' role in GCP.";
      } else if (!test1.success && test2.success) {
        report.diagnosis = "PARTIAL ACCESS. The Service Account has access to (default) but NOT to specifically named database. Consider using (default) or updating IAM roles for the specific database ID.";
      }

      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- NEW: DIAGNOSTIC ENDPOINT FOR SLOT LOCKS ---
  // --- NEW: DIAGNOSTIC ENDPOINT FOR SLOT LOCKS ---
  app.get("/api/fix-duplicate-slots", async (req, res) => {
    try {
      const { professionalId } = req.query;
      if (!professionalId) return res.status(400).json({ error: "Missing professionalId" });

      console.log(`[FIX DUPLICATES] Scanning for ${professionalId}...`);
      
      const apptsSnap = await db.collection('appointments')
        .where('professionalId', '==', professionalId)
        .where('status', 'in', ['confirmed', 'accepted', 'completed'])
        .get();

      const slots: Record<string, any[]> = {};
      apptsSnap.docs.forEach(doc => {
        const data = doc.data();
        const key = `${data.date}_${data.time}`;
        if (!slots[key]) slots[key] = [];
        slots[key].push({ id: doc.id, ...data });
      });

      const fixed = [];
      const conflicts = [];
      const errors = [];

      for (const [key, apps] of Object.entries(slots)) {
        // Sort apps by createdAt to pick the first one
        apps.sort((a, b) => {
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
          return timeA - timeB;
        });

        const winner = apps[0];
        const losers = apps.slice(1);

        // Try to create lock for the winner
        const cleanTime = (winner.time || '').replace(':', '');
        const lockId = `${professionalId}_${winner.date}_${cleanTime}`;
        try {
          await db.collection('booking_locks').doc(lockId).set({
            professionalId,
            date: winner.date,
            time: winner.time,
            appointmentId: winner.id,
            serviceId: winner.serviceId || 'unknown',
            status: winner.status,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          fixed.push({ lockId, appointmentId: winner.id });
        } catch (err: any) {
          errors.push({ lockId, error: err.message });
        }

        // Flag losers as conflicts
        for (const loser of losers) {
          try {
            await db.collection('appointments').doc(loser.id).update({
              status: 'pending_conflict', // specific status for manual resolution
              conflictReason: `Conflito com a reserva ${winner.id}`,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            conflicts.push({ id: loser.id, key });
          } catch (err: any) {
            errors.push({ id: loser.id, error: err.message });
          }
        }
      }

      res.json({
        totalCheckedSlots: Object.keys(slots).length,
        fixedLocksCount: fixed.length,
        conflictsFoundCount: conflicts.length,
        fixed,
        conflicts,
        errors
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/debug-slot-lock", async (req, res) => {
    try {
      const { professionalId, date, time } = req.query;
      if (!professionalId || !date || !time) return res.status(400).json({ error: "Missing parameters" });

      const cleanTime = (time as string).replace(':', '');
      const lockId = `${professionalId}_${date}_${cleanTime}`;
      const lockDoc = await db.collection('booking_locks').doc(lockId).get();
      
      const apptsSnap = await db.collection('appointments')
        .where('professionalId', '==', professionalId)
        .where('date', '==', date)
        .where('time', '==', time)
        .get();

      const allApps = apptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const activeApps = allApps.filter((a: any) => ['confirmed', 'accepted', 'completed', 'pending_conflict'].includes(a.status));
      const pendingApps = allApps.filter((a: any) => a.status === 'pending');

      res.json({
        lockId,
        lockExists: lockDoc.exists,
        lockData: lockDoc.exists ? lockDoc.data() : null,
        activeAppointmentsAtSlot: activeApps,
        pendingAppointmentsAtSlot: pendingApps,
        duplicateCount: activeApps.length
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- NEW: ATOMIC APPOINTMENT CONFIRMATION ENDPOINT ---
  app.post("/api/appointments/:appointmentId/confirm", async (req, res) => {
    const { appointmentId } = req.params;
    const { professionalId } = req.body;

    console.log(`[CONFIRM APPOINTMENT] Request received for ${appointmentId} from ${professionalId}`);

    if (!professionalId) {
      return res.status(400).json({ error: "Dados incompletos: professionalId ausente" });
    }

    try {
      console.log(`[CONFIRM ENDPOINT HIT] appointmentId: ${appointmentId}, professionalId: ${professionalId}`);
      
      const result = await db.runTransaction(async (transaction) => {
        const apptRef = db.collection('appointments').doc(appointmentId);
        const apptDoc = await transaction.get(apptRef);

        if (!apptDoc.exists) {
          console.error(`[CONFIRM TRANSACTION] Appointment ${appointmentId} NOT FOUND`);
          throw { status: 404, message: "Reserva não encontrada." };
        }

        const data = apptDoc.data();
        if (!data) {
          console.error(`[CONFIRM TRANSACTION] Appointment ${appointmentId} has NO DATA`);
          throw { status: 400, message: "Dados da reserva inválidos." };
        }

        console.log(`[CONFIRM PRECHECK]`, {
          appointmentId: appointmentId,
          professionalId: data.professionalId,
          serviceId: data.serviceId,
          date: data.date || data.appointmentDate || data.selectedDate || data.scheduledDate,
          time: data.time || data.appointmentTime || data.selectedTime || data.startTime,
          status: data.status,
          clientName: data.clientName
        });

        // Permission check
        if (data.professionalId !== professionalId) {
          console.error(`[CONFIRM TRANSACTION] Permission Denied: Appt proId=${data.professionalId}, Payload proId=${professionalId}`);
          throw { status: 403, message: "Você não tem permissão para confirmar esta reserva." };
        }

        // Extract date and time with fallbacks
        const dateAttr = data.date || data.appointmentDate || data.selectedDate || data.scheduledDate;
        const timeAttr = data.time || data.appointmentTime || data.selectedTime || data.startTime;

        if (!dateAttr || !timeAttr) {
          console.error(`[CONFIRM TRANSACTION] Missing date/time. date=${dateAttr}, time=${timeAttr}`);
          throw { status: 400, message: `Dados incompletos: ${!dateAttr ? 'date' : 'time'} ausente` };
        }

        // Check for existing lock
        const cleanTime = timeAttr.replace(':', '');
        const lockId = `${data.professionalId}_${dateAttr}_${cleanTime}`;
        const lockRef = db.collection('booking_locks').doc(lockId);
        
        console.log(`[CONFIRM TRANSACTION] Checking lock at: ${lockId}`);
        const lockSnap = await transaction.get(lockRef);

        const blockingStatuses = ['confirmed', 'accepted', 'completed'];

        if (lockSnap.exists) {
          const lockData = lockSnap.data();
          if (lockData && lockData.appointmentId !== appointmentId && blockingStatuses.includes(lockData.status)) {
            console.warn(`[CONFIRM TRANSACTION] FAIL: Slot occupied by ${lockData.appointmentId}`);
            throw { status: 409, message: "Este horário acabou de ser ocupado por outra cliente." };
          }
        }

        // Update Appointment data
        const updatePayload: any = {
          status: "confirmed",
          confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          date: dateAttr,
          time: timeAttr
        };

        console.log(`[CONFIRM TRANSACTION] Updating appointment ${appointmentId}...`);
        transaction.update(apptRef, updatePayload);

        // Create/Update the lock
        console.log(`[CONFIRM TRANSACTION] Creating/Updating lock ${lockId}...`);
        transaction.set(lockRef, {
          professionalId: data.professionalId,
          date: dateAttr,
          time: timeAttr,
          appointmentId: appointmentId,
          serviceId: data.serviceId || 'unknown',
          status: 'confirmed',
          createdAt: lockSnap.exists ? lockSnap.data().createdAt : admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, appointmentId, lockId, status: "confirmed" };
      });

      console.log(`[CONFIRM ENDPOINT SUCCESS] for ${appointmentId}`);
      return res.json(result);

    } catch (err: any) {
      const status = err.status || 500;
      const message = err.message || "Erro interno do servidor";
      
      console.error(`[CONFIRM ENDPOINT ERROR]`, {
        code: status,
        message,
        appointmentId,
        professionalId,
        stack: err.stack
      });

      return res.status(status).json({ error: message, code: status });
    }
  });

  // --- NEW: DIAGNOSTIC ENDPOINT FOR CAN BOOK SLOT ---
  app.get("/api/debug-can-book-slot", async (req, res) => {
    try {
      const { professionalId, serviceId, date, time } = req.query;
      if (!professionalId || !date || !time) return res.status(400).json({ error: "Missing professionalId, date or time" });

      const proDoc = await db.collection('users').doc(professionalId as string).get();
      if (!proDoc.exists) return res.status(404).json({ error: "Professional not found" });
      const pro: any = proDoc.data();

      let serviceDuration = 60;
      if (serviceId) {
        const svcDoc = await db.collection('services').doc(serviceId as string).get();
        if (svcDoc.exists) {
          serviceDuration = Number(svcDoc.data()?.duration) || 60;
        }
      }

      // Fetch appointments
      const apptsSnap = await db.collection('appointments')
        .where('professionalId', '==', professionalId)
        .where('date', '==', date)
        .where('status', 'in', ['confirmed', 'completed', 'accepted'])
        .get();
      const appointments = apptsSnap.docs.map(d => d.data());

      // Fetch blocks
      const blocksSnap = await db.collection('blocked_schedules')
        .where('professionalId', '==', professionalId)
        .get();
      const blocks = blocksSnap.docs.map(d => d.data());

      // Check working hours
      const workingHours = pro.workingHours;
      const dObj = new Date(date as string + 'T12:00:00');
      const dayOfWeek = dObj.getDay();
      const isWorkingDay = workingHours?.workingDays?.includes(dayOfWeek);

      if (!isWorkingDay) {
        return res.json({ canBook: false, reason: "Not a working day", debug: { dayOfWeek, workingDays: workingHours?.workingDays } });
      }

      // Simple overlap logic for debug
      const [h, m] = (time as string).split(':').map(Number);
      const slotStart = h * 60 + m;
      const slotEnd = slotStart + serviceDuration;

      // Check against work hours range
      const [whs, wms] = (workingHours.startTime || '09:00').split(':').map(Number);
      const [whe, wme] = (workingHours.endTime || '18:00').split(':').map(Number);
      const workStart = whs * 60 + wms;
      const workEnd = whe * 60 + wme;

      if (slotStart < workStart || slotEnd > workEnd) {
        return res.json({ canBook: false, reason: "Outside working hours", debug: { slotStart, slotEnd, workStart, workEnd } });
      }

      // Check against appointments
      const conflictingAppt = appointments.find((a: any) => {
        const [ah, am] = a.time.split(':').map(Number);
        const aStart = ah * 60 + am;
        const aEnd = aStart + (Number(a.duration) || 60);
        return Math.max(slotStart, aStart) < Math.min(slotEnd, aEnd);
      });

      if (conflictingAppt) {
        return res.json({ canBook: false, reason: "Conflict with existing appointment", conflictingAppt });
      }

      // Check against blocks
      const conflictingBlock = blocks.find((b: any) => {
        const isFixed = b.date === date;
        const isRecurring = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
        if (!isFixed && !isRecurring) return false;
        
        const [bh, bm] = b.startTime.split(':').map(Number);
        const [beh, bem] = b.endTime.split(':').map(Number);
        const bStart = bh * 60 + bm;
        const bEnd = beh * 60 + bem;
        return Math.max(slotStart, bStart) < Math.min(slotEnd, bEnd);
      });

      if (conflictingBlock) {
        return res.json({ canBook: false, reason: "Conflict with professional block", conflictingBlock });
      }

      res.json({ canBook: true, message: "Slot is available" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- NEW: ROBUST RESERVATION LOOKUP API ---
  app.get("/api/reservation/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      if (!slug) return res.status(400).json({ error: "Missing slug" });

      const slugStr = slug.toLowerCase();
      let appointmentData: any = null;
      let appointmentId: string | null = null;

      // Strategy 1: Check reservation_links (Fastest/New)
      const linkDoc = await db.collection('reservation_links').doc(slugStr).get();
      if (linkDoc.exists) {
        appointmentId = linkDoc.data()?.appointmentId;
        if (appointmentId) {
          const apptDoc = await db.collection('appointments').doc(appointmentId).get();
          if (apptDoc.exists) {
            appointmentData = apptDoc.data();
          }
        }
      }

      // Strategy 2: Fallback query search
      if (!appointmentData) {
        const strategies = ['manageSlug', 'token', 'publicToken', 'manageToken'];
        for (const field of strategies) {
          const q = await db.collection('appointments').where(field, '==', slugStr).limit(1).get();
          if (!q.empty) {
            appointmentId = q.docs[0].id;
            appointmentData = q.docs[0].data();
            break;
          }
        }
      }

      // Strategy 3: Reservation Code (Uppercase)
      if (!appointmentData) {
        const q = await db.collection('appointments').where('reservationCode', '==', slug.toUpperCase()).limit(1).get();
        if (!q.empty) {
          appointmentId = q.docs[0].id;
          appointmentData = q.docs[0].data();
        }
      }

      // Strategy 4: Doc ID
      if (!appointmentData && slug.length >= 20) {
        const q = await db.collection('appointments').doc(slug).get();
        if (q.exists) {
          appointmentId = q.id;
          appointmentData = q.data();
        }
      }

      if (!appointmentData) {
        return res.status(404).json({ found: false, error: "Reservation not found" });
      }

      // Get professional data for context
      const proDoc = await db.collection('users').doc(appointmentData.professionalId).get();
      const proData = proDoc.exists ? proDoc.data() : null;

      // Return sanitized data for client
      res.json({
        found: true,
        appointment: {
          id: appointmentId,
          ...appointmentData,
          professional: proData ? {
            name: proData.name,
            slug: proData.slug,
            whatsapp: proData.whatsapp
          } : null
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- NEW: DIAGNOSTIC ENDPOINT FOR RESERVATION ---
  app.get("/api/debug-reservation", async (req, res) => {
    try {
      const { slug } = req.query;
      if (!slug) return res.status(400).json({ error: "Missing slug or token" });

      const slugStr = slug as string;
      const results: any = { 
        slugReceived: slugStr,
        foundLinkDoc: false,
        appointmentFound: false,
        searchTime: new Date().toISOString()
      };

      const linkDoc = await db.collection('reservation_links').doc(slugStr.toLowerCase()).get();
      if (linkDoc.exists) {
        results.foundLinkDoc = true;
        results.linkDocData = linkDoc.data();
        const apptDoc = await db.collection('appointments').doc(results.linkDocData.appointmentId).get();
        if (apptDoc.exists) {
          results.appointmentFound = true;
          results.appointmentId = apptDoc.id;
          results.appointmentData = apptDoc.data();
        }
      }

      if (!results.appointmentFound) {
        // Broad search
        const q = await db.collection('appointments').where('manageSlug', '==', slugStr.toLowerCase()).limit(1).get();
        if (!q.empty) {
          results.appointmentFound = true;
          results.appointmentId = q.docs[0].id;
          results.appointmentData = q.docs[0].data();
          results.note = "Found via backup query (manageSlug)";
        }
      }

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- NEW: DIAGNOSTIC ENDPOINT FOR RESERVATION TOKEN ---
  app.get("/api/debug-reservation-token", async (req, res) => {
    try {
      const { token } = req.query;
      if (!token) return res.status(400).json({ error: "Missing token" });

      const results: any = { tokenReceived: token };

      // Search by token
      const q1 = await db.collection('appointments').where('token', '==', token).limit(1).get();
      results.foundByToken = !q1.empty;
      
      // Search by publicToken
      const q2 = await db.collection('appointments').where('publicToken', '==', token).limit(1).get();
      results.foundByPublicToken = !q2.empty;

      // Search by manageToken
      const q3 = await db.collection('appointments').where('manageToken', '==', token).limit(1).get();
      results.foundByManageToken = !q3.empty;

      // Search by docId
      const q4 = await db.collection('appointments').doc(token as string).get();
      results.foundByDocId = q4.exists;

      const mainDoc = q1.docs[0] || q2.docs[0] || q3.docs[0] || (q4.exists ? q4 : null);

      if (mainDoc) {
        results.appointmentId = mainDoc.id;
        results.appointmentData = mainDoc.data();
      }

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- NEW: DIAGNOSTIC ENDPOINT FOR NEXT SLOT FULL ---
  app.get("/api/debug-next-slot-full", async (req, res) => {
    try {
      const { professionalId, serviceId } = req.query;
      if (!professionalId) return res.status(400).json({ error: "Missing professionalId" });

      const proDoc = await db.collection('users').doc(professionalId as string).get();
      if (!proDoc.exists) return res.status(404).json({ error: "Professional not found" });
      const pro: any = proDoc.data();

      let serviceDuration = 60;
      if (serviceId) {
        const svcDoc = await db.collection('services').doc(serviceId as string).get();
        if (svcDoc.exists) serviceDuration = Number(svcDoc.data()?.duration) || 60;
      }

      const daysToLook = 14;
      const daysChecked = [];
      const now = new Date();
      
      const appointmentsSnap = await db.collection('appointments')
        .where('professionalId', '==', professionalId)
        .where('status', 'in', ['confirmed', 'completed', 'accepted'])
        .get();
      const allAppts = appointmentsSnap.docs.map(d => d.data());

      const blocksSnap = await db.collection('blocked_schedules')
        .where('professionalId', '==', professionalId)
        .get();
      const allBlocks = blocksSnap.docs.map(d => d.data());

      for (let i = 0; i < daysToLook; i++) {
        const d = new Date();
        d.setDate(now.getDate() + i);
        const dStr = d.toISOString().split('T')[0];
        
        // Use the common logic (minimal version here)
        const workingHours = pro.workingHours;
        const dayOfWeek = d.getDay();
        const isWorkingDay = workingHours?.workingDays?.includes(dayOfWeek);

        if (!isWorkingDay) {
          daysChecked.push({ date: dStr, agendaSlotsCount: 0, reason: "Not a working day" });
          continue;
        }

        // Simulating the generator
        const slots = [];
        const [whs, wms] = (workingHours.startTime || '09:00').split(':').map(Number);
        const [whe, wme] = (workingHours.endTime || '18:00').split(':').map(Number);
        const workStart = whs * 60 + wms;
        const workEnd = whe * 60 + wme;

        for (let curr = workStart; curr < workEnd; curr += 30) {
          const pEnd = curr + serviceDuration;
          if (pEnd > workEnd) break;
          
          if (i === 0) { // Today
             const nowMin = now.getHours() * 60 + now.getMinutes();
             if (curr <= nowMin + 40) continue;
          }

          const hasAppt = allAppts.some((a: any) => {
            if (a.date !== dStr) return false;
            const [ah, am] = a.time.split(':').map(Number);
            const aS = ah * 60 + am;
            const aE = aS + (Number(a.duration) || 60);
            return Math.max(curr, aS) < Math.min(pEnd, aE);
          });

          const hasBlock = allBlocks.some((b: any) => {
            const isF = b.date === dStr;
            const isR = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
            if (!isF && !isR) return false;
            const [bh, bm] = b.startTime.split(':').map(Number);
            const [beh, bem] = b.endTime.split(':').map(Number);
            const bS = bh * 60 + bm;
            const bE = beh * 60 + bem;
            return Math.max(curr, bS) < Math.min(pEnd, bE);
          });

          if (!hasAppt && !hasBlock) {
            const h = Math.floor(curr / 60);
            const m = curr % 60;
            slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
          }
        }

        daysChecked.push({
          date: dStr,
          agendaSlotsCount: slots.length,
          agendaSlots: slots,
          badgeWouldShow: slots.length > 0
        });
      }

      res.json({
        professionalId,
        serviceDuration,
        daysChecked
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/debug-bookable-slots", async (req, res) => {
    try {
      const { professionalId, serviceId, date } = req.query;
      if (!professionalId || !date) return res.status(400).json({ error: "Missing professionalId or date" });

      const proDoc = await db.collection('users').doc(professionalId as string).get();
      if (!proDoc.exists) return res.status(404).json({ error: "Professional not found" });
      const pro: any = proDoc.data();

      let serviceDuration = 60;
      if (serviceId) {
        const svcDoc = await db.collection('services').doc(serviceId as string).get();
        if (svcDoc.exists) {
          const svcData: any = svcDoc.data();
          serviceDuration = Number(svcData.duration) || 60;
        }
      }

      const apptsSnap = await db.collection('appointments')
        .where('professionalId', '==', professionalId)
        .where('date', '==', date)
        .where('status', 'in', ['confirmed', 'completed'])
        .get();
      
      const appointments = apptsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const blocksSnap = await db.collection('blocked_schedules')
        .where('professionalId', '==', professionalId)
        .get();
      const blockedSchedules = blocksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Note: We can't easily run the same local function from here without duplication 
      // but we will return the RAW data to help identify why slots are 0.
      const d = new Date(date as string + 'T12:00:00');
      const dayOfWeek = d.getDay();
      const dayBlocks = blockedSchedules.filter((b: any) => {
        const isFixed = b.date === date;
        const isRecurring = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
        return isFixed || isRecurring;
      });

      res.json({
        professionalId,
        serviceId,
        serviceDuration,
        date,
        workingHours: pro.workingHours,
        isWorkingDay: pro.workingHours?.workingDays?.includes(dayOfWeek),
        appointmentsInDay: appointments.length,
        blocksInDay: dayBlocks.length,
        appointments: appointments.map((a: any) => ({ time: a.time, duration: a.duration })),
        blocks: dayBlocks.map((b: any) => ({ start: b.startTime, end: b.endTime }))
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/debug-email", async (req, res) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || "Nera <agenda@usenera.com>";
    const appUrl = process.env.APP_URL;
    
    res.json({
      resendKeyPresent: !!apiKey,
      resendKeyPrefix: apiKey ? `${apiKey.substring(0, 5)}...` : 'N/A',
      from,
      appUrl: appUrl || 'http://localhost:3000 (fallback)',
      nodeEnv: process.env.NODE_ENV
    });
  });

  app.get("/api/test-email", async (req, res) => {
    console.log('[EMAIL] starting send (Test Endpoint)');
    const target = (req.query.email as string) || "matilefaco@hotmail.com";
    try {
      if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is missing');
      }
      
      const result = await sendProfessionalNewBookingEmail({
        clientName: "Teste Audit",
        serviceName: "Corte de Cabelo (Teste)",
        date: new Date().toISOString().split('T')[0],
        time: "14:00",
        location: "Estúdio Teste",
        totalPrice: "R$ 100,00",
        professionalEmail: target,
        professionalName: "Profissional de Teste",
        bookingId: "test-id-" + Date.now()
      });
      res.json({ status: "Email test sent successfully", result });
    } catch (err: any) {
      console.error('[EMAIL] failed error (Test Endpoint):', err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  app.get("/api/test-email-real", async (req, res) => {
    const target = "matilefaco@hotmail.com";
    const result = await sendRawEmail(
      target,
      "Teste Nera funcionando",
      "Seu sistema de emails está ativo com domínio verificado."
    );
    res.status(result.success ? 200 : 500).json(result);
  });

  app.get("/api/test-email-gmail", async (req, res) => {
    const target = "matilefaco1@gmail.com";
    const result = await sendRawEmail(
      target,
      "Teste Nera GMAIL",
      "Teste de envio oficial para GMAIL através do sistema Nera."
    );
    res.status(result.success ? 200 : 500).json(result);
  });

  app.get("/api/test-email-hotmail-clean", async (req, res) => {
    const target = "matilefaco@hotmail.com";
    const result = await sendRawEmail(
      target,
      "Confirmação Nera",
      "Seu agendamento está confirmado.",
      { 
        isHtml: true, 
        customHtml: `<div style="font-family: sans-serif; padding: 20px;">Olá!<br><br>Seu agendamento no Nera foi confirmado com sucesso.</div>` 
      }
    );
    res.status(result.success ? 200 : 500).json(result);
  });

  app.get("/api/test-email-hotmail-plain", async (req, res) => {
    const target = "matilefaco@hotmail.com";
    const result = await sendRawEmail(
      target,
      "Confirmação Nera",
      "Seu agendamento no Nera foi confirmado com sucesso.",
      { isHtml: false }
    );
    res.status(result.success ? 200 : 500).json(result);
  });

  app.post("/api/generate-content", async (req, res) => {
    const { name, specialty, yearsExperience, serviceStyle, differentials, bioStyle } = req.body;
    
    // Simple rate limit check
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous') as string;
    const now = Date.now();
    const rateData = aiRateLimit.get(ip) || { count: 0, lastReset: now };
    
    if (now - rateData.lastReset > RATE_LIMIT_WINDOW) {
      rateData.count = 1;
      rateData.lastReset = now;
    } else {
      rateData.count++;
    }
    aiRateLimit.set(ip, rateData);

    if (rateData.count > MAX_REQUESTS) {
      return res.status(429).json({ error: "Muitas solicitações. Tente novamente em um minuto." });
    }
    
    if (!process.env.NVIDIA_API_KEY) {
      console.error("[BioAI] NVIDIA_API_KEY is missing in server environment");
      return res.status(500).json({ error: "Configuração de IA ausente." });
    }

    try {
      const prompt = `Você é um especialista em branding para profissionais de beleza brasileiras.
Gere uma bio e um headline para esta profissional:
Nome: ${name}
Especialidade: ${specialty}
Anos de experiência: ${yearsExperience}
Estilo de atendimento: ${serviceStyle}
Diferenciais: ${differentials}
Tom desejado: ${bioStyle} (elegante | natural | direta)

Retorne APENAS um JSON válido, sem markdown, sem explicação, neste formato:
{"bio": "texto aqui", "headline": "texto aqui"}`;

      const content = await callNvidiaAI([
        { role: "user", content: prompt }
      ], { 
        model: "meta/llama-3.1-8b-instruct",
        temperature: 0.5,
        max_tokens: 512
      });
      
      // Attempt to parse JSON from response string
      let parsed;
      try {
        parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
      } catch (e) {
        console.error("[BioAI] JSON parse error from model output:", content);
        throw new Error("Invalid format from AI model");
      }

      res.json(parsed);

    } catch (error: any) {
      console.error("[BioAI] Generation error:", error.message);
      res.status(500).json({ error: "Não foi possível gerar o conteúdo." });
    }
  });

  app.post("/api/analyze-portfolio-image", async (req, res) => {
    const { imageUrl, specialty } = req.body;
    
    if (!process.env.NVIDIA_API_KEY) {
      console.error("[PortfolioAI] NVIDIA_API_KEY is missing");
      return res.json({ category: "Portfólio" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const content = await callNvidiaAI([
        { 
          role: "user", 
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: `Esta é uma foto de portfólio de uma profissional de beleza especializada em ${specialty}. Em no máximo 3 palavras em português, qual procedimento esta foto mostra? Exemplos: 'Design de Sobrancelhas', 'Limpeza de Pele', 'Nail Art', 'Maquiagem', 'Design de Cílios'. Responda APENAS com a categoria, sem pontuação, sem explicação.` }
          ]
        }
      ], { 
        model: "meta/llama-3.1-8b-instruct", // 8b as requested, though vision may need specific check
        temperature: 0.2,
        max_tokens: 50
      });
      
      res.json({ category: content || "Portfólio" });

    } catch (error: any) {
      console.error("[PortfolioAI] error:", error.message);
      res.json({ category: "Portfólio" });
    }
  });

  // --- AI ENDPOINTS ---
  app.get("/api/debug-ai", async (req, res) => {
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const report = {
      nvidiaKeyPresent: !!nvidiaKey,
      nvidiaKeyPrefix: nvidiaKey ? nvidiaKey.substring(0, 8) : 'N/A',
      nvidiaBaseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
      nvidiaModel: "meta/llama-3.1-8b-instruct",
      canReachNvidia: false,
      lastError: null as string | null
    };

    if (nvidiaKey) {
      try {
        const content = await callNvidiaAI([{ role: "user", content: "hi" }], { 
          model: report.nvidiaModel,
          max_tokens: 1
        });
        report.canReachNvidia = !!content;
      } catch (err: any) {
        report.lastError = err.message;
      }
    }

    res.json(report);
  });

  app.get("/api/test-ai-service-description", async (req, res) => {
    const { serviceName } = req.query;
    if (!serviceName) return res.status(400).json({ error: "Missing serviceName" });

    // Mock a body-like request to the actual endpoint logic
    const mockReq = { body: { serviceName, professionalSpecialty: "Beleza", duration: 30, price: 100 } };
    
    // We'll manually call the logic to avoid complex router nesting here
    // But since it's an app, we can just redirect or re-implement
    // For simplicity, I'll implement a clean version here that we'll also use in the POST
    const result = await getServiceDescriptionWithFallback(serviceName as string, "Beleza", 30, 100, "elegante");
    res.json(result);
  });

  // --- WHATSAPP TEST ENDPOINTS ---
  app.get("/api/test-whatsapp", async (req, res) => {
    const { phone, message, type, simulateInbound } = req.query;
    if (!phone) return res.status(400).json({ error: "Missing phone" });
    
    if (simulateInbound === 'true') {
      const result = await handleInboundMessage(db, phone as string, message as string || '1', { simulated: true });
      return res.json(result);
    }

    const targetPhone = phone as string;
    const eventType = (type as string) || 'test_generic';
    let msg = (message as string);

    // Mock data for templating
    const mockData = {
      clientName: "Cliente Teste",
      serviceName: "Design de Sobrancelhas",
      date: "2026-04-26",
      time: "14:00",
      professionalName: "Helena Prado",
      professionalSlug: "helena-prado",
      reviewUrl: "https://nera.app/review/test"
    };

    if (!msg) {
      const formattedDate = mockData.date.split('-').reverse().join('/');
      switch (eventType) {
        case 'NEW_BOOKING':
          msg = `✨ *Novo pedido de agendamento*\n\n*Cliente:* ${mockData.clientName}\n*Serviço:* ${mockData.serviceName}\n*Data:* ${formattedDate}\n*Hora:* ${mockData.time}\n\nAbra o painel do Nera para confirmar.`;
          break;
        case 'CONFIRMED':
          msg = `✨ *Seu horário foi confirmado!*\n\n*Profissional:* ${mockData.professionalName}\n*Serviço:* ${mockData.serviceName}\n*Data:* ${formattedDate}\n*Hora:* ${mockData.time}\n\nResponda:\n1 — Reagendar\n2 — Cancelar\n*Sim* — Confirmar presença\n\nNos vemos em breve 💛`;
          break;
        case 'CANCELLED':
          msg = `Seu agendamento foi cancelado.\nSe desejar, reagende facilmente:\nhttps://nera.app/p/${mockData.professionalSlug}`;
          break;
        case 'REMINDER_24H':
          msg = `✨ *Lembrete do seu atendimento amanhã:*\n\n${mockData.serviceName}\n${formattedDate}\n${mockData.time}\n\nResponda:\n1 — Reagendar\n2 — Cancelar\n*Sim* — Confirmar presença`;
          break;
        case 'REMINDER_2H':
          msg = `Estamos te esperando hoje às ${mockData.time} 💛`;
          break;
        case 'REVIEW':
          msg = `Obrigada por agendar com ${mockData.professionalName} 💛. Sua opinião é muito importante para nós. Se puder, deixe sua avaliação: ${mockData.reviewUrl}`;
          break;
        default:
          msg = "Teste de WhatsApp do sistema Nera 🚀";
      }
    }

    try {
      const result = await sendWhatsApp(db, targetPhone, msg, { 
        type: `simulated_${eventType}`,
        metadata: { isSimulation: true }
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Z-API WEBHOOK ---
  // Configure this URL in Z-API: https://[your-domain]/api/zapi/webhook
  app.post("/api/zapi/webhook", async (req, res) => {
    const payload = req.body;
    console.log("[Z-API Webhook] Received payload:", JSON.stringify(payload));

    // Basic structure check for Z-API
    // Usually msg = payload.text?.message or similar depending on Z-API version/settings
    // Let's handle 'on-message-received'
    if (payload.type === 'on-message-received' || (payload.phone && payload.text)) {
      const phone = payload.phone;
      const message = payload.text?.message || payload.text || "";
      
      if (phone && message) {
        // Run in background
        handleInboundMessage(db, phone, message, payload).catch(err => {
          console.error("[Z-API Webhook] Error processing message:", err);
        });
      }
    }

    // Always respond 200 OK fast
    res.status(200).send("OK");
  });

  app.get("/api/debug-whatsapp", async (req, res) => {
    res.json({
      zapiInstanceId: !!process.env.ZAPI_INSTANCE_ID,
      zapiInstanceToken: !!process.env.ZAPI_INSTANCE_TOKEN || !!process.env.ZAPI_TOKEN,
      zapiClientToken: !!process.env.ZAPI_CLIENT_TOKEN,
      zapiBaseUrl: !!process.env.ZAPI_BASE_URL,
      metaAccessToken: !!process.env.META_ACCESS_TOKEN,
      phoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID
    });
  });

  async function getServiceDescriptionWithFallback(
    serviceName: string, 
    specialty: string, 
    duration: any, 
    price: any, 
    tone: string
  ) {
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const nameLow = serviceName.toLowerCase();
    
    // 1. Semantic Categorization for guard
    const isUnhas = /unha|gel|porcelana|manicure|pedicure|esmaltação|blindagem|nail/.test(nameLow);
    const isCabelo = /cabelo|corte|escova|mecha|tintura|química|fios/.test(nameLow);
    const isSobrancelhaCilio = /sobrancelha|cílio|fio a fio|lash|microbound|henna/.test(nameLow);
    const isEstetica = /pele|limpeza|massagem|estética|facial|corporal/.test(nameLow);

    if (nvidiaKey) {
      try {
        const prompt = `Você é um redator de marketing para profissionais de beleza premium no Brasil.
Gere uma descrição atraente, clara e natural para o serviço "${serviceName}".

REGRAS:
- Máximo 140 caracteres.
- Tom premium e profissional, sem exageros.
- Não use frases genéricas como "obra de arte", "experiência exclusiva" ou "transforme seu olhar".
- Seja específico ao serviço:
  * Se for UNHAS: fale de acabamento, durabilidade, resistência, naturalidade ou cuidado.
  * Se for CABELO: fale de fios, brilho, movimento ou técnica.
  * Se for SOBRANCELHAS/CÍLIOS: pode falar de olhar e harmonia.
  * Se for ESTÉTICA: fale de cuidado com a pele, bem-estar ou resultados.
- Não use emojis.
- Responda apenas com o texto da descrição.`;

        const content = await callNvidiaAI([
          { role: "user", content: prompt }
        ], { 
          model: "meta/llama-3.1-8b-instruct",
          temperature: 0.7,
          max_tokens: 150
        });

        if (content) {
          const contentLow = content.toLowerCase();
          let rejected = false;

          // 2. Semantic Guard: Unhas should not talk about "olhar", etc.
          if (isUnhas && /(olhar|sobrancelha|cílio|pele|cabelo|maquiagem)/.test(contentLow)) {
            console.log(`[AI SERVICE] description rejected by semantic guard: unhas talking about unrelated area. Content: "${content}"`);
            rejected = true;
          }

          if (!rejected) {
            console.log(`[AI SERVICE] NVIDIA success for ${serviceName}`);
            return { success: true, source: "nvidia", description: content };
          }
        }
      } catch (error: any) {
        console.error(`[AI SERVICE] NVIDIA failed in description: ${error.message}`);
      }
    }

    // Fallback Logic
    console.log(`[AI SERVICE] Using fallback for ${serviceName}`);
    
    let description = "Procedimento personalizado focado em realçar sua beleza natural com máxima qualidade.";
    let cat = "geral";
    
    if (nameLow.includes('gel')) {
      description = "Alongamento resistente com acabamento elegante para unhas bonitas por mais tempo.";
      cat = "unhas";
    } else if (nameLow.includes('porcelana')) {
      description = "Alongamento clássico com aparência natural e acabamento sofisticado.";
      cat = "unhas";
    } else if (nameLow.includes('manicure')) {
      description = "Cuidado completo das unhas com acabamento limpo, bonito e delicado.";
      cat = "unhas";
    } else if (nameLow.includes('pedicure')) {
      description = "Cuidado para os pés com acabamento caprichado e sensação de bem-estar.";
      cat = "unhas";
    } else if (isUnhas) {
      description = "Cuidado técnico das unhas com foco em saúde, beleza e durabilidade.";
      cat = "unhas";
    } else if (nameLow.includes('sobrancelha')) {
      description = "Design personalizado para valorizar o olhar com equilíbrio e naturalidade.";
      cat = "sobrancelhas";
    } else if (nameLow.includes('cílio') || nameLow.includes('fio a fio')) {
      description = "Olhar marcante e volume natural com aplicação técnica e acabamento impecável.";
      cat = "cílios";
    } else if (nameLow.includes('limpeza de pele') || isEstetica) {
      description = "Tratamento profundo para remover impurezas e devolver a luminosidade natural da sua face.";
      cat = "estética";
    } else if (isCabelo) {
      description = "Cuidado profissional seguindo seu estilo e visagismo para renovar sua autoestima.";
      cat = "cabelo";
    } else if (nameLow.includes('depilação')) {
      description = "Remoção técnica de pelos proporcionando pele lisa e macia com o menor desconforto possível.";
      cat = "depilação";
    } else if (nameLow.includes('maquiagem') || nameLow.includes('makeup')) {
      description = "Produção completa para eventos destacando seus melhores traços com durabilidade.";
      cat = "maquiagem";
    }

    console.log(`[AI SERVICE] fallback used for category: ${cat}`);
    return { success: true, source: "fallback", description };
  }

  app.post("/api/ai/service-description", async (req, res) => {
    const { serviceName, professionalSpecialty, duration, price, tone } = req.body;
    console.log(`[AI SERVICE] service-description requested for: ${serviceName}`);
    
    const result = await getServiceDescriptionWithFallback(
      serviceName, 
      professionalSpecialty || "Beleza", 
      duration, 
      price, 
      tone
    );
    
    res.json(result);
  });

  app.post("/api/ai/categorize-service", async (req, res) => {
    const { serviceName } = req.body;
    if (!process.env.NVIDIA_API_KEY) {
      console.warn("[AI SERVICE] NVIDIA failed (missing key), using local fallback");
      return res.json({ category: "Outros" });
    }

    try {
      const prompt = `Classifique o serviço "${serviceName}" em uma destas categorias: Unhas, Sobrancelhas, Cílios, Cabelo, Estética, Outros. Responda apenas o nome da categoria.`;
      const content = await callNvidiaAI([{ role: "user", content: prompt }], {
        model: "meta/llama-3.1-8b-instruct",
        temperature: 0.1,
        max_tokens: 20
      });
      res.json({ category: content || "Outros" });
    } catch (error) {
      console.warn("[AI SERVICE] NVIDIA categorization failed, using local fallback");
      res.json({ category: "Outros" });
    }
  });

  app.post("/api/ai/categorize-portfolio-item", async (req, res) => {
    const { title, description } = req.body;
    if (!process.env.NVIDIA_API_KEY) {
      console.warn("[AI SERVICE] NVIDIA failed (missing key), using local fallback");
      return res.json({ category: "Geral" });
    }

    try {
      const prompt = `Classifique este item de portfólio "${title}" (${description || ''}) em uma destas categorias: Unhas, Sobrancelhas, Cílios, Cabelo, Estética, Outros. Responda apenas o nome da categoria.`;
      const content = await callNvidiaAI([{ role: "user", content: prompt }], {
        model: "meta/llama-3.1-8b-instruct",
        temperature: 0.1,
        max_tokens: 20
      });
      res.json({ category: content || "Geral" });
    } catch (error) {
      console.warn("[AI SERVICE] NVIDIA portfolio categorization failed, using local fallback");
      res.json({ category: "Geral" });
    }
  });

  /**
   * Notification Endpoint
   * Handles sending real emails via Resend and WhatsApp via Meta Cloud API.
   */
  app.post("/api/notify", async (req, res) => {
    const { type, payload } = req.body;
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    
    console.log(`[BOOKING FLOW] Processing notification ${type}...`);
    console.log(`[BOOKING FLOW] Full Payload:`, JSON.stringify(payload));

    // FORCED DEBUG EMAIL REMOVED AS REQUESTED
    // If debug is needed, use console.log only
    console.log(`[BOOKING FLOW] Debug Payload for ${type}:`, JSON.stringify(payload, null, 2));

    try {
      if (type === 'BOOKING_PENDING_CLIENT') {
        const { clientEmail, clientName, professionalName, professionalWhatsapp, serviceName, date, time, price, reservationCode, manageUrl, appointmentId, paymentMethods } = payload;
        const eventKey = 'bookingPendingClient';

        if (await shouldSendEmail(appointmentId, eventKey)) {
          const result = await sendBookingPendingEmail({
            clientEmail, clientName, professionalName, professionalWhatsapp,
            serviceName, date, time, price, reservationCode, manageUrl, appointmentId, paymentMethods
          });
          if (result.success) await markEmailSent(appointmentId, eventKey);
          return res.json(result);
        }
        return res.json({ success: true, skipped: 'duplicate' });
      }

      if (type === 'NEW_BOOKING_REQUEST') {
        const { professionalId, clientName, serviceName, date, time, totalPrice, appointmentId, token, paymentMethods } = payload;
        const eventKey = 'professionalNewBooking';

        const userDoc = await db.collection('users').doc(professionalId).get();
        if (!userDoc.exists) throw new Error(`Professional ${professionalId} not found`);
        const pro = userDoc.data();
        const proEmail = pro?.email;
        const proPhone = pro?.whatsapp;

        if (proEmail && await shouldSendEmail(appointmentId, eventKey)) {
          const result = await sendProfessionalNewBookingEmail({
            professionalEmail: proEmail,
            professionalName: pro?.name || 'Profissional',
            clientName, serviceName, date, time,
            price: `R$ ${(totalPrice || payload.price || 0).toFixed(2).replace('.', ',')}`,
            location: payload.locationDetail || payload.neighborhood || 'Estúdio',
            agendaUrl: `${baseUrl}/pedidos`,
            appointmentId,
            paymentMethods
          });
          if (result.success) await markEmailSent(appointmentId, eventKey);
        }

        if (proPhone) {
          const formattedDate = date.split('-').reverse().join('/');
          const msg = `✨ *Novo pedido de agendamento*\n\n` +
                      `*Cliente:* ${clientName}\n` +
                      `*Serviço:* ${serviceName}\n` +
                      `*Data:* ${formattedDate}\n` +
                      `*Hora:* ${time}\n\n` +
                      `Abra o painel do Nera para confirmar:\n` +
                      `${baseUrl}/pedidos?id=${appointmentId}&token=${token}`;

          await sendWhatsApp(db, proPhone, msg, {
            appointmentId,
            userId: professionalId,
            type: 'professional_new_booking'
          });
        }

        return res.json({ success: true });
      }

      if (type === 'BOOKING_REJECTED') {
        const { professionalId, clientName, clientWhatsapp, serviceName, date, time, professionalSlug } = payload;
        
        if (clientWhatsapp) {
          let slug = professionalSlug;
          if (!slug) {
            const proDocSnap = await db.collection('users').doc(professionalId).get();
            slug = proDocSnap.data()?.slug;
          }

          const profileLink = `${baseUrl}/p/${slug || 'app'}`;
          const msg = `Olá ${clientName}, infelizmente esse horário não está disponível. Você pode escolher outro horário no link:\n${profileLink}`;
          
          await sendWhatsApp(db, clientWhatsapp, msg, {
            userId: professionalId,
            type: 'booking_rejected'
          });
        }
        return res.json({ success: true });
      }

      if (type === 'BOOKING_CANCELLED' || type === 'BOOKING_CANCELLED_BY_CLIENT') {
        const { professionalId, clientName, clientEmail, clientWhatsapp, serviceName, date, time, appointmentId, professionalSlug } = payload;
        const eventKeyPro = 'bookingCancelledProfessional';
        const eventKeyClient = 'bookingCancelledClient';

        const proDoc = await db.collection('users').doc(professionalId).get();
        if (proDoc.exists) {
          const pro = proDoc.data();
          const proPhone = pro?.whatsapp;
          
          if (proPhone) {
            const formattedDate = date.split('-').reverse().join('/');
            const msg = `Horário liberado! 🗓️\n\nA reserva de ${clientName} em ${formattedDate} às ${time} foi CANCELADA. Seu horário ficou disponível novamente.`;
            await sendWhatsApp(db, proPhone, msg, {
              appointmentId,
              userId: professionalId,
              type: 'booking_cancelled_pro'
            });
          }

          if (pro?.email && await shouldSendEmail(appointmentId, eventKeyPro)) {
            const result = await sendBookingCancelledEmail({
              clientName, serviceName, date, time, 
              location: '', professionalEmail: pro.email,
              professionalName: pro.name, bookingId: appointmentId || ''
            });
            if (result.success) await markEmailSent(appointmentId, eventKeyPro);
          }

          // WhatsApp for client
          if (clientWhatsapp) {
            const profileLink = `${baseUrl}/p/${professionalSlug || pro.slug}`;
            const msg = `Seu agendamento foi cancelado.\nSe desejar, reagende facilmente:\n${profileLink}`;
            await sendWhatsApp(db, clientWhatsapp, msg, {
              appointmentId,
              userId: professionalId,
              type: 'booking_cancelled_client'
            });
          }

          // Also notify client about cancellation if possible
          if (clientEmail && await shouldSendEmail(appointmentId, eventKeyClient)) {
             const result = await sendBookingCancelledEmail({
                clientName, serviceName, date, time,
                location: '', professionalEmail: clientEmail, 
                professionalName: pro?.name || 'Sua Profissional', bookingId: appointmentId || ''
             });
             if (result.success) await markEmailSent(appointmentId, eventKeyClient);
          }
        }
        return res.json({ success: true });
      }

      if (type === 'BOOKING_CONFIRMED') {
        const { professionalId, clientName, clientEmail, clientWhatsapp, serviceName, date, time, locationType, neighborhood, appointmentId, status } = payload;
        
        console.log(`[CONFIRM FLOW] notify called for ${appointmentId} (status: ${status})`);
        console.log(`[CONFIRM FLOW] Email confirmation skipped in notify (handled by background trigger)`);

        // Fetch pro name for WhatsApp
        const proDocSnap = await db.collection('users').doc(professionalId).get();
        const pro = proDocSnap.exists ? proDocSnap.data() : null;
        const proName = pro?.name || 'Sua Profissional';

        // 1. WhatsApp to Client
        if (clientWhatsapp) {
          console.log(`[WHATSAPP FLOW] sending confirmation to client: ${clientWhatsapp}`);
          const formattedDate = date.split('-').reverse().join('/');
          const msg = `✨ *Seu horário foi confirmado!*\n\n` +
                      `*Profissional:* ${proName}\n` +
                      `*Serviço:* ${serviceName}\n` +
                      `*Data:* ${formattedDate}\n` +
                      `*Hora:* ${time}\n\n` +
                      `Responda:\n1 — Reagendar\n2 — Cancelar\n*Sim* — Confirmar presença\n\n` +
                      `Nos vemos em breve 💛`;
          
          await sendWhatsApp(db, clientWhatsapp, msg, {
            appointmentId,
            userId: professionalId,
            type: 'booking_confirmed_client'
          });
        }

        return res.json({ success: true, emailTriggered: 'background' });
      }

      if (type === 'BOOKING_RESCHEDULED_BY_CLIENT' || type === 'BOOKING_RESCHEDULED') {
        const { professionalId, clientName, clientEmail, previousDate, previousTime, date, time, appointmentId, serviceName } = payload;
        
        const proDoc = await db.collection('users').doc(professionalId).get();
        if (proDoc.exists) {
          const pro = proDoc.data();
          const proPhone = pro?.whatsapp;
          
          if (proPhone) {
            const oldFormatted = previousDate.split('-').reverse().join('/');
            const newFormatted = date.split('-').reverse().join('/');
            
            const msg = `🚨 *Alteração de Horário!* \n\n${clientName} REAGENDOU o atendimento:\n\n` +
                        `De: ${oldFormatted} às ${previousTime}\n` +
                        `Para: *${newFormatted} às ${time}*\n\n` +
                        `O horário antigo foi liberado automaticamente. Confira no Dashboard: \n${baseUrl}/dashboard`;

            await sendWhatsAppMeta(proPhone, msg);
          }

          // Email for client
          if (clientEmail) {
            const eventKey = 'bookingRescheduledClient';
            if (await shouldSendEmail(appointmentId, eventKey)) {
              const result = await sendBookingRescheduledEmail({
                clientEmail, clientName, 
                professionalName: pro?.name || 'Sua Profissional',
                serviceName, oldDate: previousDate, oldTime: previousTime,
                newDate: date, newTime: time, appointmentId
              });
              if (result.success) await markEmailSent(appointmentId, eventKey);
            }
          }
        }
        return res.json({ success: true });
      }

      if (type === 'WAITLIST_INVITATION') {
        const { clientWhatsapp, clientName, requestedDate, assignedTime, professionalName, expiresAt } = payload;
        
        if (clientWhatsapp) {
          const formattedDate = requestedDate.split('-').reverse().join('/');
          const msg = `Boas notícias, ${clientName}! 🌟\n\nAbriu uma vaga na agenda de ${professionalName} para o dia ${formattedDate} às ${assignedTime}.\n\nComo você estava na lista de espera, tem prioridade para reservar nos próximos 15 minutos!\n\nGaranta sua vaga agora: \n${baseUrl}/p/exemplo?waitlist_invite=true`; // Em prod, usaria o slug real
          
          await sendWhatsAppMeta(clientWhatsapp, msg);
        }
        return res.json({ success: true });
      }

      if (type === 'WAITLIST_SLOT_OPENED') {
        const { professionalId, date, time, candidateName } = payload;
        
        const proDoc = await db.collection('users').doc(professionalId).get();
        if (proDoc.exists) {
          const pro = proDoc.data();
          if (pro?.whatsapp) {
            const formattedDate = date.split('-').reverse().join('/');
            const msg = `Vaga na lista de espera! 🗓️\n\nO horário de ${time} (${formattedDate}) ficou disponível e ${candidateName} está aguardando.\n\nConfira no seu Dashboard: \n${baseUrl}/dashboard`;
            
            await sendWhatsAppMeta(pro.whatsapp, msg);
          }
        }
        return res.json({ success: true });
      }

      res.json({ success: true, message: "Type processed or ignored." });

    } catch (error: any) {
      console.error(`[Notification Service] ERROR:`, error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  /**
   * Cron Job: 24h Reminders
   * Robust multi-channel delivery: Email (primary) -> WhatsApp (fallback) -> Log.
   * Triggered by external cron service using CRON_SECRET.
   */
  app.get('/api/cron/reminders24h', async (req, res) => {
    const secret = req.headers['x-cron-secret'];
    if (secret !== process.env.CRON_SECRET) {
      console.warn('[Cron] Unauthorized access attempt blocked');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      console.log(`[Cron] Starting 24h reminders for appointments on ${tomorrowStr}...`);

      const appointmentsRef = db.collection('appointments');
      const snap = await appointmentsRef
        .where('date', '==', tomorrowStr)
        .where('status', '==', 'confirmed')
        .where('reminder24hSentAt', '==', null)
        .get();
      
      console.log(`[Cron] Found ${snap.docs.length} pending reminders for tomorrow.`);
      
      let emailSent = 0;
      let whatsappSent = 0;
      let noChannelCount = 0;
      let errorsCount = 0;
      
      for (const docSnap of snap.docs) {
        const appt = docSnap.data();
        const apptId = docSnap.id;
        
        if (!appt.professionalId) {
          console.warn(`[Cron] Skipping appt ${apptId}: No professionalId`);
          continue;
        }
        
        try {
          // 1. Fetch professional data
          const proSnap = await db.collection('users').doc(appt.professionalId).get();
          if (!proSnap.exists) {
            console.warn(`[Cron] Skipping ${apptId}: Professional profile not found`);
            continue;
          }
          
          const pro = proSnap.data();
          let sentSuccessfully = false;
          let deliveryChannel = '';

          // A. WhatsApp to Client (Requested by user)
          const clientPhone = appt.clientWhatsapp;
          if (clientPhone) {
            const formattedDate = tomorrowStr.split('-').reverse().join('/');
            const msg = `✨ *Lembrete do seu atendimento amanhã:*\n\n${appt.serviceName}\n${formattedDate}\n${appt.time}\n\nResponda:\n1 — Reagendar\n2 — Cancelar\n*Sim* — Confirmar presença`;
            
            const result = await sendWhatsApp(db, clientPhone, msg, {
              appointmentId: apptId,
              userId: appt.professionalId,
              type: 'reminder_24h_client'
            });

            if (result.success) {
              sentSuccessfully = true;
              deliveryChannel = 'whatsapp_client';
              whatsappSent++;
            }
          }

          // B. WhatsApp to Professional
          const proPhone = pro?.whatsapp;
          if (proPhone) {
            const formattedDate = tomorrowStr.split('-').reverse().join('/');
            const msg = `Lembrete Nera! 🔔\n\nAmanhã, ${formattedDate}, você tem um atendimento com ${appt.clientName} às ${appt.time} (${appt.serviceName}).`;
            
            await sendWhatsApp(db, proPhone, msg, {
              appointmentId: apptId,
              userId: appt.professionalId,
              type: 'reminder_24h_pro'
            });
          }

          // C. Email (Fallback for Client)
          if (!sentSuccessfully && process.env.RESEND_API_KEY && appt.clientEmail) {
            try {
              const result = await sendBookingReminder24hEmail({
                clientName: appt.clientName,
                serviceName: appt.serviceName,
                date: appt.date,
                time: appt.time,
                location: appt.locationDetail || appt.address || 'Local não informado',
                professionalName: pro?.name || 'Profissional',
                clientEmail: appt.clientEmail,
                bookingId: apptId
              });
              if (result.success) {
                sentSuccessfully = true;
                deliveryChannel = 'email_client';
                emailSent++;
              }
            } catch (emailErr) {
              console.error(`[Cron] Email delivery failed for ${apptId}:`, emailErr);
            }
          }

          // 2. Finalize
          if (sentSuccessfully || proPhone) {
            console.log(`[Cron] Reminder processed for ${apptId}`);
            await docSnap.ref.update({ 
              reminder24hSentAt: admin.firestore.FieldValue.serverTimestamp(),
              deliveryChannel: deliveryChannel || 'whatsapp_pro'
            });
          } else {
            console.log(`[Cron] No delivery channel available for client on appt ${apptId}`);
            noChannelCount++;
          }

        } catch (innerErr: any) {
          console.error(`[Cron] Failed processing appointment ${apptId}:`, innerErr.message);
          errorsCount++;
        }
      }
      
      const summary = { 
        success: true, 
        date: tomorrowStr,
        totalFound: snap.docs.length,
        sentEmail: emailSent, 
        sentWhatsApp: whatsappSent,
        noChannel: noChannelCount,
        errors: errorsCount
      };
      
      console.log(`[Cron] Completed:`, summary);
      res.json(summary);
    } catch (err: any) {
      console.error('[Cron Critical Error] 24h reminders failed:', err.message);
      res.status(500).json({ error: String(err) });
    }
  });

  /**
   * Cron Job: 2h Reminders
   */
  app.get('/api/cron/reminders2h', async (req, res) => {
    const secret = req.headers['x-cron-secret'];
    if (secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      
      // We want appointments between now + 1:50 and now + 2:10
      // But query by date first
      const snap = await db.collection('appointments')
        .where('date', '==', today)
        .where('status', '==', 'confirmed')
        .where('reminder2hSentAt', '==', null)
        .get();

      console.log(`[Cron-2h] Found ${snap.docs.length} confirmed bookings today.`);

      let sentCount = 0;
      for (const docSnap of snap.docs) {
        const appt = docSnap.data();
        const apptId = docSnap.id;
        
        // Parse time (expecting HH:mm)
        const [hours, minutes] = appt.time.split(':').map(Number);
        const apptTime = new Date();
        apptTime.setHours(hours, minutes, 0, 0);

        const diffMinutes = (apptTime.getTime() - now.getTime()) / (1000 * 60);

        // If appt is within 90 - 150 minutes (approx 2h)
        if (diffMinutes > 90 && diffMinutes < 150) {
          if (appt.clientWhatsapp) {
            const msg = `Estamos te esperando hoje às ${appt.time} 💛`;
            const result = await sendWhatsApp(db, appt.clientWhatsapp, msg, {
              appointmentId: apptId,
              userId: appt.professionalId,
              type: 'reminder_2h'
            });

            if (result.success) {
              await docSnap.ref.update({
                reminder2hSentAt: admin.firestore.FieldValue.serverTimestamp()
              });
              sentCount++;
            }
          }
        }
      }

      res.json({ success: true, sent: sentCount });
    } catch (err: any) {
      console.error('[Cron-2h] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Cron: Review Requests (24h after completion)
   */
  app.get('/api/cron/review-requests', async (req, res) => {
    const secret = req.headers['x-cron-secret'];
    if (secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const snap = await db.collection('appointments')
        .where('date', '==', yesterdayStr)
        .where('status', '==', 'completed')
        .where('reviewRequestedAt', '==', null)
        .get();

      console.log(`[Cron-Reviews] Found ${snap.docs.length} completed bookings from ${yesterdayStr}`);

      let sentCount = 0;
      const baseUrl = process.env.APP_URL || 'http://localhost:3000';

      for (const docSnap of snap.docs) {
        const appt = docSnap.data();
        const apptId = docSnap.id;
        const clientPhone = appt.clientWhatsapp;

        if (clientPhone) {
          // Generate a secure token for the review request
          const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          const reviewUrl = `${baseUrl}/review/${token}`;
          
          // Create the review request document that ReviewPage expects
          await db.collection('review_requests').add({
            professionalId: appt.professionalId,
            bookingId: apptId,
            token,
            status: 'pending',
            clientDisplayName: appt.clientName,
            clientNeighborhood: appt.neighborhood || '',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // 1. WhatsApp Delivery
          const proName = appt.professionalName || 'sua profissional';
          const msg = `Obrigada por agendar com ${proName} 💛. Sua opinião é muito importante para nós. Se puder, deixe sua avaliação: ${reviewUrl}`;
          const result = await sendWhatsApp(db, clientPhone, msg, {
            appointmentId: apptId,
            userId: appt.professionalId,
            type: 'review_request'
          });
          
          let sent = result.success;

          // 2. NEW: Email Delivery (Premium Visual)
          if (appt.clientEmail) {
            const eventKey = 'reviewRequestClient';
            if (await shouldSendEmail(apptId, eventKey)) {
              const result = await sendReviewRequestEmail({
                clientName: appt.clientName,
                serviceName: appt.serviceName,
                date: appt.date,
                time: appt.time,
                location: appt.locationDetail || appt.address || appt.neighborhood || 'Local não informado',
                professionalName: appt.professionalName,
                professionalEmail: '', // Not used in client email
                clientEmail: appt.clientEmail,
                bookingId: apptId,
                reviewUrl
              });
              if (result.success) await markEmailSent(apptId, eventKey);
            }
          }

          if (sent || appt.clientEmail) {
            await docSnap.ref.update({
              reviewRequestedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            sentCount++;
          }
        }
      }

      res.json({ success: true, date: yesterdayStr, sent: sentCount });
    } catch (err: any) {
      console.error('[Cron-Reviews] Critical error:', err.message);
      res.status(500).json({ error: String(err) });
    }
  });

  // --- ANTI NO-SHOW ENDPOINTS ---
  
  app.post("/api/booking/:id/confirm-presence", async (req, res) => {
    try {
      const { id } = req.params;
      const appRef = db.collection('appointments').doc(id);
      const appDoc = await appRef.get();
      
      if (!appDoc.exists) return res.status(404).json({ error: "Reserva não encontrada" });
      
      await appRef.update({
        clientConfirmed24h: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Cron Job: Anti No-Show (Client Confirmation Request)
   * Sends email to clients 24h before their appointment requesting confirmation.
   */
  app.get('/api/cron/anti-no-show', async (req, res) => {
    const secret = req.headers['x-cron-secret'];
    if (secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      console.log(`[Anti No-Show] Running for ${tomorrowStr}...`);

      const appointmentsRef = db.collection('appointments');
      const snap = await appointmentsRef
        .where('date', '==', tomorrowStr)
        .where('status', '==', 'confirmed')
        .where('clientConfirmed24h', '!=', true)
        .get();
      
      let sentCount = 0;
      const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://nera.app';

      for (const docSnap of snap.docs) {
        const appt = docSnap.data();
        const apptId = docSnap.id;
        
        // 1. Fetch professional data to check if anti-no-show is enabled
        const proSnap = await db.collection('users').doc(appt.professionalId).get();
        if (!proSnap.exists) continue;
        const pro = proSnap.data();
        
        if (pro?.antiNoShowEnabled) {
          if (appt.clientEmail) {
            const eventKey = 'confirmationRequest24h';
            if (await shouldSendEmail(apptId, eventKey)) {
              const result = await sendConfirmationRequest24hEmail({
                clientEmail: appt.clientEmail,
                clientName: appt.clientName,
                professionalName: pro.name || 'Profissional',
                serviceName: appt.serviceName,
                date: appt.date,
                time: appt.time,
                confirmUrl: `${appUrl}/manage/${apptId}?action=confirm-presence`,
                rescheduleUrl: `${appUrl}/manage/${apptId}?action=reschedule`,
                cancelUrl: `${appUrl}/manage/${apptId}?action=cancel`,
                appointmentId: apptId
              });
              
              if (result.success) {
                await markEmailSent(apptId, eventKey);
                // Also update status as before
                await docSnap.ref.update({
                  status: 'pending_confirmation',
                  antiNoShowSentAt: admin.firestore.FieldValue.serverTimestamp()
                });
                sentCount++;
              }
            }
          }
        }
      }

      res.json({ success: true, processed: snap.size, sent: sentCount });
    } catch (err: any) {
      console.error('[Anti No-Show Cron] Error:', err);
      res.status(500).json({ error: String(err) });
    }
  });
  
  /**
   * Cron Job: Retention (Repurchase Request)
   * Sends email to clients 30 days after their last appointment.
   */
  app.get('/api/cron/retention', async (req, res) => {
    const secret = req.headers['x-cron-secret'];
    if (secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
      
      console.log(`[Retention] Running for ${thirtyDaysAgoStr}...`);

      const appointmentsRef = db.collection('appointments');
      const snap = await appointmentsRef
        .where('date', '==', thirtyDaysAgoStr)
        .where('status', 'in', ['confirmed', 'completed'])
        .where('retentionSent', '!=', true)
        .get();
      
      let sentCount = 0;
      const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://nera.app';

      for (const docSnap of snap.docs) {
        const appt = docSnap.data();
        
        // Check if client has booked again in the future (optional but good)
        const futureSnap = await appointmentsRef
          .where('clientEmail', '==', appt.clientEmail)
          .where('date', '>', thirtyDaysAgoStr)
          .limit(1)
          .get();
        
        if (futureSnap.empty) {
          if (appt.clientEmail) {
            const eventKey = 'retention30d';
            if (await shouldSendEmail(docSnap.id, eventKey)) {
              const result = await sendRetentionEmail({
                clientEmail: appt.clientEmail,
                clientName: appt.clientName,
                professionalName: appt.professionalName || 'Profissional',
                serviceName: appt.serviceName,
                bookingUrl: `${appUrl}/p/${appt.professionalSlug || ''}`,
                appointmentId: docSnap.id
              });
              
              if (result.success) {
                await markEmailSent(docSnap.id, eventKey);
                await docSnap.ref.update({
                  retentionSent: true,
                  retentionSentAt: admin.firestore.FieldValue.serverTimestamp()
                });
                sentCount++;
              }
            }
          }
        } else {
          // Already have a future booking, just mark as checked
          await docSnap.ref.update({
            retentionSent: true
          });
        }
      }

      res.json({ success: true, processed: snap.size, sent: sentCount });
    } catch (err: any) {
      console.error('[Retention Cron] Error:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
