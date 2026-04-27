import admin from "firebase-admin";
import { db } from "./firebaseAdmin";
import { sendBookingConfirmedEmail } from "./emails/sendEmail";
import { markEmailSent } from "./utils";
import { createGoogleCalendarEvent } from "./routes/calendarRoutes";

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
      
      const waPhone = pro?.whatsapp ? pro.whatsapp.replace(/\D/g, '') : '';
      const whatsappUrl = waPhone ? `https://wa.me/${waPhone}` : undefined;

      const result = await sendBookingConfirmedEmail({
        clientName: data.clientName,
        serviceName: data.serviceName,
        date: data.date,
        time: data.time,
        location: data.locationType === 'home' ? `Domicílio (${data.neighborhood})` : 'Estúdio / Local Fixo',
        clientEmail: data.clientEmail,
        professionalName: pro?.name || 'Sua Profissional',
        professionalEmail: pro?.email || '',
        bookingId: id,
        prepInstructions: data.prepInstructions,
        whatsappUrl
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

export const setupBackgroundTriggers = () => {
  if (!db) {
    console.error('[AUTO CONFIRM EMAIL] DB not initialized. Skipping listener setup.');
    return;
  }
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

        // TRIGGER: Google Calendar Sync
        const calendarAlreadyCreated = data.googleCalendarEventCreated === true || !!data.googleCalendarEventId;
        if (isConfirmed && !calendarAlreadyCreated) {
           createGoogleCalendarEvent({ id, ...data }, data.professionalId).then(() => {
             db.collection('appointments').doc(id).update({ googleCalendarEventCreated: true }).catch(() => {});
           });
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
