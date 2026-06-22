import admin from "firebase-admin";

admin.initializeApp({
  projectId: "test-project-db",
});

async function run() {
  try {
    const db = admin.firestore();
    await db.collection("users").doc("testuid123").set({ test: true });
    console.log("Success writing to Firestore!");
  } catch(e) {
    console.error("FIRESTORE ERROR:", e);
  }
}

run();
