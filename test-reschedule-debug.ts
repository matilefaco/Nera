import { db as dbAdmin, initFirebase } from './server/firebaseAdmin';

async function run() {
  await initFirebase();
  const appointmentId = '5vXDFpjBMyMwreGWHGvc';
  console.log(`Fetching appointment ${appointmentId}...`);
  const apptSnap = await dbAdmin.collection('appointments').doc(appointmentId).get();
  
  if (!apptSnap.exists) {
    console.log('Appointment not found!');
    return;
  }
  
  const appt = apptSnap.data()!;
  console.log('Appointment:', JSON.stringify(appt, null, 2));
  
  const cleanOldTime = appt.time.replace(':', '');
  const oldLockId = `${appt.professionalId}_${appt.date}_${cleanOldTime}`;
  console.log(`Fetching old lock ${oldLockId}...`);
  const oldLockSnap = await dbAdmin.collection('booking_locks').doc(oldLockId).get();
  console.log('Old lock exists:', oldLockSnap.exists);
  if (oldLockSnap.exists) console.log('Old lock:', JSON.stringify(oldLockSnap.data(), null, 2));

  console.log('Finding all booking locks for this appointment...');
  const locks = await dbAdmin.collection('booking_locks').where('appointmentId', '==', appointmentId).get();
  locks.forEach(doc => {
    console.log(`Lock ${doc.id}:`, JSON.stringify(doc.data(), null, 2));
  });

}
run().catch(console.error);
