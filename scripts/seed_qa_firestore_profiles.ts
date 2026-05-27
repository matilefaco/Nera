import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const CONFIG = {
  dryRun: false,
  confirm: "SEED_QA_FIRESTORE", // MUST be "SEED_QA_FIRESTORE" for real execution
  accounts: [
    {
      email: "qa.nail.iniciante@example.com",
      uid: "NuiDAtJ0coQ1pHAhNpx7V5QBXyg1",
      displayName: "Lara Monteiro",
      qaPersona: "nail_iniciante"
    },
    {
      email: "qa.lash.premium@example.com",
      uid: "24dQFbtcx7hf1oar3k1JwV79DIh2",
      displayName: "Valentina Rocha",
      qaPersona: "lash_premium"
    },
    {
      email: "qa.estetica.operacional@example.com",
      uid: "Pi2cTkDmG3XYjFf29CLn8aXdsAj2",
      displayName: "Camila Duarte",
      qaPersona: "estetica_operacional"
    },
    {
      email: "qa.makeup.emocional@example.com",
      uid: "W70HJWCF6Bb5csPhmEAkChvhswB2",
      displayName: "Isabela Prado",
      qaPersona: "makeup_emocional"
    },
    {
      email: "qa.cabelo.tradicional@example.com",
      uid: "LqjF6SrxZ0VFpLVzWh2gNeRu9IB2",
      displayName: "Marta Azevedo",
      qaPersona: "cabelo_tradicional"
    }
  ]
};

async function main() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725";
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  
  const db = getFirestore();

  console.log(`Starting QA Firestore Seeding...`);
  console.log(`Dry Run: ${CONFIG.dryRun}`);

  if (!CONFIG.dryRun && CONFIG.confirm !== "SEED_QA_FIRESTORE") {
    console.error(`ERROR: dryRun is false but confirm string is not "SEED_QA_FIRESTORE". Aborting.`);
    process.exit(1);
  }

  const reports = [];

  for (const account of CONFIG.accounts) {
    console.log(`\n--- Processing Firestore for QA Seed: ${account.email} (${account.uid}) ---`);
    
    // Safety check against known prods not to touch
    if (account.email.includes("mamaifood14") || account.email.includes("mamaifood25")) {
        console.log(`Skipping protected account.`);
        continue;
    }

    const userRef = db.collection("users").doc(account.uid);
    const userDoc = await userRef.get();
    let currentData = userDoc.exists ? userDoc.data() : null;
    
    const isNew = !userDoc.exists;
    const hasRealStripe = currentData?.stripeCustomerId && currentData?.stripeSubscriptionStatus === "active" && currentData?.billingSource !== "qa_seed";
    
    if (hasRealStripe) {
       console.log(`WARNING: Account has real stripe active. Skipping. (Customer ID: ${currentData?.stripeCustomerId})`);
       reports.push({ email: account.email, status: 'blocked_real_stripe' });
       continue;
    }

    const userData: any = {
      email: account.email,
      displayName: account.displayName,
      name: account.displayName,
      internalAccount: true,
      internalType: "qa",
      excludeFromAnalytics: true,
      plan: "pro",
      planRank: 2,
      stripeSubscriptionStatus: "manual_grant",
      billingSource: "qa_seed",
      onboardingCompleted: false,
      accountStatus: "active",
      qaPersona: account.qaPersona,
      updatedAt: FieldValue.serverTimestamp(),
    };
    
    if (isNew) {
        userData.createdAt = FieldValue.serverTimestamp();
    }

    if (!CONFIG.dryRun) {
      await userRef.set(userData, { merge: true });
    }

    reports.push({
      email: account.email,
      uid: account.uid,
      status: CONFIG.dryRun ? 'would_merge' : 'merged',
      isNew
    });
    console.log(`Planned updates:`, userData);
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
