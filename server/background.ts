import admin from "firebase-admin";
import { db } from "./firebaseAdmin.js";
import { sendBookingConfirmedEmail } from "./emails/sendEmail.js";
import { markEmailSent } from "./utils.js";
import { createGoogleCalendarEvent } from "./routes/calendarRoutes.js";

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
  console.log('[BACKGROUND] Background listeners are disabled in this environment to ensure fast startup.');
  // Permanent listeners like onSnapshot are not suitable for Cloud Functions or auto-scaling Cloud Run.
  // Consider using Firebase Functions Cloud Triggers instead.
};
