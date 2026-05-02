import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * NERA DATA AUDIT SCRIPT
 * Focus: (default) database
 */

const PROJECT_ID = "ai-studio-applet-webapp-bb725";

if (!getApps().length) {
  initializeApp({ projectId: PROJECT_ID });
}

const db = getFirestore();

function normalizeName(name: string): string {
  return String(name || "").toLowerCase().trim().replace(/\s+/g, " ");
}

async function auditData() {
  console.log("==========================================");
  console.log("NERA DATA AUDIT - (default) Database");
  console.log("==========================================\n");

  // --- A) SERVICES ---
  console.log("--- AUDITING SERVICES ---");
  const servicesSnap = await db.collection("services").get();
  const allServices = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Total Services: ${allServices.length}`);

  const serviceKeys = new Map<string, any[]>();
  const activeServiceNames = new Map<string, string[]>();

  for (const s of allServices) {
    const sData = s as any;
    const pId = String(sData.professionalId || "no-prof");
    const key = `${pId}|${normalizeName(sData.name)}|${sData.duration}|${sData.price}`;
    
    if (!serviceKeys.has(key)) serviceKeys.set(key, []);
    serviceKeys.get(key)!.push(s);

    if (sData.active !== false) {
      const nameKey = `${pId}|${normalizeName(sData.name)}`;
      if (!activeServiceNames.has(nameKey)) activeServiceNames.set(nameKey, []);
      activeServiceNames.get(nameKey)!.push(s.id);
    }
  }

  console.log("\n[DETECTED DUPLICATES (Strict: Name+Duration+Price)]");
  serviceKeys.forEach((docs, key) => {
    if (docs.length > 1) {
      console.log(`Key: ${key}`);
      docs.forEach(d => console.log(`  - ID: ${d.id} (Active: ${d.active !== false})`));
    }
  });

  console.log("\n[DETECTED NAME OVERLAPS (Same Professional, Similar Name)]");
  activeServiceNames.forEach((ids, key) => {
    if (ids.length > 1) {
      console.log(`Professional|Name: ${key}`);
      console.log(`  - IDs: ${ids.join(", ")}`);
    }
  });

  // --- B) APPOINTMENTS ---
  console.log("\n--- AUDITING APPOINTMENTS ---");
  const appointmentsSnap = await db.collection("appointments").get();
  const allAppointments = appointmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Total Appointments: ${allAppointments.length}`);

  const problematicApps = [];
  for (const app of allAppointments) {
    const aData = app as any;
    const issues = [];
    
    if (!aData.price || aData.price === 0) issues.push("Price is 0/missing");
    if (!aData.totalPrice || aData.totalPrice === 0) issues.push("TotalPrice is 0/missing");
    
    const service = allServices.find(s => s.id === aData.serviceId);
    if (!service) {
      issues.push(`ServiceId ${aData.serviceId} not found`);
    } else {
      const sData = service as any;
      if (sData.professionalId !== aData.professionalId) {
        issues.push(`ProfessionalID mismatch (App: ${aData.professionalId} vs Service: ${sData.professionalId})`);
      }
    }

    if (issues.length > 0) {
      problematicApps.push({ id: app.id, issues, name: aData.serviceName, status: aData.status });
    }
  }

  if (problematicApps.length > 0) {
    console.log(`Found ${problematicApps.length} problematic appointments:`);
    problematicApps.forEach(p => {
      console.log(`  - ID: ${p.id} [${p.name}] Status: ${p.status}`);
      console.log(`    Issues: ${p.issues.join(", ")}`);
    });
  } else {
    console.log("No obvious appointment issues found.");
  }

  // --- C) USERS / SLUGS ---
  console.log("\n--- AUDITING USERS & SLUGS ---");
  const usersSnap = await db.collection("users").get();
  console.log(`Total Users: ${usersSnap.size}`);
  
  for (const uDoc of usersSnap.docs) {
    const uData = uDoc.data();
    if (uData.uid && uData.uid !== uDoc.id) {
       console.log(`[ALERT] User ${uDoc.id} has mismatched uid internal field: ${uData.uid}`);
    }
    if (uData.slug) {
      const slugDoc = await db.collection("slugs").doc(uData.slug).get();
      if (!slugDoc.exists) {
        console.log(`[ALERT] User ${uDoc.id} has slug '${uData.slug}' but it's not in 'slugs' collection.`);
      } else if (slugDoc.data()?.uid !== uDoc.id) {
        console.log(`[ALERT] Slug '${uData.slug}' points to ${slugDoc.data()?.uid} but user is ${uDoc.id}`);
      }
    }
  }

  console.log("\n==========================================");
  console.log("AUDIT COMPLETE");
  console.log("==========================================");
}

auditData().catch(console.error);
