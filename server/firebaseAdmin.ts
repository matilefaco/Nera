import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

export let db: admin.firestore.Firestore;
export let defaultDb: admin.firestore.Firestore;

/**
 * Returns the initialized Firestore instance.
 * In Cloud Functions, this typically defaults to the project's default database.
 */
export const getDb = () => {
  if (!db) {
    console.warn("[FIREBASE ADMIN] db requested but not initialized. Returning default if available.");
    return defaultDb || getFirestore();
  }
  return db;
};

export const initFirebase = async () => {
  try {
    if (!admin.apps.length) {
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725";
      admin.initializeApp({
        projectId
      });
      console.log(`[FIREBASE ADMIN] Initialized with projectId: ${projectId}`);
    }

    // Using the (default) database instance
    db = getFirestore();
    defaultDb = db;
    console.log(`[NERA FIRESTORE] Initialized with database: (default)`);
  } catch (err: any) {
    console.error("[FIREBASE ADMIN] Critical Initialization Error:", err.message);
  }
};
