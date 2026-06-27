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
  demoSeedVersion: "v2" // Wave 2
};

// Clean helper to format dates (YYYY-MM-DD)
const getOffsetDateString = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
};

interface ClientDef {
  key: string;
  name: string;
  email: string;
  phone: string;
  segment: "diamond" | "gold" | "silver" | "new";
  behavior: "weekly" | "biweekly" | "monthly" | "inactive" | "new";
  notes: string;
}

async function seed() {
  console.log("====================================================");
  console.log("NERA DEMO ENVIRONMENT SEEDER — ONDA 2");
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
    bio: "Especialista em unhas de alto padrão e acabamento fino. Mais de 6 anos de experiência proporcionando cuidado e sofisticação nos mínimos detalhes nos Jardins.",
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
  // 7. EXPANDED CLIENT LIST (25-40 Clients with authentic elite profiles)
  // ---------------------------------------------------------------------------
  console.log("7. Mapping premium clients profiles...");
  const clients: ClientDef[] = [
    // 8 VIPs (Diamond) - Regular Weekly
    {
      key: "11982345109",
      name: "Mariana de Albuquerque",
      email: "mari.albuquerque@icloud.com",
      phone: "11982345109",
      segment: "diamond",
      behavior: "weekly",
      notes: "Exigente com simetria. Prefere esmaltação em tons nude premium (marca Chanel/Dior) e formato amendoado. Toma chá de jasmim."
    },
    {
      key: "11987620934",
      name: "Beatriz Cavalcanti",
      email: "bia.cavalcanti@icloud.com",
      phone: "11987620934",
      segment: "diamond",
      behavior: "weekly",
      notes: "Faz manutenção rígida de 21 dias. Gosta de unhas de gel finas com acabamento ultra natural. Prefere silêncio durante o atendimento."
    },
    {
      key: "11989432056",
      name: "Letícia Klabin",
      email: "leticia.klabin@me.com",
      phone: "11989432056",
      segment: "diamond",
      behavior: "weekly",
      notes: "Designer de interiores. Muito detalhista com o formato e espessura das bordas. Usa apenas produtos hipoalergênicos."
    },
    {
      key: "11992001122",
      name: "Sophia Scarpa",
      email: "sophia.scarpa@icloud.com",
      phone: "11992001122",
      segment: "diamond",
      behavior: "weekly",
      notes: "Empresária do ramo de moda. Prefere esmaltação em gel com cores sazonais da Europa. Sempre pede água com gás e limão."
    },
    {
      key: "11994003344",
      name: "Antônia de Orleans",
      email: "antonia.orleans@gmail.com",
      phone: "11994003344",
      segment: "diamond",
      behavior: "biweekly",
      notes: "Adora blindagem de unhas com esmaltação nude clássica. Gosta de ambiente bem calmo."
    },
    {
      key: "11998007788",
      name: "Isabel de Bragança",
      email: "isabel.braganca@outlook.com",
      phone: "11998007788",
      segment: "diamond",
      behavior: "weekly",
      notes: "Adora alongamento em gel com acabamento em madrepérola. Frequenta o estúdio semanalmente."
    },
    {
      key: "11983003344",
      name: "Olívia Pignatari",
      email: "olivia.pignatari@me.com",
      phone: "11983003344",
      segment: "diamond",
      behavior: "biweekly",
      notes: "Alterna entre alongamento em gel e blindagem. Gosta de novidades em técnicas de alongamento."
    },
    {
      key: "11972002233",
      name: "Mariana Safra",
      email: "mariana.safra@icloud.com",
      phone: "11972002233",
      segment: "diamond",
      behavior: "weekly",
      notes: "Exige máxima discrição. Realiza spa de mãos e blindagem semanalmente."
    },

    // 11 Frequents (Gold) - Regular Biweekly
    {
      key: "11991054321",
      name: "Camila Rothschild Diniz",
      email: "camila.diniz@gmail.com",
      phone: "11991054321",
      segment: "gold",
      behavior: "biweekly",
      notes: "Frequenta eventos corporativos e sociais nos Jardins. Prefere tons escuros e discretos. Agenda sempre às quintas à tarde."
    },
    {
      key: "11993457812",
      name: "Juliana Alvarenga",
      email: "ju.alvarenga@gmail.com",
      phone: "11993457812",
      segment: "gold",
      behavior: "biweekly",
      notes: "Adora decorações minimalistas e francesinha moderna. Gosta de café espresso morno com água com gás."
    },
    {
      key: "11972348561",
      name: "Rafaela Brandão",
      email: "rafa.brandao@outlook.com",
      phone: "11972348561",
      segment: "gold",
      behavior: "biweekly",
      notes: "Advogada corporativa na Av. Paulista. Precisa de agilidade e unhas impecáveis que durem em reuniões. Prefere blindagem."
    },
    {
      key: "11993002233",
      name: "Valéria Prado",
      email: "valeria.prado@uol.com.br",
      phone: "11993002233",
      segment: "gold",
      behavior: "biweekly",
      notes: "Prefere formato quadrado com cantos ligeiramente arredondados. Muito pontual."
    },
    {
      key: "11995004455",
      name: "Heloísa Lovatelli",
      email: "helo.lovatelli@me.com",
      phone: "11995004455",
      segment: "gold",
      behavior: "monthly",
      notes: "Faz pé & mão clássico premium regularmente. Sempre traz seus próprios esmaltes importados."
    },
    {
      key: "11996005566",
      name: "Maria Eduarda Moreira",
      email: "madu.moreira@icloud.com",
      phone: "11996005566",
      segment: "gold",
      behavior: "biweekly",
      notes: "Estudante de medicina. Prefere unhas curtas e esmaltação ultra discreta ou apenas base de tratamento."
    },
    {
      key: "11999008899",
      name: "Constança Vasconcellos",
      email: "constanca.v@uol.com.br",
      phone: "11999008899",
      segment: "gold",
      behavior: "biweekly",
      notes: "Prefere formato stiletto moderado. Gosta de cores vibrantes no verão e sóbrias no inverno."
    },
    {
      key: "11982002233",
      name: "Cecília Trussardi",
      email: "cecilia.t@gmail.com",
      phone: "11982002233",
      segment: "gold",
      behavior: "biweekly",
      notes: "Prefere cutículas extremamente finas e hidratação redobrada nas mãos."
    },
    {
      key: "11984004455",
      name: "Lavínia Scarpa",
      email: "lavinia.scarpa@gmail.com",
      phone: "11984004455",
      segment: "gold",
      behavior: "monthly",
      notes: "Foca em tratamentos de spa de mãos. Prefere esmaltes hipoalergênicos de alta gama."
    },
    {
      key: "11989009900",
      name: "Gisela Trussardi",
      email: "gisela.t@uol.com.br",
      phone: "11989009900",
      segment: "gold",
      behavior: "biweekly",
      notes: "Super simpática, adora conversar. Prefere francesinha clássica com base translúcida."
    },
    {
      key: "11974004455",
      name: "Isabella Diniz",
      email: "isabella.diniz@outlook.com",
      phone: "11974004455",
      segment: "gold",
      behavior: "biweekly",
      notes: "Faz manutenção de gel rigorosa. Prefere tons de rosa antigo."
    },

    // 8 Occasionals (Silver) - Monthly/Intermittent
    {
      key: "11997006677",
      name: "Clara Fontes",
      email: "clara.fontes@gmail.com",
      phone: "11997006677",
      segment: "silver",
      behavior: "monthly",
      notes: "Gosta de nail art bem sutil em um ou dois dedos. Prefere chá de camomila."
    },
    {
      key: "11981001122",
      name: "Carolina Mattar",
      email: "carol.mattar@icloud.com",
      phone: "11981001122",
      segment: "silver",
      behavior: "monthly",
      notes: "Faz esmaltação em gel clássica para viagens. Prefere tons de vinho."
    },
    {
      key: "11985005566",
      name: "Alessandra Rossi",
      email: "alessandra.rossi@yahoo.com.br",
      phone: "11985005566",
      segment: "silver",
      behavior: "monthly",
      notes: "Atendimento agendado sempre nos fins de semana. Prefere tons metálicos discretos."
    },
    {
      key: "11988008899",
      name: "Letícia Setubal",
      email: "leticia.setubal@outlook.com",
      phone: "11988008899",
      segment: "silver",
      behavior: "monthly",
      notes: "Gosta de unhas impecáveis para reuniões de conselho. Prefere tons terrosos."
    },
    {
      key: "11971001122",
      name: "Vitória Magalhães",
      email: "vitoria.m@gmail.com",
      phone: "11971001122",
      segment: "silver",
      behavior: "monthly",
      notes: "Realiza esmaltação clássica vermelha. Prefere lixar as unhas em formato redondo."
    },
    {
      key: "11973003344",
      name: "Luiza Trajano de Souza",
      email: "luiza.souza@gmail.com",
      phone: "11973003344",
      segment: "silver",
      behavior: "monthly",
      notes: "Prefere cores claras, esmalte quase invisível. Gosta de hidratação intensa com cremes importados."
    },
    {
      key: "11975005566",
      name: "Helena Villela",
      email: "helena.villela@me.com",
      phone: "11975005566",
      segment: "silver",
      behavior: "monthly",
      notes: "Gosta de unhas clássicas e delicadas. Adora esmaltes da marca OPI."
    },
    {
      key: "11979009900",
      name: "Patrícia Villela",
      email: "patricia.villela@gmail.com",
      phone: "11979009900",
      segment: "silver",
      behavior: "monthly",
      notes: "Prefere tons sóbrios. Faz unhas clássicas mensais."
    },

    // 3 Inactives (Absent) - Old faturamento, silent last 30+ days
    {
      key: "11986006677",
      name: "Renata Jafet",
      email: "renata.jafet@icloud.com",
      phone: "11986006677",
      segment: "silver",
      behavior: "inactive",
      notes: "Cliente antiga que realizava pé & mão clássico premium todo mês. Mudou-se temporariamente para o exterior."
    },
    {
      key: "11987007788",
      name: "Marta Suplicy",
      email: "marta.suplicy@gmail.com",
      phone: "11987007788",
      segment: "gold",
      behavior: "inactive",
      notes: "Preferia blindagem de unhas com esmalte vermelho escuro. Sem agendamento nos últimos 50 dias."
    },
    {
      key: "11978008899",
      name: "Cristiana Arcangeli",
      email: "cris.arcangeli@yahoo.com",
      phone: "11978008899",
      segment: "silver",
      behavior: "inactive",
      notes: "Cliente assídua no passado. Não retorna há mais de 45 dias devido a viagens constantes de negócios."
    },

    // 3 News (New) - Only very recent
    {
      key: "11981546278",
      name: "Fernanda Lins",
      email: "nanda.lins@icloud.com",
      phone: "11981546278",
      segment: "new",
      behavior: "new",
      notes: "Indicação de amiga dos Jardins. Primeira blindagem recente, super satisfeita com a durabilidade. Gosta de esmaltação vermelha clássica."
    },
    {
      key: "11976006677",
      name: "Sofia Kogan",
      email: "sofia.kogan@gmail.com",
      phone: "11976006677",
      segment: "new",
      behavior: "new",
      notes: "Cliente nova indicada por Mariana de Albuquerque. Fez alongamento em gel e amou o acabamento fino."
    },
    {
      key: "11977007788",
      name: "Gabriela Baumgart",
      email: "gabi.baumgart@icloud.com",
      phone: "11977007788",
      segment: "new",
      behavior: "new",
      notes: "Fez primeiro agendamento recentemente para spa de mãos e blindagem. Muito comunicativa e adorou o local."
    }
  ];

  // ---------------------------------------------------------------------------
  // 8. SEED APPOINTMENTS (DENSE COMPLETED PAST AND REALISTIC FUTURE AGENDA)
  // ---------------------------------------------------------------------------
  console.log("8. Seeding dynamic and highly realistic historical appointments...");
  const apptsBatch = db.batch();
  let apptIndex = 1;

  const getDayOfWeek = (offsetDays: number): number => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.getDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
  };

  // We keep track of stats per client key to generate 100% mathematically consistent summaries
  const clientStatsMap: {
    [key: string]: {
      totalAppointments: number;
      confirmedAppointments: number; // completed
      cancelledAppointments: number; // cancelled_by_client
      noShowCount: number;
      totalSpent: number;
      firstAppointmentDate: string;
      lastAppointmentDate: string;
      lastServiceName: string;
    }
  } = {};

  // Initialize stats for all clients
  clients.forEach(c => {
    clientStatsMap[c.key] = {
      totalAppointments: 0,
      confirmedAppointments: 0,
      cancelledAppointments: 0,
      noShowCount: 0,
      totalSpent: 0,
      firstAppointmentDate: "",
      lastAppointmentDate: "",
      lastServiceName: ""
    };
  });

  let completedCount = 0;

  // A) Generate past completed appointments over the past 60 days
  // This will create a very beautiful and realistic faturamento history.
  for (let d = -60; d < 0; d++) {
    const dateStr = getOffsetDateString(d);
    const dayOfWeek = getDayOfWeek(d);
    
    if (dayOfWeek === 0) continue; // Closed on Sundays

    // Determine number of appointments for this day based on natural demand concentration
    let numAppts = 0;
    const r = Math.random();
    if (dayOfWeek === 1) {
      numAppts = r < 0.2 ? 1 : 0; // Monday: very light
    } else if (dayOfWeek === 2) {
      numAppts = r < 0.5 ? 1 : 2; // Tuesday: light-medium
    } else if (dayOfWeek === 3) {
      numAppts = r < 0.4 ? 1 : 2; // Wednesday: medium
    } else if (dayOfWeek === 4) {
      numAppts = r < 0.3 ? 2 : r < 0.8 ? 3 : 4; // Thursday: 2-4 appointments
    } else if (dayOfWeek === 5) {
      numAppts = r < 0.2 ? 3 : r < 0.8 ? 4 : 5; // Friday: 3-5 appointments
    } else if (dayOfWeek === 6) {
      numAppts = r < 0.2 ? 3 : r < 0.7 ? 4 : 5; // Saturday: 3-5 appointments
    }

    // Set of non-overlapping start times
    let times: string[] = [];
    if (numAppts === 1) {
      times = [["09:15", "13:30", "15:45"][Math.floor(Math.random() * 3)]];
    } else if (numAppts === 2) {
      times = ["09:15", "14:15"];
    } else if (numAppts === 3) {
      times = ["09:15", "13:30", "16:15"];
    } else if (numAppts === 4) {
      times = ["08:30", "11:00", "13:45", "16:15"];
    } else if (numAppts === 5) {
      times = ["08:30", "10:45", "13:15", "15:30", "17:45"];
    }

    // Keep track of clients booked on this day to avoid double-bookings
    const bookedOnDay = new Set<string>();

    for (let i = 0; i < numAppts; i++) {
      // Calculate dynamic weights for clients on day d based on their behavior
      const weightedPool: { client: ClientDef; weight: number }[] = [];
      clients.forEach(c => {
        if (bookedOnDay.has(c.key)) return; // Don't book twice on same day

        let weight = 0;
        if (c.behavior === "weekly") {
          weight = 12;
        } else if (c.behavior === "biweekly") {
          weight = 6;
        } else if (c.behavior === "monthly") {
          weight = 3;
        } else if (c.behavior === "inactive") {
          weight = d < -30 ? 8 : 0; // Only book in the first 30 days of the 60-day window
        } else if (c.behavior === "new") {
          weight = d >= -10 ? 10 : 0; // Only book in the last 10 days
        }
        if (weight > 0) {
          weightedPool.push({ client: c, weight });
        }
      });

      if (weightedPool.length === 0) continue;

      // Select client using weighted random
      const totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);
      let rand = Math.random() * totalWeight;
      let selectedClient = weightedPool[0].client;
      for (const item of weightedPool) {
        rand -= item.weight;
        if (rand <= 0) {
          selectedClient = item.client;
          break;
        }
      }

      bookedOnDay.add(selectedClient.key);

      // Select service based on general popularity
      const serviceRand = Math.random();
      let service = services[0]; // Gel Stretch (180)
      if (serviceRand < 0.35) {
        service = services[0];
      } else if (serviceRand < 0.65) {
        service = services[1]; // Maintenance (130)
      } else if (serviceRand < 0.85) {
        service = services[2]; // Spa Manicure (90)
      } else {
        service = services[3]; // Pé & Mão Clássico (75)
      }

      const timeStr = times[i];

      // Introduce financial and behavioral imperfections: 92% completed, 6% cancelled_by_client, 2% no_show
      const statusRand = Math.random();
      let status: "completed" | "cancelled_by_client" | "no_show" = "completed";
      if (statusRand < 0.06) {
        status = "cancelled_by_client";
      } else if (statusRand < 0.08) {
        status = "no_show";
      }

      const apptId = `demo_appt_past_${apptIndex}`;
      const apptData = {
        id: apptId,
        appointmentId: apptId,
        clientName: selectedClient.name,
        clientEmail: selectedClient.email,
        clientWhatsapp: selectedClient.phone,
        serviceId: service.id,
        serviceName: service.name,
        duration: service.duration,
        price: service.price,
        totalPrice: service.price,
        date: dateStr,
        time: timeStr,
        locationType: "studio" as const,
        status: status,
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

      // Update client stats
      const stats = clientStatsMap[selectedClient.key];
      stats.totalAppointments += 1;
      if (status === "completed") {
        completedCount++;
        stats.confirmedAppointments += 1;
        stats.totalSpent += service.price;
        stats.lastServiceName = service.name;
        if (!stats.firstAppointmentDate || dateStr < stats.firstAppointmentDate) {
          stats.firstAppointmentDate = dateStr;
        }
        if (!stats.lastAppointmentDate || dateStr > stats.lastAppointmentDate) {
          stats.lastAppointmentDate = dateStr;
        }
      } else if (status === "cancelled_by_client") {
        stats.cancelledAppointments += 1;
      } else if (status === "no_show") {
        stats.noShowCount += 1;
      }
    }
  }

  // B) Generate realistic future agenda appointments with exact matches for user constraints
  // Today (offset 0 - Friday), Tomorrow (offset 1), and next 15 days
  // Crucially, today has exactly Mariana de Albuquerque (09:15, completed), Juliana Alvarenga (13:30, confirmed)
  // and Camila Rothschild Diniz (16:15, confirmed), totaling 3 appointments, perfectly matching the user's dashboard!
  // Future pending requests are kept to exactly 4 items (well within the 2-4 requests threshold).
  const futurePlans = [
    // Today (offset 0)
    { offset: 0, time: "09:15", client: clients[0], service: services[0], status: "completed" as const },  // Mariana de Albuquerque (Completed)
    { offset: 0, time: "13:30", client: clients[3], service: services[1], status: "confirmed" as const },  // Juliana Alvarenga (Confirmed)
    { offset: 0, time: "16:15", client: clients[1], service: services[2], status: "confirmed" as const },  // Camila Rothschild Diniz (Confirmed)
    
    // Tomorrow (offset 1)
    { offset: 1, time: "10:45", client: clients[2], service: services[0], status: "confirmed" as const },  // Beatriz Cavalcanti
    { offset: 1, time: "14:15", client: clients[6], service: services[1], status: "confirmed" as const },  // Letícia Klabin
    { offset: 1, time: "16:30", client: clients[29], service: services[2], status: "pending" as const },  // Sofia Kogan (PENDING #1)
    
    // Monday (offset 3)
    { offset: 3, time: "14:30", client: clients[7], service: services[0], status: "confirmed" as const },  // Sophia Scarpa
    
    // Tuesday (offset 4)
    { offset: 4, time: "10:15", client: clients[4], service: services[1], status: "confirmed" as const },  // Antônia de Orleans
    
    // Wednesday (offset 5)
    { offset: 5, time: "09:15", client: clients[10], service: services[3], status: "confirmed" as const }, // Heloísa Lovatelli
    { offset: 5, time: "13:30", client: clients[14], service: services[2], status: "pending" as const },  // Constança Vasconcellos (PENDING #2)
    
    // Thursday (offset 6)
    { offset: 6, time: "10:45", client: clients[11], service: services[1], status: "confirmed" as const }, // Maria Eduarda Moreira
    { offset: 6, time: "14:00", client: clients[12], service: services[3], status: "pending" as const },  // Clara Fontes (PENDING #3)
    { offset: 6, time: "16:15", client: clients[15], service: services[2], status: "cancelled_by_client" as const }, // Carolina Mattar (CANCELLED)
    
    // Friday (offset 7)
    { offset: 7, time: "09:00", client: clients[16], service: services[0], status: "confirmed" as const }, // Cecília Trussardi
    { offset: 7, time: "11:30", client: clients[17], service: services[1], status: "confirmed" as const }, // Olívia Pignatari
    { offset: 7, time: "14:30", client: clients[18], service: services[2], status: "confirmed" as const }, // Lavínia Scarpa
    { offset: 7, time: "17:00", client: clients[30], service: services[3], status: "pending" as const },  // Gabriela Baumgart (PENDING #4)
    
    // Saturday (offset 8)
    { offset: 8, time: "08:30", client: clients[23], service: services[0], status: "confirmed" as const }, // Gisela Trussardi
    { offset: 8, time: "11:00", client: clients[24], service: services[1], status: "confirmed" as const }, // Vitória Magalhães
    { offset: 8, time: "13:45", client: clients[25], service: services[2], status: "confirmed" as const }, // Mariana Safra
    { offset: 8, time: "16:15", client: clients[26], service: services[3], status: "confirmed" as const }  // Luiza Trajano de Souza
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

    // For today/completed future appointments, let's also aggregate to make sure CRM is 100% synchronized
    const stats = clientStatsMap[plan.client.key];
    if (plan.status === "completed") {
      stats.totalAppointments += 1;
      stats.confirmedAppointments += 1;
      stats.totalSpent += plan.service.price;
      stats.lastServiceName = plan.service.name;
      if (!stats.firstAppointmentDate || dateStr < stats.firstAppointmentDate) stats.firstAppointmentDate = dateStr;
      if (!stats.lastAppointmentDate || dateStr > stats.lastAppointmentDate) stats.lastAppointmentDate = dateStr;
    }
  });

  await apptsBatch.commit();
  console.log(`  - Seeded ${apptIndex - 1} total appointments (historical + future) successfully.`);
  console.log("  [Appointments Complete]\n");

  // ---------------------------------------------------------------------------
  // 9. WRITE COMPREHENSIVE CRM AND CLIENT NOTES
  // ---------------------------------------------------------------------------
  console.log("9. Syncing CRM aggregates and client notes to Firestore...");
  for (const client of clients) {
    const stats = clientStatsMap[client.key];
    const summaryId = `${DEMO_UID}_${client.key}`;

    // Ensure we have realistic default aggregate values if a client had no generated completed appointments
    let totalSpent = stats.totalSpent;
    let totalAppointments = stats.totalAppointments;
    let confirmedAppointments = stats.confirmedAppointments;
    let cancelledAppointments = stats.cancelledAppointments;
    let noShowCount = stats.noShowCount;
    let lastServiceName = stats.lastServiceName || "Pé & Mão Clássico Premium";
    let firstDate = stats.firstAppointmentDate || getOffsetDateString(-45);
    let lastDate = stats.lastAppointmentDate || getOffsetDateString(-5);

    if (client.behavior === "inactive") {
      // Inactives have last activity between 45 and 60 days ago
      firstDate = getOffsetDateString(-60);
      lastDate = getOffsetDateString(-46);
      if (totalAppointments === 0) {
        totalAppointments = 2;
        confirmedAppointments = 2;
        totalSpent = 150;
        lastServiceName = "Pé & Mão Clássico Premium";
      }
    } else if (client.behavior === "new") {
      // New clients have only recent/single activity
      firstDate = getOffsetDateString(-2);
      lastDate = getOffsetDateString(-2);
      if (totalAppointments === 0) {
        totalAppointments = 1;
        confirmedAppointments = 1;
        totalSpent = 90;
        lastServiceName = "Spa de Mãos & Blindagem de Unhas";
      }
    } else {
      // Regular/VIP/Occasional clients fallback
      if (totalAppointments === 0) {
        totalAppointments = client.behavior === "weekly" ? 8 : client.behavior === "biweekly" ? 4 : 2;
        confirmedAppointments = totalAppointments;
        totalSpent = confirmedAppointments * 110;
        lastServiceName = "Manutenção de Alongamento em Gel";
      }
    }

    const summaryData = {
      id: summaryId,
      professionalId: DEMO_UID,
      clientKey: client.key,
      clientName: client.name,
      clientPhone: client.phone,
      clientEmail: client.email,
      totalAppointments,
      confirmedAppointments,
      cancelledAppointments,
      noShowCount,
      totalSpent,
      segment: client.segment,
      lastServiceName,
      firstAppointmentDate: firstDate,
      lastAppointmentDate: lastDate,
      createdAt: firstDate,
      updatedAt: new Date().toISOString(),
      ...DEMO_METADATA
    };

    await db.collection("client_summaries").doc(summaryId).set(summaryData);

    // Save notes in professional's client_notes subcollection
    await db.collection("users").doc(DEMO_UID).collection("client_notes").doc(client.key).set({
      clientId: client.key,
      notes: client.notes,
      updatedAt: new Date().toISOString()
    });
  }
  console.log(`  - Synchronized ${clients.length} detailed client profiles.`);
  console.log("  [CRM and Notes Complete]\n");

  // ---------------------------------------------------------------------------
  // 10. SEED REVIEWS & REVISED REVIEW_STATS
  // ---------------------------------------------------------------------------
  console.log("10. Seeding reviews and review stats...");
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
    totalCompletedBookings: completedCount, // Cohrent count
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
  // 11. SEED BLOCKED SCHEDULES
  // ---------------------------------------------------------------------------
  console.log("11. Seeding realistic blocked schedules...");
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
