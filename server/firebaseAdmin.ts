import admin from 'firebase-admin';

let db: admin.firestore.Firestore;

export async function initFirebase() {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  db = admin.firestore();
  console.log("[FIREBASE] Admin initialized.");
}

export function getDb() {
  if (!db) {
    if (admin.apps.length === 0) {
       admin.initializeApp();
    }
    db = admin.firestore();
  }
  return db;
}
