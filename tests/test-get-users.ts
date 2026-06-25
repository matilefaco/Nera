import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725",
  });
}

async function run() {
    const listUsersResult = await admin.auth().listUsers(10);
    listUsersResult.users.forEach(userRecord => {
        console.log("Auth User:", userRecord.uid, userRecord.email);
    });
}
run();
