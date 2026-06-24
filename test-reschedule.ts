import { initFirebase, getDb } from './server/firebaseAdmin.js';
import { rescheduleBookingByProfessional } from './src/firebase.js';

async function test() {
  await initFirebase();
  const db = getDb();
  // Get the appointment that is pending_confirmation
  const snap = await db.collection('appointments').where('status', '==', 'pending_confirmation').limit(1).get();
  if (snap.empty) {
    console.log("No pending_confirmation appointments found.");
    return;
  }
  const appt = snap.docs[0].data();
  console.log("Appointment:", appt.id, appt.date, appt.time, appt.professionalId);
  
  // Oh wait, `rescheduleBookingByProfessional` from src/firebase.ts uses client-side Firebase instances, not admin SDK.
}
test().catch(console.error);
