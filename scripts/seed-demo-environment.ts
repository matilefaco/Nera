import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725";

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = getFirestore();
const auth = getAuth();

let DEMO_UID = "demo-isabella-rocha-uid-v1";
const DEMO_SLUG = "studio-aurora-demo";
const DEMO_EMAIL = "isabella.rocha@nera.com.br";
const DEMO_PASSWORD = "NeraDemo2026!";

const DEMO_METADATA = {
  isDemo: true,
  demoProfile: "studio-aurora",
  demoSeedVersion: "v1"
};

// Clean helper to format dates (YYYY-MM-DD)
const getOffsetDateString = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
};

async function seed() {
  console.log("====================================================");
  console.log("NERA DEMO ENVIRONMENT SEEDER");
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log("====================================================\n");

  // ---------------------------------------------------------------------------
  // 1. SETUP AUTH USER & DYNAMICALLY GET THE UID (Bypassing Disabled API constraint)
  // ---------------------------------------------------------------------------
  console.log("1. Setting up Firebase Authentication via REST API for demo user...");
  let apiKey = "AIzaSyDO2OcFecgXEfATajxcY0piPP8VfCoQGWU";
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.apiKey) {
        apiKey = config.apiKey;
      }
    }
  } catch (e: any) {
    console.warn("  - Warning: Could not read firebase-applet-config.json, using default apiKey.");
  }

  try {
    // Attempt login first
    const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD, returnSecureToken: true })
    });

    const signInJson: any = await signInRes.json();
    if (signInRes.status === 200 && signInJson.localId) {
      DEMO_UID = signInJson.localId;
      console.log(`  - Auth user already exists. Verified login successfully. UID: ${DEMO_UID}`);
    } else {
      // If login fails (e.g. user does not exist), let's create the user
      console.log("  - User not found or credentials invalid. Attempting sign-up...");
      const signUpRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD, returnSecureToken: true })
      });

      const signUpJson: any = await signUpRes.json();
      if (signUpRes.status === 200 && signUpJson.localId) {
        DEMO_UID = signUpJson.localId;
        console.log(`  - Successfully created new Auth user with email: ${DEMO_EMAIL}. UID: ${DEMO_UID}`);
      } else {
        throw new Error(signUpJson.error?.message || "Unknown error during sign-up");
      }
    }
  } catch (authErr: any) {
    console.error("  - CRITICAL ERROR: Failed to setup/verify Auth user via REST API:", authErr.message || authErr);
    console.warn(`  - Falling back to deterministic UID: ${DEMO_UID}`);
  }

  console.log(`\nUsing Demo UID: ${DEMO_UID}`);
  console.log(`Public slug: /${DEMO_SLUG}`);
  console.log(`Email: ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}\n`);

  // ---------------------------------------------------------------------------
  // 2. CLEANUP PREVIOUS DEMO DATA (Idempotency / Safety First)
  // ---------------------------------------------------------------------------
  console.log("2. Starting safe cleanup of previous demo data...");

  // Let's find all UIDs that have been used for the demo profile
  const usersToCleanupSnap = await db.collection("users")
    .where("isDemo", "==", true)
    .get();

  const uidsToCleanup = new Set<string>();
  usersToCleanupSnap.docs.forEach(doc => uidsToCleanup.add(doc.id));
  uidsToCleanup.add(DEMO_UID);
  uidsToCleanup.add("demo-isabella-rocha-uid-v1");

  console.log(`  - Identified demo UIDs to clean: ${Array.from(uidsToCleanup).join(", ")}`);

  for (const uid of uidsToCleanup) {
    const collectionsToCleanup = ["services", "appointments", "client_summaries", "blocked_schedules", "reviews"];
    for (const coll of collectionsToCleanup) {
      const snap = await db.collection(coll)
        .where("professionalId", "==", uid)
        .where("isDemo", "==", true)
        .get();
      
      if (!snap.empty) {
        console.log(`  - Deleting ${snap.size} old demo documents from '${coll}' for UID: ${uid}`);
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    }

    // Cleanup subcollections of the user (portfolio and client_notes)
    const portfolioSnap = await db.collection("users").doc(uid).collection("portfolio").get();
    if (!portfolioSnap.empty) {
      console.log(`  - Deleting ${portfolioSnap.size} old demo documents from portfolio subcollection for UID: ${uid}`);
      const batch = db.batch();
      portfolioSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    const clientNotesSnap = await db.collection("users").doc(uid).collection("client_notes").get();
    if (!clientNotesSnap.empty) {
      console.log(`  - Deleting ${clientNotesSnap.size} old demo documents from client_notes subcollection for UID: ${uid}`);
      const batch = db.batch();
      clientNotesSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    // Cleanup user, review_stats
    await db.collection("users").doc(uid).delete();
    await db.collection("review_stats").doc(uid).delete();
  }

  // Cleanup slug
  await db.collection("slugs").doc(DEMO_SLUG).delete();

  console.log("  [Cleanup Complete]\n");

  // ---------------------------------------------------------------------------
  // 3. CREATE FIRESTORE USER PROFILE
  // ---------------------------------------------------------------------------
  console.log("3. Writing Firestore user profile...");
  const userProfile = {
    uid: DEMO_UID,
    name: "Isabella Rocha",
    displayName: "Isabella Rocha",
    email: DEMO_EMAIL,
    phone: "11999998888",
    whatsapp: "11999998888",
    slug: DEMO_SLUG,
    specialty: "Nail Designer Premium",
    bio: "Especialista em unhas de alto padrão e acabamento fino. Mais de 6 anos de experiência proporcionando cuidado e sofisticação nos mínimos detalhes.",
    headline: "Unhas impecáveis com acabamento fino, alta resistência e conforto incomparável.",
    instagram: "studioaurorabeauty_demo",
    city: "São Paulo, SP",
    neighborhood: "Jardins",
    plan: "pro",
    signupPlan: "pro",
    planRank: 2,
    isVerified: true,
    indexable: true,
    published: true,
    onboardingCompleted: true,
    onboardingStep: 4,
    acceptsInstallments: true,
    profileTheme: {
      variant: "rose"
    },
    travelFeeMode: "none",
    serviceMode: "studio",
    workingHours: {
      workingDays: [1, 2, 3, 4, 5, 6], // Monday to Saturday
      startTime: "08:00",
      endTime: "18:00",
      breakStart: "12:00",
      breakEnd: "13:00"
    },
    studioAddress: {
      street: "Alameda Lorena",
      number: "1420",
      complement: "Sala 42",
      city: "São Paulo, SP",
      reference: "Próximo ao metrô Consolação",
      privacyMode: "public_full",
      parkingInfo: "Valet no local",
      hasAccessibility: true,
      accessibilityInfo: "Acesso para cadeirantes",
      locationNotes: "",
      hasParking: true,
      neighborhood: "Jardins",
      isSafeLocation: true
    },
    paymentMethods: ["pix", "credit_card", "debit_card", "cash"],
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80",
    photoUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80",
    dismissedTips: {
      blockTip: true,
      tip_coupons: true,
      tip_services: true,
      tip_agenda: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...DEMO_METADATA
  };

  await db.collection("users").doc(DEMO_UID).set(userProfile);
  console.log("  [User Profile Complete]\n");

  // ---------------------------------------------------------------------------
  // 4. RESERVE SLUG
  // ---------------------------------------------------------------------------
  console.log("4. Reserving slug in 'slugs' collection...");
  await db.collection("slugs").doc(DEMO_SLUG).set({
    active: true,
    professionalId: DEMO_UID,
    ...DEMO_METADATA
  });
  console.log("  [Slug Reserved]\n");

  // ---------------------------------------------------------------------------
  // 5. SEED PREMIUM SERVICES
  // ---------------------------------------------------------------------------
  console.log("5. Seeding premium nail services...");
  const services = [
    {
      id: "service_gel_stretch_demo",
      name: "Alongamento em Gel Premium",
      duration: 120,
      price: 180,
      description: "Alongamento com técnica avançada de gel, proporcionando naturalidade, brilho intenso e durabilidade extrema.",
      serviceCategory: "Alongamento",
      active: true,
      professionalId: DEMO_UID,
      ...DEMO_METADATA
    },
    {
      id: "service_gel_maintenance_demo",
      name: "Manutenção de Alongamento em Gel",
      duration: 90,
      price: 130,
      description: "Manutenção periódica sugerida a cada 21 dias para garantir a resistência e saúde das unhas naturais.",
      serviceCategory: "Manutenção",
      active: true,
      professionalId: DEMO_UID,
      ...DEMO_METADATA
    },
    {
      id: "service_spa_manicure_demo",
      name: "Spa de Mãos & Blindagem de Unhas",
      duration: 60,
      price: 90,
      description: "Tratamento nutritivo profundo para as mãos acompanhado da nossa famosa técnica de blindagem com esmaltação em gel.",
      serviceCategory: "Especialidades",
      active: true,
      professionalId: DEMO_UID,
      ...DEMO_METADATA
    },
    {
      id: "service_regular_foot_hand_demo",
      name: "Pé & Mão Clássico Premium",
      duration: 60,
      price: 75,
      description: "Cutilagem minuciosa e esmaltação tradicional com acabamento de alto brilho e hidratação com óleos essenciais.",
      serviceCategory: "Clássicos",
      active: true,
      professionalId: DEMO_UID,
      ...DEMO_METADATA
    }
  ];

  const servicesBatch = db.batch();
  services.forEach(svc => {
    servicesBatch.set(db.collection("services").doc(svc.id), svc);
  });
  await servicesBatch.commit();
  console.log(`  - Seeded ${services.length} services successfully.`);
  console.log("  [Services Complete]\n");

  // ---------------------------------------------------------------------------
  // 6. SEED PORTFOLIO IMAGES
  // ---------------------------------------------------------------------------
  console.log("6. Seeding portfolio subcollection...");
  const portfolioItems = [
    {
      id: "portfolio_1",
      url: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=600&q=80",
      category: "Alongamento",
      categoryId: "alongamento",
      categoryLabel: "Alongamentos",
      linkedServiceId: "service_gel_stretch_demo",
      linkedServiceName: "Alongamento em Gel Premium",
      isFeatured: true,
      orderIdx: 0,
      createdAt: new Date().toISOString(),
      ...DEMO_METADATA
    },
    {
      id: "portfolio_2",
      url: "https://i.pinimg.com/736x/25/f8/96/25f89663a6c71f5903d1b88d7454f9e3.jpg",
      category: "Especialidades",
      categoryId: "especialidades",
      categoryLabel: "Especialidades",
      linkedServiceId: "service_spa_manicure_demo",
      linkedServiceName: "Spa de Mãos & Blindagem de Unhas",
      isFeatured: true,
      orderIdx: 1,
      createdAt: new Date().toISOString(),
      ...DEMO_METADATA
    },
    {
      id: "portfolio_3",
      url: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=600&q=80",
      category: "Clássicos",
      categoryId: "classicos",
      categoryLabel: "Clássicos",
      linkedServiceId: "service_regular_foot_hand_demo",
      linkedServiceName: "Pé & Mão Clássico Premium",
      isFeatured: false,
      orderIdx: 2,
      createdAt: new Date().toISOString(),
      ...DEMO_METADATA
    }
  ];

  const portfolioBatch = db.batch();
  portfolioItems.forEach(item => {
    portfolioBatch.set(db.collection("users").doc(DEMO_UID).collection("portfolio").doc(item.id), item);
  });
  await portfolioBatch.commit();
  console.log(`  - Seeded ${portfolioItems.length} portfolio items.`);
  console.log("  [Portfolio Complete]\n");

  // ---------------------------------------------------------------------------
  // 7. SEED CLIENTS & SUMMARIES & NOTES
  // ---------------------------------------------------------------------------
  console.log("7. Seeding clients, summaries, and subcollection notes...");
  const clients = [
    {
      key: "11988887777",
      name: "Mariana Silva",
      email: "mariana.silva@demo.com",
      phone: "11988887777",
      segment: "diamond",
      totalAppointments: 12,
      confirmedAppointments: 12,
      cancelledAppointments: 0,
      noShowCount: 0,
      totalSpent: 1980,
      notes: "Prefere alongamento em gel no formato amendoado. Tem pele sensível ao desidratador."
    },
    {
      key: "11977776666",
      name: "Camila Oliveira",
      email: "camila.oliveira@demo.com",
      phone: "11977776666",
      segment: "gold",
      totalAppointments: 8,
      confirmedAppointments: 8,
      cancelledAppointments: 1,
      noShowCount: 0,
      totalSpent: 1040,
      notes: "Gosta de esmaltação escura e decorações minimalistas (filha única)."
    },
    {
      key: "11966665555",
      name: "Beatriz Santos",
      email: "beatriz.santos@demo.com",
      phone: "11966665555",
      segment: "diamond",
      totalAppointments: 14,
      confirmedAppointments: 14,
      cancelledAppointments: 0,
      noShowCount: 0,
      totalSpent: 1820,
      notes: "Frequência excelente, faz manutenção rigorosamente a cada 21 dias."
    },
    {
      key: "11955554444",
      name: "Juliana Mendes",
      email: "juliana.mendes@demo.com",
      phone: "11955554444",
      segment: "silver",
      totalAppointments: 4,
      confirmedAppointments: 3,
      cancelledAppointments: 1,
      noShowCount: 0,
      totalSpent: 385,
      notes: "Prefere atendimento rápido, adora o chá de hibisco do studio."
    },
    {
      key: "11944443333",
      name: "Fernanda Costa",
      email: "fernanda.costa@demo.com",
      phone: "11944443333",
      segment: "new",
      totalAppointments: 1,
      confirmedAppointments: 1,
      cancelledAppointments: 0,
      noShowCount: 0,
      totalSpent: 90,
      notes: "Primeiro atendimento recente, adorou a blindagem."
    }
  ];

  for (const client of clients) {
    const summaryId = `${DEMO_UID}_${client.key}`;
    const summaryData = {
      id: summaryId,
      professionalId: DEMO_UID,
      clientKey: client.key,
      clientName: client.name,
      clientPhone: client.phone,
      clientEmail: client.email,
      totalAppointments: client.totalAppointments,
      confirmedAppointments: client.confirmedAppointments,
      cancelledAppointments: client.cancelledAppointments,
      noShowCount: client.noShowCount,
      totalSpent: client.totalSpent,
      segment: client.segment,
      lastServiceName: "Alongamento em Gel Premium",
      firstAppointmentDate: getOffsetDateString(-60),
      lastAppointmentDate: getOffsetDateString(-2),
      createdAt: getOffsetDateString(-60),
      updatedAt: new Date().toISOString(),
      ...DEMO_METADATA
    };

    await db.collection("client_summaries").doc(summaryId).set(summaryData);

    // Save note in subcollection
    await db.collection("users").doc(DEMO_UID).collection("client_notes").doc(client.key).set({
      clientId: client.key,
      notes: client.notes,
      updatedAt: new Date().toISOString()
    });
  }
  console.log(`  - Seeded ${clients.length} client summaries and subcollection notes.`);
  console.log("  [Clients Complete]\n");

  // ---------------------------------------------------------------------------
  // 8. SEED APPOINTMENTS (DENSE COMPLETED PAST AND REALISTIC FUTURE AGENDA)
  // ---------------------------------------------------------------------------
  console.log("8. Seeding dynamic appointments...");
  const apptsBatch = db.batch();
  let apptIndex = 1;

  // A) Generate 40 past completed appointments over the past 30 days
  // This will create a very beautiful dashboard faturamento (billing) and graph.
  for (let d = -30; d < 0; d++) {
    const dateStr = getOffsetDateString(d);
    // 1 completed appointment per day, alternating client and service
    const client = clients[Math.abs(d) % clients.length];
    const service = services[Math.abs(d) % services.length];

    const apptId = `demo_appt_past_${apptIndex}`;
    const apptData = {
      id: apptId,
      appointmentId: apptId,
      clientName: client.name,
      clientEmail: client.email,
      clientWhatsapp: client.phone,
      serviceId: service.id,
      serviceName: service.name,
      duration: service.duration,
      price: service.price,
      totalPrice: service.price,
      date: dateStr,
      time: "10:00",
      locationType: "studio" as const,
      status: "completed" as const,
      token: `demo_token_past_${apptIndex}`,
      reservationCode: `AUR-${1000 + apptIndex}`,
      professionalId: DEMO_UID,
      professionalName: "Isabella Rocha",
      professionalWhatsapp: "11999998888",
      createdAt: new Date(new Date(dateStr).getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(dateStr + "T12:00:00").toISOString(),
      ...DEMO_METADATA
    };

    apptsBatch.set(db.collection("appointments").doc(apptId), apptData);
    apptIndex++;
  }

  // B) Generate realistic future agenda appointments
  // Today, tomorrow, and next 15 days
  const futurePlans = [
    { offset: 0, time: "09:00", client: clients[0], service: services[0], status: "completed" as const },
    { offset: 0, time: "14:00", client: clients[1], service: services[1], status: "confirmed" as const },
    { offset: 0, time: "16:30", client: clients[2], service: services[3], status: "pending" as const },
    { offset: 1, time: "10:00", client: clients[3], service: services[0], status: "confirmed" as const },
    { offset: 1, time: "14:00", client: clients[4], service: services[2], status: "confirmed" as const },
    { offset: 2, time: "11:00", client: clients[0], service: services[1], status: "confirmed" as const },
    { offset: 3, time: "09:00", client: clients[1], service: services[0], status: "confirmed" as const },
    { offset: 4, time: "15:00", client: clients[2], service: services[2], status: "pending" as const },
    { offset: 5, time: "14:00", client: clients[3], service: services[3], status: "cancelled_by_client" as const },
    { offset: 7, time: "10:00", client: clients[0], service: services[0], status: "confirmed" as const },
    { offset: 10, time: "13:00", client: clients[1], service: services[1], status: "confirmed" as const },
    { offset: 12, time: "16:00", client: clients[2], service: services[2], status: "pending" as const },
    { offset: 15, time: "11:00", client: clients[3], service: services[0], status: "confirmed" as const }
  ];

  futurePlans.forEach(plan => {
    const dateStr = getOffsetDateString(plan.offset);
    const apptId = `demo_appt_future_${apptIndex}`;
    const apptData = {
      id: apptId,
      appointmentId: apptId,
      clientName: plan.client.name,
      clientEmail: plan.client.email,
      clientWhatsapp: plan.client.phone,
      serviceId: plan.service.id,
      serviceName: plan.service.name,
      duration: plan.service.duration,
      price: plan.service.price,
      totalPrice: plan.service.price,
      date: dateStr,
      time: plan.time,
      locationType: "studio" as const,
      status: plan.status,
      token: `demo_token_future_${apptIndex}`,
      reservationCode: `AUR-${1000 + apptIndex}`,
      professionalId: DEMO_UID,
      professionalName: "Isabella Rocha",
      professionalWhatsapp: "11999998888",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...DEMO_METADATA
    };

    apptsBatch.set(db.collection("appointments").doc(apptId), apptData);
    apptIndex++;
  });

  await apptsBatch.commit();
  console.log(`  - Seeded ${apptIndex - 1} appointments successfully.`);
  console.log("  [Appointments Complete]\n");

  // ---------------------------------------------------------------------------
  // 9. SEED REVIEWS & REVIEW_STATS
  // ---------------------------------------------------------------------------
  console.log("9. Seeding reviews and review stats...");
  const reviews = [
    {
      id: "review_1_demo",
      bookingId: "demo_appt_past_1",
      professionalId: DEMO_UID,
      serviceId: "service_gel_stretch_demo",
      serviceName: "Alongamento em Gel Premium",
      rating: 5,
      tags: ["Pontualidade", "Atendimento profissional", "Resultado natural"],
      comment: "Excelente atendimento! O Studio Aurora é impecável e a Isabella é extremamente detalhista. Meu alongamento em gel dura semanas sem levantar!",
      publicDisplayMode: "named",
      publicApproved: true,
      moderationStatus: "approved",
      firstName: "Mariana",
      neighborhood: "Jardins",
      locationLabel: "Jardins, São Paulo",
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      ...DEMO_METADATA
    },
    {
      id: "review_2_demo",
      bookingId: "demo_appt_past_2",
      professionalId: DEMO_UID,
      serviceId: "service_spa_manicure_demo",
      serviceName: "Spa de Mãos & Blindagem de Unhas",
      rating: 5,
      tags: ["Resultado natural", "Boa comunicação"],
      comment: "Melhor nail designer de São Paulo! O Spa de Mãos é maravilhoso e a blindagem salvou as minhas unhas frágeis.",
      publicDisplayMode: "named",
      publicApproved: true,
      moderationStatus: "approved",
      firstName: "Camila",
      neighborhood: "Jardins",
      locationLabel: "Jardins, São Paulo",
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      ...DEMO_METADATA
    },
    {
      id: "review_3_demo",
      bookingId: "demo_appt_past_3",
      professionalId: DEMO_UID,
      serviceId: "service_gel_maintenance_demo",
      serviceName: "Manutenção de Alongamento em Gel",
      rating: 5,
      tags: ["Organização", "Praticidade"],
      comment: "Espaço super aconchegante e higiênico. A esmaltação em gel é impecável, super recomendo!",
      publicDisplayMode: "named",
      publicApproved: true,
      moderationStatus: "approved",
      firstName: "Beatriz",
      neighborhood: "Jardins",
      locationLabel: "Jardins, São Paulo",
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      ...DEMO_METADATA
    }
  ];

  const reviewsBatch = db.batch();
  reviews.forEach(rev => {
    reviewsBatch.set(db.collection("reviews").doc(rev.id), rev);
  });
  await reviewsBatch.commit();

  await db.collection("review_stats").doc(DEMO_UID).set({
    professionalId: DEMO_UID,
    averageRating: 5.0,
    totalReviews: 3,
    totalCompletedBookings: 45,
    topTags: ["Resultado natural", "Pontualidade", "Atendimento profissional", "Organização"],
    tagAnalytics: {
      "Resultado natural": 2,
      "Pontualidade": 1,
      "Atendimento profissional": 1,
      "Organização": 1
    },
    updatedAt: new Date().toISOString(),
    ...DEMO_METADATA
  });

  console.log("  [Reviews and Stats Complete]\n");

  // ---------------------------------------------------------------------------
  // 10. SEED BLOCKED SCHEDULES
  // ---------------------------------------------------------------------------
  console.log("10. Seeding realistic blocked schedules...");
  const blockedSchedules = [
    {
      id: "blocked_1_demo",
      professionalId: DEMO_UID,
      date: getOffsetDateString(3), // today + 3 days
      startTime: "13:00",
      endTime: "15:00",
      reason: "compromisso" as const,
      customReason: "Consulta odontológica",
      type: "manual" as const,
      isRecurring: false,
      createdAt: new Date().toISOString(),
      ...DEMO_METADATA
    },
    {
      id: "blocked_2_demo",
      professionalId: DEMO_UID,
      date: getOffsetDateString(5), // today + 5 days
      startTime: "12:00",
      endTime: "13:00",
      reason: "descanso" as const,
      customReason: "Horário de Almoço",
      type: "manual" as const,
      isRecurring: false,
      createdAt: new Date().toISOString(),
      ...DEMO_METADATA
    }
  ];

  const blockedBatch = db.batch();
  blockedSchedules.forEach(bs => {
    blockedBatch.set(db.collection("blocked_schedules").doc(bs.id), bs);
  });
  await blockedBatch.commit();
  console.log("  [Blocked Schedules Complete]\n");

  console.log("====================================================");
  console.log("NERA DEMO ENVIRONMENT SEEDED SUCCESSFULLY!");
  console.log(`Email: ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
  console.log(`Public slug: /${DEMO_SLUG}`);
  console.log("====================================================");
}

seed().catch(err => {
  console.error("FATAL ERROR IN DEMO ENVIRONMENT SEEDER:", err);
  process.exit(1);
});
