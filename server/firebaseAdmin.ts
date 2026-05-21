import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "./utils/logger.js";

export let db: admin.firestore.Firestore;
export let defaultDb: admin.firestore.Firestore;
export let storageBucket: ReturnType<admin.storage.Storage['bucket']>;

/**
 * Returns the initialized Firestore instance.
 * In Cloud Functions, this typically defaults to the project's default database.
 */
export const getDb = () => {
  if (!db) {
    logger.warn("FIRESTORE", "db requested but not initialized. Returning default if available.");
    return defaultDb || getFirestore();
  }
  return db;
};

export const getStorageBucket = () => {
  if (!storageBucket) {
    storageBucket = admin.storage().bucket();
  }
  return storageBucket;
};

export const initFirebase = async () => {
  try {
    if (!admin.apps.length) {
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725";
      admin.initializeApp({
        projectId,
        storageBucket: "ai-studio-applet-webapp-bb725.firebasestorage.app"
      });
    }

    // Using the (default) database instance
    db = getFirestore();
    defaultDb = db;
    storageBucket = admin.storage().bucket();
  } catch (err: any) {
    logger.error("FIRESTORE", "Critical Initialization Error", { error: err.message });
  }
};
