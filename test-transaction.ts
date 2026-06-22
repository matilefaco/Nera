import admin from "firebase-admin";

admin.initializeApp({
  projectId: "ai-studio-applet-webapp-bb725",
});

async function run() {
  try {
    const db = admin.firestore();
    const currentSlug = "test-slug-1234";

    const slugCheck = await db.runTransaction(async (transaction) => {
      const slugRef = db.collection("slugs").doc(currentSlug);
      const usersQuery = db.collection("users").where("slug", "==", currentSlug).limit(1);

      const [slugDoc, usersSnap] = await Promise.all([
        transaction.get(slugRef),
        transaction.get(usersQuery)
      ]);

      if (!slugDoc.exists && usersSnap.empty) {
        transaction.set(slugRef, { uid: "test1", slug: currentSlug });
        return currentSlug;
      }
      return null;
    });
    console.log("Success!", slugCheck);
  } catch(e) {
    console.error("FIRESTORE ERROR:", e);
  }
}

run();
