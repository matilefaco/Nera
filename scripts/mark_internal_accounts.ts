import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const CONFIG = {
  dryRun: true,
  confirm: "", // MUST be "MARK_INTERNAL_ACCOUNTS" for real execution
  
  qa: [
    "qa.nera.essencial.20260519113423@example.com",
    "qa.nera.free.20260519113342@example.com"
  ],
  audit: [
    "nera.audit.pro.202605194718@example.com",
    "nera.audit.essencial.202605194718@example.com",
    "nera.audit.free.202605194718@example.com",
    "nera.audit.final.82791319@example.com",
    "nera.audit.1956834@example.com",
    "nera.audit.1779046080274@example.com"
  ],
  regression: [
    "nera.regress.72588954@example.com"
  ]
};

async function main() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725";
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  const db = getFirestore();
  
  console.log(`Starting Internal Account Marking...`);
  console.log(`Dry Run: ${CONFIG.dryRun}`);
  
  if (!CONFIG.dryRun && CONFIG.confirm !== "MARK_INTERNAL_ACCOUNTS") {
    console.error(`ERROR: dryRun is false but confirm string is not "MARK_INTERNAL_ACCOUNTS". Aborting.`);
    process.exit(1);
  }

  const reports = [];

  const processCategory = async (emails: string[], type: "qa" | "audit" | "regression") => {
    for (const email of emails) {
      console.log(`\n--- Checking ${email} (${type}) ---`);
      
      const snap = await db.collection("users").where("email", "==", email).get();
      if (snap.empty) {
        console.log(`Missing user doc for email ${email}`);
        reports.push({
          email,
          uid: null,
          exists: false,
          currentInternalAccount: undefined,
          currentInternalType: undefined,
          currentExcludeFromAnalytics: undefined,
          status: "missing_user_doc"
        });
        continue;
      }

      for (const doc of snap.docs) {
        const uid = doc.id;
        const data = doc.data();
        
        const report = {
          email,
          uid,
          exists: true,
          currentInternalAccount: data.internalAccount,
          currentInternalType: data.internalType,
          currentExcludeFromAnalytics: data.excludeFromAnalytics,
          wouldApply: {
            internalAccount: true,
            internalType: type,
            excludeFromAnalytics: true
          },
          status: CONFIG.dryRun ? "would_update" : "updated"
        };
        
        if (!CONFIG.dryRun) {
          await db.collection("users").doc(uid).update({
            internalAccount: true,
            internalType: type,
            excludeFromAnalytics: true
          });
        }
        
        reports.push(report);
        console.log(`Report:`, JSON.stringify(report, null, 2));
      }
    }
  };

  await processCategory(CONFIG.qa, "qa");
  await processCategory(CONFIG.audit, "audit");
  await processCategory(CONFIG.regression, "regression");

  console.log("\n========================================================");
  console.log("FINAL REPORT");
  console.log("========================================================");
  console.log(`Dry Run: ${CONFIG.dryRun}`);
  console.log(`Processed Accounts: ${reports.length}`);
  reports.forEach(r => {
    console.log(`- ${r.email} | ${r.uid || "N/A"} | Status: ${r.status}`);
  });

  process.exit(0);
}

main().catch(console.error);
