import admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const CONFIG = {
  dryRun: false,
  confirm: "SEED_QA_ACCOUNTS", // MUST be "SEED_QA_ACCOUNTS" for real execution
  password: "NeraQA2026!",
  accounts: [
    {
      email: "qa.nail.iniciante@example.com",
      displayName: "QA Nail Iniciante"
    },
    {
      email: "qa.lash.premium@example.com",
      displayName: "QA Lash Premium"
    },
    {
      email: "qa.estetica.operacional@example.com",
      displayName: "QA Estética Operacional"
    },
    {
      email: "qa.makeup.emocional@example.com",
      displayName: "QA Makeup Emocional"
    },
    {
      email: "qa.cabelo.tradicional@example.com",
      displayName: "QA Cabelo Tradicional"
    }
  ]
};

async function main() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725";
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  
  const auth = getAuth();
  const db = getFirestore();

  console.log(`Starting QA Accounts Seeding...`);
  console.log(`Dry Run: ${CONFIG.dryRun}`);

  if (!CONFIG.dryRun && CONFIG.confirm !== "SEED_QA_ACCOUNTS") {
    console.error(`ERROR: dryRun is false but confirm string is not "SEED_QA_ACCOUNTS". Aborting.`);
    process.exit(1);
  }

  const reports = [];

  for (const account of CONFIG.accounts) {
    console.log(`\n--- Processing QA Seed: ${account.email} ---`);
    let uid = null;
    let authCreated = false;
    let firestoreCreatedOrUpdated = false;

    // Check if Auth user exists
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(account.email);
      uid = userRecord.uid;
      console.log(`User Auth already exists. UID: ${uid}`);
      
      if (!CONFIG.dryRun) {
        userRecord = await auth.updateUser(uid, {
          emailVerified: true,
          password: CONFIG.password,
          displayName: account.displayName,
          disabled: false,
        });
        authCreated = true;
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || (CONFIG.dryRun && error.code === 'auth/internal-error')) {
        console.log(`User Auth not found or mock error. Will create.`);
        if (!CONFIG.dryRun) {
          userRecord = await auth.createUser({
            email: account.email,
            emailVerified: true,
            password: CONFIG.password,
            displayName: account.displayName,
            disabled: false,
          });
          uid = userRecord.uid;
          authCreated = true;
        } else {
           uid = "fake-dryrun-uid-" + Math.random().toString(36).substring(7);
        }
      } else {
        console.error(`Error fetching user auth:`, error);
        reports.push({ email: account.email, status: 'error', error: error.message });
        continue;
      }
    }

    const userData = {
      email: account.email,
      displayName: account.displayName,
      internalAccount: true,
      internalType: "qa",
      excludeFromAnalytics: true,
      plan: "pro",
      planRank: 2,
      stripeSubscriptionStatus: "manual_grant",
      billingSource: "qa_seed",
      onboardingCompleted: false,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!CONFIG.dryRun && uid) {
      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
         await userRef.set({
           ...userData,
           createdAt: FieldValue.serverTimestamp(),
         });
      } else {
         await userRef.update(userData);
      }
      firestoreCreatedOrUpdated = true;
    }

    reports.push({
      email: account.email,
      uid,
      status: CONFIG.dryRun ? 'would_create_or_update' : 'created_or_updated',
      authEmailVerified: true, // Will be set or updated to true
      firestoreCreatedOrUpdated,
      authCreated
    });
  }

  console.log("\n========================================================");
  console.log("FINAL REPORT");
  console.log("========================================================");
  console.log(`Dry Run: ${CONFIG.dryRun}`);
  console.log(`Processed Accounts: ${reports.length}`);
  reports.forEach(r => {
    console.log(`- ${r.email} | ${r.uid} | Status: ${r.status}`);
  });

  process.exit(0);
}

main().catch(console.error);
