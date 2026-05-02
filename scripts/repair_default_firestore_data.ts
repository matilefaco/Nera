import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/**
 * NERA DATA REPAIR SCRIPT
 * Focus: (default) database
 * Mode: DRY-RUN by default. Use --write to apply.
 */

const PROJECT_ID = "ai-studio-applet-webapp-bb725";
const IS_WRITE_MODE = process.argv.includes("--write");

if (!getApps().length) {
  initializeApp({ projectId: PROJECT_ID });
}

const db = getFirestore();

function normalize(value: any): string {
  return String(value || "").trim().replace(/^"+|"+$/g, "");
}

function normalizeName(name: string): string {
  return String(name || "").toLowerCase().trim().replace(/\s+/g, " ");
}

async function repairData() {
  console.log("==========================================");
  console.log("NERA DATA REPAIR - (default) Database");
  console.log(`Mode: ${IS_WRITE_MODE ? "REAL WRITE" : "DRY-RUN"}`);
  console.log("==========================================\n");

  // 1. Fetch data
  const servicesSnap = await db.collection("services").get();
  const allServices = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // --- REPAIR SERVICES (Duplicates) ---
  console.log("--- REPAIRING SERVICES ---");
  const serviceKeys = new Map<string, any[]>();
  for (const s of allServices) {
    const sData = s as any;
    const pId = normalize(sData.professionalId || "no-prof");
    const key = `${pId}|${normalizeName(sData.name)}|${sData.duration}|${sData.price}`;
    
    if (!serviceKeys.has(key)) serviceKeys.set(key, []);
    serviceKeys.get(key)!.push(s);
  }

  for (const [key, docs] of serviceKeys.entries()) {
    if (docs.length > 1) {
      // Sort: keep the one that is already active, or the oldest/first one
      const sorted = [...docs].sort((a, b) => {
        if (a.active !== false && b.active === false) return -1;
        if (a.active === false && b.active !== false) return 1;
        return 0; // keep order
      });

      const master = sorted[0];
      const duplicates = sorted.slice(1);

      console.log(`[SERVICE] Keep ${master.id} for key ${key}. Deactivating ${duplicates.length} duplicates.`);

      for (const dup of duplicates) {
        if (dup.active !== false || !dup.duplicateReason) {
            if (IS_WRITE_MODE) {
                await db.collection("services").doc(dup.id).update({
                    active: false,
                    duplicateReason: "Found strict duplicate by name/duration/price",
                    duplicatedAt: FieldValue.serverTimestamp()
                });
                console.log(`  - Deactivated ${dup.id} (WRITE)`);
            } else {
                console.log(`  - [DRY] Would deactivate ${dup.id}`);
            }
        }
      }
    }
  }

  // --- REPAIR APPOINTMENTS (Zero Price) ---
  console.log("\n--- REPAIRING APPOINTMENTS ---");
  const appointmentsSnap = await db.collection("appointments").get();
  
  for (const doc of appointmentsSnap.docs) {
    const aData = doc.data();
    const updates: Record<string, any> = {};

    // ID Normalization
    const pId = normalize(aData.professionalId);
    if (pId !== aData.professionalId) {
      updates.professionalId = pId;
    }

    // Price repair
    if (!aData.price || aData.price === 0 || !aData.totalPrice || aData.totalPrice === 0) {
      console.log(`[APPOINTMENT] Fixing price for ${doc.id} (${aData.serviceName})`);
      
      let service = allServices.find(s => s.id === aData.serviceId);
      
      if (!service && aData.serviceName) {
        // Try to find by name for the same professional
        const normName = normalizeName(aData.serviceName);
        const matches = allServices.filter(s => 
          normalize((s as any).professionalId) === pId && 
          normalizeName((s as any).name) === normName &&
          (s as any).active !== false
        );
        if (matches.length === 1) {
          service = matches[0];
          updates.serviceId = service.id;
          console.log(`  - Found matching service by name: ${service.id}`);
        }
      }

      if (service) {
        const sData = service as any;
        if (!aData.price || aData.price === 0) updates.price = sData.price;
        if (!aData.totalPrice || aData.totalPrice === 0) updates.totalPrice = sData.price;
      } else {
        console.warn(`  - No service found to repair price for ${doc.id}`);
      }
    }

    if (Object.keys(updates).length > 0) {
      if (IS_WRITE_MODE) {
        await db.collection("appointments").doc(doc.id).update({
          ...updates,
          repairedAt: FieldValue.serverTimestamp()
        });
        console.log(`[APPOINTMENT] Updated ${doc.id} with: ${Object.keys(updates).join(", ")} (WRITE)`);
      } else {
        console.log(`[APPOINTMENT] [DRY] Would update ${doc.id} with: ${JSON.stringify(updates)}`);
      }
    }
  }

  // --- NORMALIZING USERS ---
  console.log("\n--- REPAIRING USERS ---");
  const usersSnap = await db.collection("users").get();
  for (const doc of usersSnap.docs) {
    const uData = doc.data();
    const updates: any = {};
    
    if (uData.uid !== doc.id) {
      updates.uid = doc.id;
    }

    if (Object.keys(updates).length > 0) {
      if (IS_WRITE_MODE) {
        await db.collection("users").doc(doc.id).update(updates);
        console.log(`[USER] Normalized ${doc.id} (WRITE)`);
      } else {
        console.log(`[USER] [DRY] Would normalize ${doc.id}`);
      }
    }

    // Slug repair
    if (uData.slug) {
      const slug = String(uData.slug).toLowerCase().trim();
      if (IS_WRITE_MODE) {
        const slugRef = db.collection("slugs").doc(slug);
        const slugDoc = await slugRef.get();
        if (!slugDoc.exists) {
          await slugRef.set({ uid: doc.id, professionalId: doc.id });
          console.log(`[SLUG] Created missing slug document for '${slug}' pointing to ${doc.id}`);
        }
      } else {
        console.log(`[SLUG] [DRY] Would check/create slug document for '${uData.slug}'`);
      }
    }
  }

  console.log("\n==========================================");
  console.log("REPAIR COMPLETE");
  console.log("==========================================");
}

repairData().catch(console.error);
