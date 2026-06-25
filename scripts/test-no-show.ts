import { getFirestore, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import admin from 'firebase-admin';

// Initialize Admin SDK to mint custom token
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725",
  });
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDO2OcFecgXEfATajxcY0piPP8VfCoQGWU",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "ai-studio-applet-webapp-bb725.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "ai-studio-applet-webapp-bb725.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "743781740925",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:743781740925:web:53bce7bf71861cd7db08e5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  try {
    const userEmail = "matilefaco1@gmail.com";
    const userRecord = await admin.auth().getUserByEmail(userEmail);
    const uid = userRecord.uid;
    const customToken = await admin.auth().createCustomToken(uid);
    await signInWithCustomToken(auth, customToken);
    
    console.log("Logged in as:", auth.currentUser?.uid);

    // Let's create an appointment first using client SDK to test rules
    const { addDoc, collection } = await import('firebase/firestore');
    const docRef = await addDoc(collection(db, "appointments"), {
      professionalId: uid,
      status: "pending_confirmation",
      createdAt: serverTimestamp(),
      date: "2026-06-25",
      time: "10:00"
    });
    console.log("Created test appointment:", docRef.id);

    console.log("Attempting to update to no_show_client...");
    const updatePayload = {
      noShow: true,
      status: "no_show_client",
      updatedAt: serverTimestamp(),
      timeline: arrayUnion({
        type: "no_show_client",
        createdAt: new Date().toISOString(),
        actor: "professional",
        label: "Atendimento marcado como No-Show Cliente",
      }),
    };
    
    await updateDoc(doc(db, "appointments", docRef.id), updatePayload);
    console.log("Update successful!");
    
    process.exit(0);
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  }
}

run();
