import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

async function main() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725";
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId,
    });
  }
  const db = getFirestore();

  console.log("Fetching users...");
  const usersSnap = await db.collection("users").get();
  
  const results = [];

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const uid = doc.id;
    const slug = data.slug || "";
    const name = data.name || data.displayName || "";
    const email = data.email || "";
    
    // Heuristics
    let motives = [];
    const isNumberSlug = /^\d+$/.test(slug);
    if (isNumberSlug) motives.push("slug numérico");
    
    const isNumberName = /^\d+$/.test(name);
    if (isNumberName) motives.push("nome numérico");
    
    const fakeKeywords = ["teste", "test", "demo", "qa", "audit", "regress", "fake"];
    const foundKeywords = fakeKeywords.filter(kw => 
      slug.toLowerCase().includes(kw) || name.toLowerCase().includes(kw)
    );
    if (foundKeywords.length > 0) motives.push(`contém (${foundKeywords.join(',')})`);
    
    if (email.toLowerCase().includes("example.com")) motives.push("email example.com");
    if (email.toLowerCase().includes("teste") || email.toLowerCase().includes("test@")) motives.push("email de teste");
    if (email.toLowerCase().includes("mailinator.com")) motives.push("email temporario");
    if (email.toLowerCase().startsWith("mamaifood")) motives.push("email dev test/mamaifood");

    // Absurd names simple check
    if (/(.)\1{4,}/.test(slug)) motives.push("slug absurdo repetido"); // e.g. testeeee
    if (/(.)\1{4,}/.test(name)) motives.push("nome absurdo repetido"); // e.g. piiiiim
    if (/(j{1,2}a){2,}/i.test(slug) || /(a{1,2}j){2,}/i.test(slug)) motives.push("risada/aleatorio no slug");
    if (/(.)\1+(.)\2+(.)\3+/.test(slug)) motives.push("padrao teclado"); // e.g. aabbcc
    if (/(.)\1+(.)\2+(.)\3+/.test(name)) motives.push("padrao teclado nome");
    const sillyNames = ["piiiimmm", "piiiimmmm", "mmmamama", "kkkkk", "jajajsje", "jsjsjsjd", "bubujsjsjsjsj", "pimpinha", "shitley", "pilonha"];
    if (sillyNames.includes(slug.toLowerCase()) || sillyNames.includes(name.toLowerCase())) {
        motives.push("nome aleatorio/fake conhecido");
    }


    // Fetch related docs
    const [
      servicesSnap, 
      appointmentsSnap, 
      reviewsSnap, 
      statsSnap,
      couponsSnap,
      analyticsSnap,
      referralsSnap,
      portfolioSnap
    ] = await Promise.all([
      db.collection("services").where("professionalId", "==", uid).limit(1).get(),
      db.collection("appointments").where("professionalId", "==", uid).limit(1).get(),
      db.collection("reviews").where("professionalId", "==", uid).limit(1).get(),
      db.collection("review_stats").doc(uid).get(),
      db.collection("coupons").where("professionalId", "==", uid).limit(1).get(),
      db.collection("analytics_events").where("professionalId", "==", uid).limit(1).get(),
      db.collection("users").doc(uid).collection("referrals").limit(1).get(),
      db.collection("users").doc(uid).collection("portfolio").limit(1).get()
    ]);

    const hasServices = !servicesSnap.empty;
    const hasAppointments = !appointmentsSnap.empty;
    const hasReviews = !reviewsSnap.empty;
    const hasCoupons = !couponsSnap.empty;
    const hasAnalytics = !analyticsSnap.empty;
    const hasReferrals = !referralsSnap.empty;
    const hasPortfolio = !portfolioSnap.empty;
    
    const hasStripe = !!(data.stripeCustomerId || data.stripeSubscriptionId);

    // Is missing basic onboarding setup?
    const isOnboardingIncomplete = !hasServices && !hasAppointments && !data.bio && !hasPortfolio;
    if (isOnboardingIncomplete && motives.length > 0) {
      motives.push("onboarding incompleto");
    }

    let risk = "LOW";
    let recommendation = "DELETE";

    // Adjust risk
    const manualReviewNeeded = hasStripe || hasAppointments || hasReviews || hasPortfolio || hasCoupons || hasReferrals;
    if (manualReviewNeeded) {
      risk = "HIGH";
      recommendation = "KEEP";
      // If it looks fake but has data, it might need manual review
      if (motives.length > 0) {
        recommendation = "REVIEW";
      }
    } else if (hasServices || hasAnalytics) {
      risk = "MID";
      recommendation = motives.length > 0 ? "REVIEW" : "KEEP";
    } else {
      if (motives.length === 0) {
        recommendation = "KEEP"; // Looks real and just empty
      }
    }

    let collections = [];
    if (hasServices) collections.push("services");
    if (hasAppointments) collections.push("appointments");
    if (hasReviews) collections.push("reviews");
    if (statsSnap.exists) collections.push("review_stats");
    if (hasCoupons) collections.push("coupons");
    if (hasAnalytics) collections.push("analytics_events");
    if (hasReferrals) collections.push("referrals");
    if (hasPortfolio) collections.push("portfolio");

    results.push({
      slug,
      uid,
      email,
      name,
      motives: motives.join(" | "),
      collections: collections.join(", "),
      hasAppointments,
      hasServices,
      hasReviews,
      hasStripe,
      risk,
      recommendation
    });
  }

  // Print as a Markdown Table
  console.log("\n### Relatório de Auditoria de Slugs\n");
  console.log("| Slug | UID | Email | Nome | Motivo Suspeita | Collections | Agendamentos? | Servicos? | Reviews? | Stripe? | Risco | Recomendação |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    // Only print if there is some reason or if it's completely empty just to show? User said "separar em 3 grupos" but maybe better to just print the ones that have SOME suspicion or are empty so they can be cleaned? "Fazer uma auditoria para identificar candidatos prováveis a exclusão" So we omit KEEP if there's no motive and it has data. Wait, let's group and print.
  }

  const deleteGroup = results.filter(r => r.recommendation === "DELETE");
  const reviewGroup = results.filter(r => r.recommendation === "REVIEW");
  const keepGroup = results.filter(r => r.recommendation === "KEEP");

  const printTableRow = (r: any) => {
    console.log(`| ${r.slug || 'N/A'} | ${r.uid} | ${r.email || '-'} | ${r.name || '-'} | ${r.motives || '-'} | ${r.collections || '-'} | ${r.hasAppointments ? 'Sim' : 'Não'} | ${r.hasServices ? 'Sim' : 'Não'} | ${r.hasReviews ? 'Sim' : 'Não'} | ${r.hasStripe ? 'Sim' : 'Não'} | ${r.risk} | **${r.recommendation}** |`);
  };

  console.log("\n#### 1. DELEÇÃO SEGURA (Candidatos claros e sem dados valiosos)\n");
  for (const r of deleteGroup) printTableRow(r);

  console.log("\n#### 2. REVISAR MANUALMENTE (Suspeitos com algum dado associado)\n");
  for (const r of reviewGroup) printTableRow(r);

  console.log("\n#### 3. MANTER (Contas aparentemente reais)\n");
  // Limit output for keepGroup if it's too large, or just print all? Let's just print them.
  for (const r of keepGroup) printTableRow(r);

  process.exit(0);
}

main().catch(console.error);
