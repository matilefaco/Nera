import admin from 'firebase-admin';

let db: admin.firestore.Firestore;

export async function initFirebase() {
  if (admin.apps.length === 0) {
    const app = admin.initializeApp({
      projectId: 'ai-studio-applet-webapp-bb725'
    });
    console.log("[FIREBASE] Admin initialized for project:", app.options.projectId);
  }
  db = admin.firestore();
  console.log("[FIREBASE] Admin initialized.");
}

export function getDb() {
  if (!db) {
    if (admin.apps.length === 0) {
       admin.initializeApp({
         projectId: 'ai-studio-applet-webapp-bb725'
       });
    }
    db = admin.firestore();
  }
  return db;
}
