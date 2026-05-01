import admin from 'firebase-admin';

let db: admin.firestore.Firestore;

export async function initFirebase() {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  db = admin.firestore();
  db.settings({
    databaseId: "5d44-4968-bb61-5bb5b2cc"
  });
  console.log("[FIREBASE] Admin initialized with databaseId.", "5d44-4968-bb61-5bb5b2cc");
}

export function getDb() {
  if (!db) {
    if (admin.apps.length === 0) {
       admin.initializeApp();
    }
    db = admin.firestore();
    db.settings({
      databaseId: "5d44-4968-bb61-5bb5b2cc"
    });
  }
  return db;
}
