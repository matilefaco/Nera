
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

/**
 * NERA USER MIGRATION SCRIPT
 * 
 * Goals:
 * 1. Remove 'username' (standardized to 'slug').
 * 2. Move 'bio' and 'headline' to root if missing at root but present in professionalIdentity.
 * 3. Consolidate working hours into workingHours object.
 * 4. Idempotent and safe (no destructive deletions of existing data besides 'username').
 * 
 * HOW TO RUN:
 * 1. Ensure you have Node.js and npm installed.
 * 2. Run 'npm install' to install dependencies.
 * 3. Set up Firebase Admin credentials:
 *    - Cloud Environment: Works automatically if running on Cloud Run/Functions.
 *    - Local Development: Set GOOGLE_APPLICATION_CREDENTIALS to yours service account path.
 * 4. DRY RUN:  npx tsx scripts/migrate_users.ts
 * 5. APPLY:    npx tsx scripts/migrate_users.ts --apply
 */

// Initialize Firebase Admin
if (!admin.apps.length) {
  // If running locally, you might need:
  // const serviceAccount = require("./path-to-key.json");
  // admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

const apply = process.argv.includes("--apply");
const dryRun = !apply;

async function migrate() {
  console.log("--------------------------------------------------");
  console.log("🚀 NERA USER MIGRATION STARTING");
  console.log(`MODE: ${dryRun ? "🔍 DRY RUN (No changes will be saved)" : "🛠️  APPLY (Changes will be written to Firestore)"}`);
  console.log("--------------------------------------------------\n");

  const usersSnapshot = await db.collection("users").get();
  
  if (usersSnapshot.empty) {
    console.log("❌ No users found to migrate.");
    return;
  }

  let analyzedCount = 0;
  let changedCount = 0;
  let skippedCount = 0;

  const batchSize = 500;
  let batch = db.batch();
  let currentBatchCount = 0;

  for (const doc of usersSnapshot.docs) {
    analyzedCount++;
    const data = doc.data();
    const updates: Record<string, any> = {};
    const logChanges: string[] = [];

    // 1. Remove 'username'
    if (data.username !== undefined) {
      updates.username = FieldValue.delete();
      logChanges.push("Removed 'username'");
    }

    // 2. Migrate Bio to Root
    if ((data.bio === undefined || data.bio === "") && data.professionalIdentity?.bio) {
      updates.bio = data.professionalIdentity.bio;
      logChanges.push("Migrated 'bio' from professionalIdentity to root");
    }

    // 3. Migrate Headline to Root
    if ((data.headline === undefined || data.headline === "") && data.professionalIdentity?.headline) {
      updates.headline = data.professionalIdentity.headline;
      logChanges.push("Migrated 'headline' from professionalIdentity to root");
    }

    // 4. Consolidate workingHours
    if (!data.workingHours) {
      if (data.workingDays || data.startTime || data.endTime) {
        updates.workingHours = {
          workingDays: data.workingDays || [1, 2, 3, 4, 5],
          startTime: data.startTime || "09:00",
          endTime: data.endTime || "18:00"
        };
        logChanges.push("Consolidated 'workingHours' from legacy root fields");
      }
    }

    if (Object.keys(updates).length > 0) {
      changedCount++;
      console.log(`[ID: ${doc.id}] ${data.name || "Unknown User"} - ${data.slug || "no-slug"}`);
      logChanges.forEach(log => console.log(`  ✅ ${log}`));
      
      if (apply) {
        batch.update(doc.ref, {
          ...updates,
          migratedAt: new Date().toISOString()
        });
        currentBatchCount++;

        if (currentBatchCount >= batchSize) {
          await batch.commit();
          batch = db.batch();
          currentBatchCount = 0;
        }
      }
    } else {
      skippedCount++;
    }
  }

  if (apply && currentBatchCount > 0) {
    await batch.commit();
  }

  console.log("\n--------------------------------------------------");
  console.log("📊 MIGRATION SUMMARY");
  console.log(`Analyzed: ${analyzedCount}`);
  console.log(`Modified: ${changedCount}`);
  console.log(`Skipped:  ${skippedCount}`);
  console.log("--------------------------------------------------");
  
  if (dryRun && changedCount > 0) {
    console.log("\n💡 This was a DRY RUN. No data was actually modified.");
    console.log("Run with --apply to commit changes: npx tsx scripts/migrate_users.ts --apply");
  } else if (apply) {
    console.log("\n✅ Migration successfully applied to Firestore.");
  } else {
    console.log("\n✨ Everything is already up to date.");
  }
}

migrate().catch(error => {
  console.error("\n❌ CRITICAL ERROR DURING MIGRATION:");
  console.error(error);
  process.exit(1);
});
