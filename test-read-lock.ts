import { initFirebase, getDb } from './server/firebaseAdmin.js';

async function run() {
  await initFirebase();
  const dbAdmin = getDb();
  
  const snap = await dbAdmin.collection('appointments').where('status', '==', 'pending_confirmation').limit(1).get();
  if (snap.empty) {
    console.log("No pending_confirmation appointments found.");
    process.exit(0);
  }
  const data = snap.docs[0].data();
  console.log("Found appointment for:", data.date, data.time);
  
  const cleanOldTime = data.time.replace(':', '');
  const oldLockId = `${data.professionalId}_${data.date}_${cleanOldTime}`;
  
  const lockSnap = await dbAdmin.collection('booking_locks').doc(oldLockId).get();
  if (!lockSnap.exists) {
    console.log("Old lock does NOT exist!");
  } else {
    console.log("Old lock exists:");
    console.log(lockSnap.data());
  }
  process.exit(0);
}
run().catch(console.error);
