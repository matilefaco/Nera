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
      admin.initializeApp();
      console.log("[FIREBASE ADMIN] Initialized with default credentials");
    }

    db = getFirestore();
    defaultDb = db;
    console.log("[FIREBASE ADMIN] Firestore references initialized");
  } catch (err: any) {
    console.error("[FIREBASE ADMIN] Critical Initialization Error:", err.message);
  }
};
