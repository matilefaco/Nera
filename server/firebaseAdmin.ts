import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load firebase config manually to avoid problematic JSON import syntax in some environments
const getFirebaseConfig = () => {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(firebaseConfigPath)) {
    console.error(`[FIREBASE ADMIN] firebase-applet-config.json not found at ${firebaseConfigPath}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
};

import { GoogleAuth } from "google-auth-library";

// Diagnostic for Runtime Identity
async function getRuntimeIdentity() {
  try {
    const auth = new GoogleAuth();
    const credentials = await auth.getCredentials();
    const projectId = await auth.getProjectId();
    return {
      clientEmail: (credentials as any).client_email || "default-service-account",
      projectId: projectId,
      usingDefault: !process.env.GOOGLE_APPLICATION_CREDENTIALS
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

export let db: admin.firestore.Firestore;
export let defaultDb: admin.firestore.Firestore;

export const initFirebase = async () => {
  try {
    const firebaseConfig = getFirebaseConfig();
    if (!firebaseConfig) {
      throw new Error("Missing firebase-applet-config.json");
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log('[FIREBASE ADMIN] initialized.');
    }

    db = getFirestore(firebaseConfig.firestoreDatabaseId);
    defaultDb = getFirestore();
  } catch (err: any) {
    console.error('[FIREBASE ADMIN] Critical Initialization Error:', err.message);
  }
};

export { getRuntimeIdentity };
