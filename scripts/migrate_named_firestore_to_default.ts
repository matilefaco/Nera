import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * NERA FIRESTORE MIGRATION SCRIPT
 * From: ai-studio-4ebe4b2b-5d44-4968-bb61-5bb5b2cc5147
 * To: (default)
 */

const PROJECT_ID = "ai-studio-applet-webapp-bb725";
const SOURCE_DB_ID = "ai-studio-4ebe4b2b-5d44-4968-bb61-5bb5b2cc5147";
const IS_WRITE_MODE = process.argv.includes('--write');

if (!getApps().length) {
  initializeApp({
    projectId: PROJECT_ID,
  });
}

const dbSource = getFirestore(getApp(), SOURCE_DB_ID);
const dbTarget = getFirestore(); // default

const COLLECTIONS = [
  'users',
  'services',
  'appointments',
  'availability',
  'blocked_slots',
  'blocked_schedules',
  'booking_locks',
  'slugs',
  'reviews',
  'review_stats',
  'review_requests',
  'client_summaries',
  'push_subscriptions',
  'whatsapp_logs',
  'whatsapp_inbox',
  'analytics_events',
  'alerts',
  'waitlist',
  'waitlist_stats',
  'coupons',
  'referrals',
  'billing_logs'
];

function normalize(value: any): string {
  return String(value || "").trim().replace(/^"+|"+$/g, "");
}

async function migrateCollection(collectionName: string) {
  console.log(`\n[NERA] Migrating collection: ${collectionName}...`);
  
  const snapshot = await dbSource.collection(collectionName).get();
  
  if (snapshot.empty) {
    console.log(`[NERA] Collection ${collectionName} is empty. Skipping.`);
    return { copied: 0, skipped: 0, errors: 0 };
  }

  let copied = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const normalizedData = { ...data };

      // Normalization per rules
      if (data.professionalId !== undefined) {
        normalizedData.professionalId = normalize(data.professionalId);
      }
      
      if (data.uid !== undefined) {
        normalizedData.uid = normalize(data.uid);
      }

      if (collectionName === 'users') {
        if (!normalizedData.uid || normalizedData.uid !== doc.id) {
          normalizedData.uid = doc.id;
        }
      }

      if (IS_WRITE_MODE) {
        await dbTarget.collection(collectionName).doc(doc.id).set(normalizedData, { merge: true });
        copied++;
      } else {
        console.log(`[DRY-RUN] Would migrate ${collectionName}/${doc.id}`);
        copied++;
      }
    } catch (err: any) {
      console.error(`[ERROR] Failed to migrate ${collectionName}/${doc.id}:`, err.message);
      errors++;
    }
  }

  return { copied, skipped, errors };
}

async function runMigration() {
  console.log("==========================================");
  console.log("NERA FIRESTORE MIGRATION");
  console.log(`Mode: ${IS_WRITE_MODE ? 'REAL WRITE' : 'DRY-RUN'}`);
  console.log(`Source DB: ${SOURCE_DB_ID}`);
  console.log(`Target DB: (default)`);
  console.log("==========================================\n");

  const results: Record<string, any> = {};

  for (const coll of COLLECTIONS) {
    results[coll] = await migrateCollection(coll);
  }

  console.log("\n==========================================");
  console.log("MIGRATION SUMMARY");
  console.log("==========================================");
  let totalCopied = 0;
  let totalErrors = 0;

  Object.entries(results).forEach(([coll, res]) => {
    if (res.copied > 0 || res.errors > 0) {
      console.log(`${coll.padEnd(20)}: ${res.copied} copied, ${res.errors} errors`);
      totalCopied += res.copied;
      totalErrors += res.errors;
    }
  });

  console.log("------------------------------------------");
  console.log(`TOTALS: ${totalCopied} documents, ${totalErrors} errors`);
  console.log("==========================================\n");

  if (!IS_WRITE_MODE) {
    console.log("TIP: Run with '--write' to actually migrate data.");
  }
}

runMigration().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
