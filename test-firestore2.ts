import { admin } from "./server/firebaseAdmin";

async function run() {
  try {
    const db = admin.firestore();
    await db.collection("users").doc("testuid1234").set({ test: true });
    console.log("Success writing to Firestore!");
  } catch(e) {
    console.error("FIRESTORE ERROR:", e);
  }
}

run();
