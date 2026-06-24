import { initFirebase } from './server/firebaseAdmin.js';
import admin from 'firebase-admin';

async function test() {
  await initFirebase();
  const db = admin.firestore();
  
  const snap = await db.collection('appointments').where('status', '==', 'pending_confirmation').limit(1).get();
  if (snap.empty) {
    console.log("No pending_confirmation appointments found.");
    process.exit(0);
  }
  const appt = snap.docs[0].data();
  const appointmentId = snap.docs[0].id;
  const professionalId = appt.professionalId;
  
  console.log("Found appointment:", appointmentId, "for professional:", professionalId);

  try {
    const newDate = '2026-07-01';
    const newTime = '10:00';
    
    await db.runTransaction(async (transaction) => {
      const apptRef = db.collection('appointments').doc(appointmentId);
      const apptDoc = await transaction.get(apptRef);
      if (!apptDoc.exists) throw new Error('Agendamento não encontrado');
      
      const data = apptDoc.data() as any;

      if (data.professionalId !== professionalId) throw new Error('Operação não permitida');
      
      // 1. Verify new slot lock
      const cleanNewTime = newTime.replace(':', '');
      const lockId = `${professionalId}_${newDate}_${cleanNewTime}`;
      const lockRef = db.collection('booking_locks').doc(lockId);
      const lockSnap = await transaction.get(lockRef);
      
      const blockingStatuses = ['confirmed', 'accepted', 'pending_confirmation', 'completed'];

      if (lockSnap.exists && blockingStatuses.includes(lockSnap.data()?.status)) {
        if (lockSnap.data()?.appointmentId !== appointmentId) {
          throw new Error('Horário indisponível');
        }
      }

      // 2. Read old lock
      const cleanOldTime = data.time.replace(':', '');
      const oldLockId = `${professionalId}_${data.date}_${cleanOldTime}`;
      const oldLockRef = db.collection('booking_locks').doc(oldLockId);
      const oldLockSnap = await transaction.get(oldLockRef);
      
      // 3. Read client summary
      let clientKey = data.clientWhatsapp ? data.clientWhatsapp.replace(/\D/g, '') : null;
      let summaryRef;
      if (clientKey) {
        summaryRef = db.collection('client_summaries').doc(`${professionalId}_${clientKey}`);
        await transaction.get(summaryRef);
      }

      // WRITES
      if (oldLockSnap.exists && oldLockSnap.data()?.appointmentId === appointmentId) {
        transaction.delete(oldLockRef);
      }

      if (blockingStatuses.includes(data.status)) {
        transaction.set(lockRef, {
          professionalId: professionalId,
          date: newDate,
          time: newTime,
          appointmentId: appointmentId,
          serviceId: data.serviceId || 'unknown',
          status: data.status,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Update appointment
      const updatePayload = {
        date: newDate,
        time: newTime,
        previousDate: data.date,
        previousTime: data.time,
        rescheduledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastChangeBy: 'professional',
        changeMessage: `Rescheduled`
      };
      
      transaction.update(apptRef, updatePayload);
      
      if (clientKey && summaryRef) {
        transaction.set(summaryRef, { updatedAt: admin.firestore.FieldValue.serverTimestamp(), professionalId }, { merge: true });
      }

      return data;
    });
    console.log("Success admin transaction!");
  } catch (err: any) {
    console.error("Admin transaction failed with error:", err.message);
    console.error(err);
  }
  process.exit(0);
}

test().catch(err => {
  console.error("Test failed", err);
  process.exit(1);
});

