import admin from "firebase-admin";

admin.initializeApp({
  projectId: "test-project-123",
});

async function run() {
  try {
    await admin.auth().createUser({
      email: "mamaifood23@gmail.com",
      password: "password123",
    });
    // Call it a second time to force duplicate
    await admin.auth().createUser({
      email: "mamaifood23@gmail.com",
      password: "password123",
    });
  } catch (err: any) {
    console.log("CODE:", err.code);
    console.log("MESSAGE:", err.message);
  }
}

run();
