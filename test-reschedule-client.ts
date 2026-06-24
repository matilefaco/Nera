import { signInWithCustomToken } from 'firebase/auth';
import admin from 'firebase-admin';
import { initFirebase, getDb } from './server/firebaseAdmin.js';

async function run() {
  await initFirebase();
  const dbAdmin = getDb();
  
  // Find an appointment
  const snap = await dbAdmin.collection('appointments').where('status', '==', 'pending_confirmation').limit(1).get();
  if (snap.empty) {
    console.log("No pending_confirmation appointments found.");
    process.exit(0);
  }
  const appt = snap.docs[0].data();
  const appointmentId = snap.docs[0].id;
  const uid = appt.professionalId;
  
  console.log("Testing with UID:", uid, "Appointment:", appointmentId);
  
  const customToken = await admin.auth().createCustomToken(uid);
  
  // Sign in client SDK (already initialized in src/firebase.ts)
  const { auth, rescheduleBookingByProfessional } = await import('./src/firebase.js');
  
  await signInWithCustomToken(auth, customToken);
  console.log("Client SDK signed in as:", auth.currentUser?.uid);
  
  try {
    await rescheduleBookingByProfessional(appointmentId, uid, '2026-07-02', '12:00');
    console.log("Success client transaction!");
  } catch (err: any) {
    console.error("Client transaction failed with error:");
    console.error(err.message || err);
  }
  process.exit(0);
}
run().catch(console.error);
