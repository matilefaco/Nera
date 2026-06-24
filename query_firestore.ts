import * as admin from 'firebase-admin';

async function run() {
  admin.initializeApp();
  const db = admin.firestore();
  const snap = await db.collection('appointments')
    .where('status', '==', 'pending_confirmation')
    .get();
  
  if (snap.empty) {
    console.log("No appointments found with pending_confirmation");
  } else {
    snap.forEach(doc => {
      console.log("Appointment ID:", doc.id);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
  }
}

run().catch(console.error);
