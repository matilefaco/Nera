import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit } from 'firebase/firestore';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const q = collection(db, 'users');
  const snap = await getDocs(q);
  snap.forEach(doc => {
    console.log(`User: ${doc.id}, slug: ${doc.data().slug}`);
  });
  process.exit(0);
}
run();
