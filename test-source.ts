import { config } from "dotenv";
config();
import { getFirestore } from "firebase-admin/firestore";
import admin from "firebase-admin";

async function run() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725";
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  const db = getFirestore();
  const snapshot = await db.collection("appointments").limit(100).get();
  const sources = new Set();
  snapshot.forEach(doc => {
    const data = doc.data();
    sources.add(data.source);
  });
  console.log("Sources found:", Array.from(sources));
}

run().then(() => process.exit(0)).catch(console.error);
