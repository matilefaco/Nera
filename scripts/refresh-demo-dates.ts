import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725";

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = getFirestore();

// Helper to format dates (YYYY-MM-DD)
const getOffsetDateString = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
};

async function refresh() {
  console.log("====================================================");
  console.log("NERA DEMO DATE REFRESHER");
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log("====================================================\n");

  // Fetch the active demo user UID dynamically from Firestore
  const usersSnap = await db.collection("users")
    .where("isDemo", "==", true)
    .where("demoProfile", "==", "studio-aurora")
    .limit(1)
    .get();

  if (usersSnap.empty) {
    console.log("  - No active demo profile found in Firestore. Run 'npm run demo:seed' first.");
    return;
  }
  
  const DEMO_UID = usersSnap.docs[0].id;
  console.log(`Target User: Isabella Rocha (${DEMO_UID})\n`);

  // 1. Refresh appointments
  console.log("1. Querying demo appointments...");
  const apptsSnap = await db.collection("appointments")
    .where("professionalId", "==", DEMO_UID)
    .where("isDemo", "==", true)
    .get();

  if (apptsSnap.empty) {
    console.log("  - No demo appointments found. Run 'npm run demo:seed' first.");
    return;
  }

  console.log(`  - Found ${apptsSnap.size} demo appointments. Recalculating offsets...`);
  const batch = db.batch();
  let updatedApptsCount = 0;

  apptsSnap.docs.forEach(doc => {
    const data = doc.data();
    const id = doc.id;
    let newDate = data.date;

    // We can parse the offset from the ID itself!
    // demo_appt_past_{idx} -> where idx was between 1 and 30, offset was -(31 - idx) or similar.
    // Or we can map them based on whether they are marked as past or future.
    if (id.startsWith("demo_appt_past_")) {
      const idx = parseInt(id.replace("demo_appt_past_", ""), 10);
      if (!isNaN(idx)) {
        // We originally had 30 past appointments with offset = d from -30 to -1.
        // Let's map idx (1 to 30) to offset (-30 to -1) -> offset = idx - 31.
        const offset = idx - 31;
        newDate = getOffsetDateString(offset);
      }
    } else if (id.startsWith("demo_appt_future_")) {
      const idx = parseInt(id.replace("demo_appt_future_", ""), 10);
      if (!isNaN(idx)) {
        // Our future plans list had indices starting after the past ones (from 31 onwards).
        // Let's map future plans by their relative offset.
        // Since we know the deterministic list of future offsets:
        // [0, 0, 0, 1, 1, 2, 3, 4, 5, 7, 10, 12, 15]
        const futureOffsets = [0, 0, 0, 1, 1, 2, 3, 4, 5, 7, 10, 12, 15];
        // future index starts at 31
        const futureSeq = idx - 31;
        if (futureSeq >= 0 && futureSeq < futureOffsets.length) {
          const offset = futureOffsets[futureSeq];
          newDate = getOffsetDateString(offset);
        }
      }
    }

    if (newDate !== data.date) {
      batch.update(doc.ref, {
        date: newDate,
        updatedAt: new Date().toISOString()
      });
      updatedApptsCount++;
    }
  });

  if (updatedApptsCount > 0) {
    await batch.commit();
    console.log(`  - Successfully updated dates for ${updatedApptsCount} appointments.`);
  } else {
    console.log("  - All appointment dates are already up to date.");
  }

  // 2. Refresh blocked schedules
  console.log("\n2. Querying demo blocked schedules...");
  const blockedSnap = await db.collection("blocked_schedules")
    .where("professionalId", "==", DEMO_UID)
    .where("isDemo", "==", true)
    .get();

  if (!blockedSnap.empty) {
    console.log(`  - Found ${blockedSnap.size} blocked schedules. Shifting offsets...`);
    const blockedBatch = db.batch();
    let updatedBlockedCount = 0;

    blockedSnap.docs.forEach(doc => {
      const id = doc.id;
      let newDate = doc.data().date;

      if (id === "blocked_1_demo") {
        newDate = getOffsetDateString(3); // offset 3 days
      } else if (id === "blocked_2_demo") {
        newDate = getOffsetDateString(5); // offset 5 days
      }

      if (newDate !== doc.data().date) {
        blockedBatch.update(doc.ref, {
          date: newDate,
          createdAt: new Date().toISOString()
        });
        updatedBlockedCount++;
      }
    });

    if (updatedBlockedCount > 0) {
      await blockedBatch.commit();
      console.log(`  - Successfully updated dates for ${updatedBlockedCount} blocked schedules.`);
    } else {
      console.log("  - All blocked schedules are already up to date.");
    }
  }

  console.log("\n====================================================");
  console.log("NERA DEMO DATES REFRESHED SUCCESSFULLY!");
  console.log("====================================================");
}

refresh().catch(err => {
  console.error("FATAL ERROR IN DEMO DATE REFRESHER:", err);
  process.exit(1);
});
