import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  dryRun: false, // Default to true. MUST be false to actually delete.
  confirm: "DELETE_FAKE_ACCOUNTS", // MUST be "DELETE_FAKE_ACCOUNTS" for real execution
  slugs: ["teste"], // Slugs of accounts to delete
  uids: [] as string[] // UIDs of accounts to delete
};

// ============================================================================
// LOGIC
// ============================================================================

async function main() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725";
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  const db = getFirestore();
  const auth = getAuth();
  const storage = getStorage();
  const bucket = storage.bucket(projectId + ".appspot.com"); // standard default bucket
  
  console.log(`Starting Admin Fake Account Cleanup...`);
  console.log(`Dry Run: ${CONFIG.dryRun}`);
  
  if (!CONFIG.dryRun && CONFIG.confirm !== "DELETE_FAKE_ACCOUNTS") {
    console.error(`ERROR: dryRun is false but confirm string is not "DELETE_FAKE_ACCOUNTS". Aborting.`);
    process.exit(1);
  }

  const resultLog = {
    requestedAt: new Date().toISOString(),
    dryRun: CONFIG.dryRun,
    actor: "AdminScript",
    slugsInput: CONFIG.slugs,
    uidsInput: CONFIG.uids,
    deletedDocsCount: 0,
    deletedStorageCount: 0,
    deletedAuthUsers: 0,
    processedAccounts: [] as any[],
    blockedAccounts: [] as any[],
    errors: [] as any[]
  };

  const usersRef = db.collection("users");
  const slugsRef = db.collection("slugs");

  // 1. Gather UIDs to process
  const uidsToProcess = new Set<string>([...CONFIG.uids]);
  
  for (const slug of CONFIG.slugs) {
    // try to find uid from slugs collection
    const slugDoc = await slugsRef.doc(slug).get();
    if (slugDoc.exists) {
      uidsToProcess.add(slugDoc.data()?.uid || slugDoc.data()?.professionalId);
    } else {
      // try querying users collection
      const usersSnap = await usersRef.where("slug", "==", slug).get();
      usersSnap.forEach(doc => uidsToProcess.add(doc.id));
    }
  }

  const uidsArr = Array.from(uidsToProcess).filter(Boolean);
  console.log(`Found ${uidsArr.length} unique UIDs to process.`);

  for (const uid of uidsArr) {
    console.log(`\n--- Processing UID: ${uid} ---`);
    let userDoc;
    try {
      userDoc = await usersRef.doc(uid).get();
    } catch (e) {
      console.log(`Could not fetch user doc for ${uid}. Skipping.`);
      continue;
    }

    let userData = userDoc.data() || {};
    let slug = userData.slug || "";
    let email = userData.email || "";
    let name = userData.name || userData.displayName || "";
    let plan = userData.plan || "free";
    
    let blockReason = "";
    
    // Check Stripe
    if (userData.stripeCustomerId || userData.stripeSubscriptionId) {
       blockReason = "blocked_requires_manual_stripe_review";
    }
    const badStatuses = ["active", "trialing", "past_due"];
    if (userData.stripeSubscriptionStatus && badStatuses.includes(userData.stripeSubscriptionStatus)) {
       blockReason = "blocked_requires_manual_stripe_review (active status)";
    }
    
    if (plan !== "free" && plan !== "") {
       blockReason += blockReason ? " | " : "";
       blockReason += `blocked_plan_not_free (${plan})`;
    }

    // Check Appointments
    const appointmentsSnap = await db.collection("appointments")
      .where("professionalId", "==", uid).get();
    
    const now = new Date();
    for (const appt of appointmentsSnap.docs) {
      const data = appt.data();
      if (data.status === "confirmed" || data.status === "pending") {
         const dateStr = data.date; // string like YYYY-MM-DD
         if (dateStr && new Date(dateStr) >= now) {
            blockReason += blockReason ? " | " : "";
            blockReason += "future_confirmed_appointments";
            break;
         }
      }
    }

    // Check Reviews
    const reviewsSnap = await db.collection("reviews")
      .where("professionalId", "==", uid).get();
    for (const rev of reviewsSnap.docs) {
      if (rev.data().status === "approved" || rev.data().published) {
         blockReason += blockReason ? " | " : "";
         blockReason += "approved_reviews";
         break;
      }
    }

    // Plausible real heuristic
    const isNumberSlug = /^\\d+$/.test(slug);
    const fakeKeywords = ["teste", "test", "demo", "qa", "audit", "regress", "fake"];
    const foundKeywords = fakeKeywords.filter(kw => 
      slug.toLowerCase().includes(kw) || name.toLowerCase().includes(kw) || email.toLowerCase().includes(kw)
    );
    const isTemporario = email.toLowerCase().includes("example.com") || email.toLowerCase().includes("mailinator");
    const sillyNames = ["piiiimmm", "piiiimmmm", "mmmamama", "kkkkk", "jajajsje", "jsjsjsjd", "bubujsjsjsjsj", "pimpinha", "shitley", "pilonha"];
    const isSilly = sillyNames.includes(slug.toLowerCase()) || sillyNames.includes(name.toLowerCase());

    const seemsFake = isNumberSlug || foundKeywords.length > 0 || isTemporario || isSilly;
    
    if (!seemsFake && (email && name)) {
       blockReason += blockReason ? " | " : "";
       blockReason += "dados_plausivelmente_reais";
    }

    // Prepare report object
    const accountReport: any = {
      uid,
      slug,
      email,
      name,
      collections: {} as Record<string, number>,
      storagePaths: [] as string[],
      authDeleted: false
    };

    if (blockReason) {
      console.log(`[BLOCKED] ${slug || uid} - Reason: ${blockReason}`);
      resultLog.blockedAccounts.push({ uid, slug, email, reason: blockReason });
      continue;
    }

    console.log(`[APPROVED FOR DELETION] ${slug || uid}`);
    let docDeletes = 0;
    
    // MAPPING COLLECTIONS
    const queries = [
      { path: "services", field: "professionalId" },
      { path: "appointments", field: "professionalId" },
      { path: "appointments", field: "clientId" },
      { path: "booking_locks", field: "professionalId" },
      { path: "blocked_slots", field: "professionalId" },
      { path: "blocked_schedules", field: "professionalId" },
      { path: "coupons", field: "professionalId" },
      { path: "reviews", field: "professionalId" },
      { path: "review_requests", field: "professionalId" },
      { path: "client_summaries", field: "professionalId" },
      { path: "reservation_links", field: "professionalId" },
      { path: "analytics_events", field: "professionalId" },
      { path: "accountDeletionRequests", field: "uid" }
    ];

    const deleteBatch = async (docs: any[]) => {
       if (docs.length === 0) return;
       if (CONFIG.dryRun) {
          docDeletes += docs.length;
          return;
       }
       for (let i = 0; i < docs.length; i += 500) {
         const batch = db.batch();
         docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
         await batch.commit();
         docDeletes += docs.slice(i, i + 500).length;
       }
    };

    for (const q of queries) {
       try {
         const snap = await db.collection(q.path).where(q.field, "==", uid).get();
         accountReport.collections[q.path] = (accountReport.collections[q.path] || 0) + snap.size;
         await deleteBatch(snap.docs);
       } catch (e) {
         console.warn(`Warning mapping ${q.path}:`, e);
       }
    }

    // Direct docs
    const directDocs = [
      db.collection("users").doc(uid),
      db.collection("review_stats").doc(uid)
    ];
    if (slug) directDocs.push(db.collection("slugs").doc(slug));
    
    for (const dRef of directDocs) {
      try {
        const dSnap = await dRef.get();
        if (dSnap.exists) {
           const pathName = dRef.path.split("/")[0];
           accountReport.collections[pathName] = (accountReport.collections[pathName] || 0) + 1;
           if (!CONFIG.dryRun) {
             await dRef.delete();
           }
           docDeletes++;
        }
      } catch (e) {}
    }

    // Subcollections under users
    const subcols = ["portfolio", "referrals"];
    for (const sub of subcols) {
       try {
         const snap = await db.collection("users").doc(uid).collection(sub).get();
         accountReport.collections[`users/${sub}`] = snap.size;
         await deleteBatch(snap.docs);
       } catch(e) {}
    }

    // Storage
    const storagePathsToCheck = [
       `users/${uid}/`,
       `avatar/${uid}/`,
       `portfolio/${uid}/`
    ];
    let storageRemoved = 0;
    for (const prefix of storagePathsToCheck) {
      try {
        const [files] = await bucket.getFiles({ prefix });
        for (const file of files) {
           accountReport.storagePaths.push(file.name);
           if (!CONFIG.dryRun) {
             await file.delete();
           }
           storageRemoved++;
        }
      } catch (e) {
         // ignore issues with buckets (e.g. not existing locally)
      }
    }

    // Auth
    let authUserFound = false;
    try {
      if (!CONFIG.dryRun) {
         await auth.deleteUser(uid);
         authUserFound = true;
         accountReport.authDeleted = true;
         resultLog.deletedAuthUsers++;
      } else {
         const au = await auth.getUser(uid);
         if (au) authUserFound = true;
      }
    } catch (e: any) {
      if (e.code !== "auth/user-not-found" && e.code !== "app/network-error") {
        // Silently ignore Identity Toolkit errors in AI Studio env
        if (!e.message?.includes("Identity Toolkit API")) {
           console.warn(`Auth fetch/delete error for ${uid}:`, e.message);
        }
      }
    }

    resultLog.deletedDocsCount += docDeletes;
    resultLog.deletedStorageCount += storageRemoved;
    accountReport.status = CONFIG.dryRun ? "would_delete" : "deleted";
    resultLog.processedAccounts.push(accountReport);
  }

  // Audit Log
  if (!CONFIG.dryRun) {
     try {
       await db.collection("audit_logs").doc("admin_fake_account_cleanup").collection("events").add({
         ...resultLog,
         executedAt: FieldValue.serverTimestamp()
       });
     } catch (e) {
       console.error("Failed to write audit log", e);
     }
  }

  // Final Output
  console.log("\n========================================================");
  console.log("FINAL REPORT");
  console.log("========================================================");
  console.log(`Dry Run: ${resultLog.dryRun}`);
  console.log(`Blocked Accounts: ${resultLog.blockedAccounts.length}`);
  console.log(`Processed (Deleted/Would Delete): ${resultLog.processedAccounts.length}`);
  console.log(`Docs Removed: ${resultLog.deletedDocsCount}`);
  console.log(`Storage Paths Removed: ${resultLog.deletedStorageCount}`);
  console.log(`Auth Users Removed: ${resultLog.deletedAuthUsers}`);
  
  if (resultLog.blockedAccounts.length > 0) {
    console.log("\nBlocked Details:");
    resultLog.blockedAccounts.forEach(b => console.log(`- ${b.slug || b.uid} | ${b.email} | Reason: ${b.reason}`));
  }

  if (resultLog.processedAccounts.length > 0) {
    console.log("\nProcessed Details:");
    resultLog.processedAccounts.forEach(p => {
       console.log(`- ${p.slug} (${p.uid})`);
       console.log(`  Auth found: ${p.status === 'deleted' ? p.authDeleted : p.authDeleted || "Checked"}`);
       console.log(`  Collections: ${JSON.stringify(p.collections)}`);
       console.log(`  Storage: ${p.storagePaths.length} objects`);
    });
  }

  process.exit(0);
}

main().catch(console.error);
