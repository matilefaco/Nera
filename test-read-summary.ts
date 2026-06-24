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
  console.log("Found appointment clientWhatsapp:", data.clientWhatsapp);
  
  let clientKey = data.clientWhatsapp ? data.clientWhatsapp.replace(/\D/g, '') : null;
  if (!clientKey) clientKey = 'Cliente';
  
  const summaryId = `${data.professionalId}_${clientKey}`;
  
  const summarySnap = await dbAdmin.collection('client_summaries').doc(summaryId).get();
  if (!summarySnap.exists) {
    console.log("Client summary does NOT exist!");
  } else {
    console.log("Client summary exists:");
    console.log(summarySnap.data());
  }
  process.exit(0);
}
run().catch(console.error);
