import { config } from "dotenv";
config();
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725",
    });
  }
} catch (error) {
  console.log("No firebase");
  process.exit();
}

const db = getFirestore();

async function testTransaction() {
  const appointmentData = {
    professionalId: 'UvE1Cah1s5ccy7rV3Ld8r032x9D2',
    clientName: 'Amanda',
    clientWhatsapp: '85988726662',
    clientEmail: '',
    serviceId: 'design_henna',
    serviceName: 'Design com Henna',
    duration: 60,
    price: 45,
    travelFee: 0,
    totalPrice: 45,
    date: '2026-06-23',
    time: '10:00',
    locationType: 'studio',
    source: 'manual',
    notes: 'Test script manually'
  };

  const uid = appointmentData.professionalId;
  const cleanTime = String(appointmentData.time).replace(":", "");
  try {
    const lockId = `${uid}_${appointmentData.date}_${cleanTime}`;
    const result = await db.runTransaction(async (transaction) => {
      const lockRef = db.collection('booking_locks').doc(lockId);
      const lockSnap = await transaction.get(lockRef);
      console.log('Got lockSnap', lockSnap.exists);
      
      const apptRef = db.collection('appointments').doc();
      transaction.set(apptRef, appointmentData);
      
      transaction.set(lockRef, {
        professionalId: uid,
        status: 'confirmed'
      });
      return apptRef.id;
    });
    console.log('Success:', result);
  } catch (err: any) {
    console.error('Error in transaction:', err.message);
  }
}

testTransaction().then(() => process.exit(0)).catch(console.error);
