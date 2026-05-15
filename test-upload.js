import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString } from 'firebase/storage';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: "json" };
import { readFileSync } from 'fs';

async function testUpload() {
  const app = initializeApp(firebaseConfig);
  const storage = getStorage(app);
  const auth = getAuth(app);
  
  // We can't actually sign in with email/pass if we don't have an account,
  // but let's just see if we get 'unauthorized' vs 'no rules'
  try {
     const testRef = ref(storage, 'portfolio/test1234/test.png');
     await uploadString(testRef, 'test', 'raw');
  } catch(e) {
     console.log('Error:', e.code, e.message);
  }
}
testUpload();
