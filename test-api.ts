import { initFirebase, getDb } from './server/firebaseAdmin.js';

async function test() {
  await initFirebase();
  const db = getDb();
  try {
    const doc = await db.collection('users').doc(undefined as any).get();
    console.log("Success:", doc.exists);
  } catch (err) {
    console.error("Error:", err);
  }
}
test().catch(console.error);
