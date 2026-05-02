import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// TEMP: hardcoded config (mobile fix)
const firebaseConfig = {
  apiKey: "AIzaSyDO2OcFecgXEfATajxcY0piPP8VfCoQGWU",
  authDomain: "ai-studio-applet-webapp-bb725.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-bb725",
  storageBucket: "ai-studio-applet-webapp-bb725.firebasestorage.app",
  messagingSenderId: "768951224787",
  appId: "1:768951224787:web:9165a57c367a649f1e8726"
};

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

try {
  app = initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
} catch (e) {
  console.error("Firebase init error:", e);
}

export { app };
export const auth = authInstance;
export const db = dbInstance;
