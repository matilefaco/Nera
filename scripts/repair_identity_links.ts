import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/**
 * NERA IDENTITY LINK REPAIR SCRIPT
 * Focus: Normalizing relationships between slugs, users, services, and appointments.
 * Mode: DRY-RUN by default. Use --write to apply.
 */

const PROJECT_ID = "ai-studio-applet-webapp-bb725";
const IS_WRITE_MODE = process.argv.includes("--write");

if (!getApps().length) {
  initializeApp({ projectId: PROJECT_ID });
}

const db = getFirestore();

function normalizeId(id: any): string {
  return String(id || "").trim().replace(/^"+|"+$/g, "");
}

function normalizeName(name: string): string {
  return String(name || "").toLowerCase().trim().replace(/\s+/g, " ");
}

async function runRepair() {
  console.log("==========================================");
  console.log("NERA IDENTITY REPAIR - (default) Database");
  console.log(`Mode: ${IS_WRITE_MODE ? "REAL WRITE" : "DRY-RUN"}`);
  console.log("==========================================\n");

  // 1. Fetch all data
  const [usersSnap, slugsSnap, servicesSnap, appsSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("slugs").get(),
    db.collection("services").get(),
    db.collection("appointments").get(),
  ]);

  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const slugs = slugsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const services = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const apps = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const userMap = new Map(users.map(u => [u.id, u]));
  const userBySlug = new Map(users.filter(u => (u as any).slug).map(u => [(u as any).slug.toLowerCase(), u]));

  // --- 2. REPAIR SLUGS ---
  console.log("--- PHASE 1: REPAIRING SLUGS ---");
  for (const slugDoc of slugs) {
    const sData = slugDoc as any;
    const currentUid = normalizeId(sData.uid);
    const slugName = slugDoc.id.toLowerCase();

    if (!userMap.has(currentUid)) {
      console.log(`[SLUG] Slug '${slugName}' points to non-existent UID: ${currentUid}`);
      const correctUser = userBySlug.get(slugName);
      if (correctUser) {
        console.log(`  - Found correct user by slug field: ${correctUser.id}`);
        if (IS_WRITE_MODE) {
          await db.collection("slugs").doc(slugDoc.id).update({ 
            uid: correctUser.id,
            professionalId: correctUser.id 
          });
          console.log(`    (UPDATED WRITE)`);
        } else {
          console.log(`    (DRY-RUN: Would update to ${correctUser.id})`);
        }
      } else {
        console.log(`  - CRITICAL: No user found for slug '${slugName}'. Manual intervention needed.`);
      }
    }
  }

  // --- 3. REPAIR SERVICES ---
  console.log("\n--- PHASE 2: REPAIRING SERVICES (Ownership) ---");
  const badProIds = new Set(["demo-uid", "s1", "", "null", "undefined"]);
  
  for (const service of services) {
    const sData = service as any;
    const pId = normalizeId(sData.professionalId);
    
    if (badProIds.has(pId) || !userMap.has(pId)) {
      console.log(`[SERVICE] Service '${sData.name}' (${service.id}) has bad/missing professionalId: [${pId}]`);
      
      // Try to find owner: if anyone else has a service with the exact same name AND is active
      const candidates = services.filter(s => 
        normalizeName((s as any).name) === normalizeName(sData.name) && 
        !badProIds.has(normalizeId((s as any).professionalId)) &&
        userMap.has(normalizeId((s as any).professionalId))
      );

      if (candidates.length > 0) {
        const bestOwner = normalizeId((candidates[0] as any).professionalId);
        console.log(`  - Probable owner found via service name match: ${bestOwner}`);
        if (IS_WRITE_MODE) {
          await db.collection("services").doc(service.id).update({ professionalId: bestOwner });
          console.log(`    (UPDATED WRITE)`);
        } else {
          console.log(`    (DRY-RUN: Would update to ${bestOwner})`);
        }
      } else {
        console.log(`  - No owner found. Deactivating service.`);
        if (IS_WRITE_MODE) {
          await db.collection("services").doc(service.id).update({ active: false, statusReason: "No valid professionalId found" });
          console.log(`    (DEACTIVATED WRITE)`);
        } else {
          console.log(`    (DRY-RUN: Would deactivate)`);
        }
      }
    }
  }

  // --- 4. DEDUPLICATE SERVICES ---
  console.log("\n--- PHASE 3: DEDUPLICATING SERVICES ---");
  // Refetch services to have updated professionalIds (for dry-run we use local logic if possible, but simpler to just group current state)
  const groupedServices = new Map<string, any[]>();
  for (const s of services) {
    const sData = s as any;
    const pId = normalizeId(sData.professionalId);
    if (!userMap.has(pId)) continue; // Skip those we couldn't fix above for now

    const key = `${pId}|${normalizeName(sData.name)}`;
    if (!groupedServices.has(key)) groupedServices.set(key, []);
    groupedServices.get(key)!.push(s);
  }

  for (const [key, list] of groupedServices.entries()) {
    if (list.length > 1) {
      console.log(`[DEDUP] Found ${list.length} services for ${key}`);
      
      const sorted = [...list].sort((a, b) => {
        const aData = a as any;
        const bData = b as any;
        
        // Priority 1: Has description
        const aHasDesc = !!aData.description?.trim();
        const bHasDesc = !!bData.description?.trim();
        if (aHasDesc !== bHasDesc) return aHasDesc ? -1 : 1;
        
        // Priority 2: Price > 0
        if ((aData.price || 0) > 0 && (bData.price || 0) === 0) return -1;
        if ((aData.price || 0) === 0 && (bData.price || 0) > 0) return 1;

        // Priority 3: Most recent
        const aDate = new Date(aData.updatedAt || aData.createdAt || 0).getTime();
        const bDate = new Date(bData.updatedAt || bData.createdAt || 0).getTime();
        return bDate - aDate;
      });

      const master = sorted[0];
      const dups = sorted.slice(1);

      console.log(`  - Keeping: ${master.id} (${(master as any).name})`);
      for (const dup of dups) {
        if ((dup as any).active !== false) {
          console.log(`  - Deactivating DUPLICATE: ${dup.id}`);
          if (IS_WRITE_MODE) {
            await db.collection("services").doc(dup.id).update({ 
               active: false, 
               duplicateOf: master.id,
               duplicatedAt: FieldValue.serverTimestamp()
            });
            console.log(`    (DEACTIVATED WRITE)`);
          } else {
            console.log(`    (DRY-RUN: Would deactivate)`);
          }
        }
      }
    }
  }

  // --- 5. REPAIR APPOINTMENTS ---
  console.log("\n--- PHASE 4: REPAIRING APPOINTMENTS ---");
  for (const app of apps) {
    const aData = app as any;
    const pId = normalizeId(aData.professionalId);
    
    if (badProIds.has(pId) || !userMap.has(pId)) {
      console.log(`[APPOINTMENT] App '${aData.serviceName}' (${app.id}) has bad professionalId: [${pId}]`);
      
      // Try to fix via serviceId if that service still exists and has a valid owner
      const service = services.find(s => s.id === aData.serviceId);
      if (service && userMap.has(normalizeId((service as any).professionalId))) {
        const correctOwner = normalizeId((service as any).professionalId);
        console.log(`  - Found correct owner via serviceId link: ${correctOwner}`);
        if (IS_WRITE_MODE) {
          await db.collection("appointments").doc(app.id).update({ professionalId: correctOwner });
          console.log(`    (UPDATED WRITE)`);
        } else {
          console.log(`    (DRY-RUN: Would update to ${correctOwner})`);
        }
      } else {
        console.log(`  - No path found to fix this appointment. Manual required.`);
      }
    }
  }

  console.log("\n==========================================");
  console.log("REPAIR COMPLETE");
  console.log("==========================================");
}

runRepair().catch(console.error);
