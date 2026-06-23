import { getDb, initFirebase } from '../server/firebaseAdmin.js';
import { config } from 'dotenv';
async function run() {
  config();
  await initFirebase();
  const db = getDb();
  
  try {
    await db.runTransaction(async (transaction) => {
        const apptRef = db.collection('appointments').doc('test-id-123');
        transaction.update(apptRef, { test: 1 }); // WRITE

        const summaryRef = db.collection('client_summaries').doc('test-summary-id');
        const summarySnap = await transaction.get(summaryRef); // READ AFTER WRITE
    });
  } catch(e: any) {
    console.error("TRANSACTION FAILED:", e.message);
  }
}
run();
