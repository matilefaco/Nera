import admin from 'firebase-admin';

let db: admin.firestore.Firestore;

export function initFirebase() {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  db = admin.firestore();
}

export function getDb() {
  return db;
}
