
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

/**
 * NERA COMPREHENSIVE MIGRATION SCRIPT
 * 
 * Goals:
 * 1. Consolidate working hours: startTime, endTime, workingDays -> workingHours object.
 * 2. Remove 'services' field from root user doc (preserving subcollection).
 * 3. Correct 'address' string in Appointments to structured object { street, number, neighborhood, city }.
 * 4. Create 'slugs' collection: slugs/{slug} -> { uid }.
 * 
 * HOW TO RUN:
 * 1. npx tsx scripts/migrate_users.ts --dry-run (Standard diagnostic)
 * 2. npx tsx scripts/migrate_users.ts --apply   (Commits changes)
 */

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

const apply = process.argv.includes("--apply");
const dryRun = !apply;

async function migrate() {
  console.log("--------------------------------------------------");
  console.log("🚀 NERA MIGRATION STARTING");
  console.log(`MODE: ${dryRun ? "🔍 DRY RUN" : "🛠️  APPLY"}`);
  console.log("--------------------------------------------------\n");

  const batchSize = 100;
  let batch = db.batch();
  let currentBatchCount = 0;

  const stats = {
    usersAnalyzed: 0,
    usersModified: 0,
    appointmentsAnalyzed: 0,
    appointmentsModified: 0,
    slugsCreated: 0,
    errors: 0
  };

  // --- 1. USERS MIGRATION ---
  console.log("👉 Migrating Users...");
  const usersSnapshot = await db.collection("users").get();
  
  for (const doc of usersSnapshot.docs) {
    stats.usersAnalyzed++;
    const data = doc.data();
    const updates: Record<string, any> = {};
    const logChanges: string[] = [];

    // a. Migrate working hours
    if (!data.workingHours && (data.workingDays || data.startTime || data.endTime)) {
      updates.workingHours = {
        workingDays: data.workingDays || [1, 2, 3, 4, 5],
        startTime: data.startTime || "09:00",
        endTime: data.endTime || "18:00"
      };
      updates.workingDays = FieldValue.delete();
      updates.startTime = FieldValue.delete();
      updates.endTime = FieldValue.delete();
      logChanges.push("Consolidated 'workingHours' and removed legacy fields");
    }

    // b. Remove 'services' root field
    if (data.services !== undefined) {
      updates.services = FieldValue.delete();
      logChanges.push("Removed 'services' array from root document");
    }

    // c. Legacy cleanups from previous versions (if any)
    if (data.username !== undefined) {
      updates.username = FieldValue.delete();
      logChanges.push("Removed legacy 'username'");
    }

    const hasUpdates = Object.keys(updates).length > 0;

    // d. Slugs mapping
    let slugCreatedInRun = false;
    if (data.slug) {
      const slugDocRef = db.collection("slugs").doc(data.slug);
      // Check if it already exists to be idempotent
      const slugDoc = await slugDocRef.get();
      if (!slugDoc.exists) {
        if (apply) {
          batch.set(slugDocRef, { uid: doc.id, migratedAt: new Date().toISOString() });
          currentBatchCount++;
          if (currentBatchCount >= batchSize) {
            await batch.commit();
            batch = db.batch();
            currentBatchCount = 0;
          }
        }
        slugCreatedInRun = true;
        stats.slugsCreated++;
      }
    }

    if (hasUpdates || slugCreatedInRun) {
      if (hasUpdates) stats.usersModified++;
      console.log(`[USER: ${doc.id}] ${data.name || "Unknown"} (@${data.slug || 'no-slug'})`);
      logChanges.forEach(log => console.log(`  ✅ ${log}`));
      if (slugCreatedInRun) console.log(`  ✅ Created entry in 'slugs/${data.slug}'`);

      if (apply && hasUpdates) {
        batch.update(doc.ref, {
          ...updates,
          lastMigrationAt: new Date().toISOString()
        });
        currentBatchCount++;
        if (currentBatchCount >= batchSize) {
          await batch.commit();
          batch = db.batch();
          currentBatchCount = 0;
        }
      }
    }
  }

  // --- 2. APPOINTMENTS MIGRATION ---
  console.log("\n👉 Migrating Appointments...");
  const apptsSnapshot = await db.collection("appointments").get();

  for (const doc of apptsSnapshot.docs) {
    stats.appointmentsAnalyzed++;
    const data = doc.data();
    
    // c. Correct address
    if (typeof data.address === 'string' && data.address.trim() !== '') {
      stats.appointmentsModified++;
      const addressStr = data.address;
      
      // Basic parser: "Street, Number, Neighborhood, City"
      const parts = addressStr.split(',').map(p => p.trim());
      const structuredAddress = {
        street: parts[0] || addressStr,
        number: parts[1] || "",
        neighborhood: parts[2] || "",
        city: parts[3] || "Assumida da string"
      };

      console.log(`[APPT: ${doc.id}] Correcting address: "${addressStr}" -> object`);

      if (apply) {
        batch.update(doc.ref, {
          address: structuredAddress,
          addressLegacy: addressStr, // Keep original as backup
          addressMigratedAt: new Date().toISOString()
        });
        currentBatchCount++;
        if (currentBatchCount >= batchSize) {
          await batch.commit();
          batch = db.batch();
          currentBatchCount = 0;
        }
      }
    }
  }

  if (apply && currentBatchCount > 0) {
    await batch.commit();
  }

  console.log("\n--------------------------------------------------");
  console.log("📊 MIGRATION SUMMARY");
  console.log(`Users analyzed:        ${stats.usersAnalyzed}`);
  console.log(`Users modified:        ${stats.usersModified}`);
  console.log(`Slugs created:         ${stats.slugsCreated}`);
  console.log(`Appointments analyzed: ${stats.appointmentsAnalyzed}`);
  console.log(`Appointments modified: ${stats.appointmentsModified}`);
  console.log("--------------------------------------------------");
  
  if (dryRun) {
    console.log("\n💡 DRY RUN COMPLETE. Run with --apply to persist.");
  } else {
    console.log("\n✅ SUCCESS: Migration applied.");
  }
}

migrate().catch(err => {
  console.error("❌ MIGRATION FAILED:");
  console.error(err);
  process.exit(1);
});
