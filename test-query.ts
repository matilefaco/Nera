import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

async function test() {
  const q = db.collection('appointments')
    .where('professionalId', '==', 'test')
    .where('clientWhatsapp', '==', '123')
    .where('couponCode', '==', 'CUPOM')
    .where('status', 'in', ['pending', 'confirmed', 'completed'])
    .limit(1);
    
  try {
    await q.get();
    console.log("Success");
  } catch (e: any) {
    console.log("Error:", e.message);
  }
}
test();
