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
  const snapshot = await db.collection("appointments").limit(50).get();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (!data.source) {
       console.log(doc.id, {
           source: data.source,
           hasToken: !!data.token,
           hasReservationCode: !!data.reservationCode,
           hasPublicToken: !!data.publicToken,
           hasManageSlug: !!data.manageSlug
       });
    }
  });
}

run().then(() => process.exit(0)).catch(console.error);
