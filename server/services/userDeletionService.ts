import admin from "firebase-admin";
import { getDb, getStorageBucket } from "../firebaseAdmin.js";
import { logger } from "../utils/logger.js";

export interface UserDeletionOptions {
  dryRun?: boolean;
}

export interface UserDeletionReport {
  uid: string;
  slug: string;
  authUser: boolean;
  profile: number;
  appointments: number;
  clients: number;
  blockedSlots: number;
  analyticsEvents: number;
  auditLogs: number;
  storageFiles: number;
  collectionsAffected: string[];
  estimatedDeletes: number;
  details?: Record<string, number>;
  anonymizedRecordsCount?: number;
  anonymizedDetails?: Record<string, number>;
  message?: string;
  diagnostics?: {
    emails?: {
      masked: string;
      domain: string;
      firstLetter: string;
      length: number;
      origin: string;
    }[];
    phones?: {
      masked: string;
      digitCount: number;
      lastFour: string;
      origin: string;
    }[];
    matchesByCollection?: Record<string, Record<string, number>>;
  };
}

/**
 * Checks if an email is a real, valid email and not a generic/placeholder or too short.
 */
function isValidEmail(email: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  
  // Exclude empty, short or obviously generic placeholders
  if (clean.length < 5) return false;
  if (
    clean === "removido@nera.com.br" ||
    clean.includes("removed") ||
    clean.includes("example.com") ||
    clean.includes("test.com")
  ) {
    return false;
  }
  
  // Standard email format verification
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(clean);
}

/**
 * Checks if a phone number is real, valid, and not a generic placeholder/repeating sequence.
 */
function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  
  // Must be a numeric string of real length (Brazil phone numbers are typically 10 or 11 digits, so let's enforce min 10 digits and max 15 digits)
  if (digits.length < 10 || digits.length > 15) return false;
  
  // Reject obviously generic repeated pattern placeholders (e.g. 00000000000, 11111111111, 99999999999)
  if (/^(\d)\1+$/.test(digits)) return false;
  
  return true;
}

/**
 * Normalizes phone numbers to produce all possible matching variants
 * to avoid missing matches in third-party collections.
 */
function getPhoneVariants(phoneStr: string): string[] {
  if (!phoneStr) return [];
  const digits = phoneStr.replace(/\D/g, "");
  if (!digits) return [];
  const variants = [digits];
  // Brazil country code additions/subtractions
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    variants.push("55" + digits);
  }
  if (digits.startsWith("55") && digits.length > 2) {
    variants.push(digits.substring(2));
  }
  return Array.from(new Set(variants));
}

/**
 * Searches for a user's details and returns a report/cleanup mapping.
 */
async function gatherUserData(uid: string, db: admin.firestore.Firestore): Promise<{
  report: UserDeletionReport;
  docRefsToDelete: Record<string, admin.firestore.DocumentReference[]>;
  subcolRefsToDelete: admin.firestore.DocumentReference[];
  storageFilesToDelete: string[];
  docRefsToAnonymize: Record<string, { ref: admin.firestore.DocumentReference, update: Record<string, any> }[]>;
}> {
  if (!uid) {
    throw new Error("UID não pode ser vazio.");
  }

  // 1. Check Firebase Auth existence and retrieve email/phone
  let authUserExists = false;
  let authEmail = "";
  let authPhone = "";
  try {
    const authUser = await admin.auth().getUser(uid);
    authUserExists = true;
    authEmail = authUser.email || "";
    authPhone = authUser.phoneNumber || "";
  } catch (err: any) {
    if (err.code !== "auth/user-not-found") {
      logger.warn("DELETION", `Erro ao consultar Auth do usuário: ${uid} (Identity Toolkit / Auth API pode estar desativada ou inacessível)`, { error: err.message });
      // Non-blocking fallback: permit the script to run without crashing
    }
  }

  // 2. Read User Profile Document to find slug, email, phone
  const userDocRef = db.collection("users").doc(uid);
  const userDoc = await userDocRef.get();
  let slug = "";
  let profileEmail = "";
  let profilePhone = "";
  if (userDoc.exists) {
    const data = userDoc.data();
    slug = data?.slug || "";
    profileEmail = data?.email || "";
    profilePhone = data?.whatsapp || data?.phone || "";
  }

  // Consolidate unique email and phone search inputs, filtering with strong validators
  const rawEmails = Array.from(new Set([profileEmail, authEmail].map(e => e.trim().toLowerCase()).filter(Boolean)));
  const emails = rawEmails.filter(isValidEmail);

  const basePhones = Array.from(new Set([profilePhone, authPhone].map(p => p.trim()).filter(Boolean)));
  const rawPhones: string[] = [];
  for (const p of basePhones) {
    rawPhones.push(...getPhoneVariants(p));
  }
  const uniquePhones = Array.from(new Set(rawPhones)).filter(isValidPhone);

  const docRefsToDelete: Record<string, admin.firestore.DocumentReference[]> = {};
  const subcolRefsToDelete: admin.firestore.DocumentReference[] = [];
  const storageFilesToDelete: string[] = [];
  const docRefsToAnonymize: Record<string, { ref: admin.firestore.DocumentReference, update: Record<string, any> }[]> = {
    appointments: [],
    waitlist: [],
    reviews: [],
    review_requests: [],
    whatsapp_logs: [],
    alerts: []
  };

  const addDocRef = (collectionName: string, ref: admin.firestore.DocumentReference) => {
    if (!docRefsToDelete[collectionName]) {
      docRefsToDelete[collectionName] = [];
    }
    // Prevent duplicates
    if (!docRefsToDelete[collectionName].some(r => r.path === ref.path)) {
      docRefsToDelete[collectionName].push(ref);
    }
  };

  const addAnonymize = (collectionName: string, ref: admin.firestore.DocumentReference, update: Record<string, any>) => {
    if (!docRefsToAnonymize[collectionName]) {
      docRefsToAnonymize[collectionName] = [];
    }
    if (!docRefsToAnonymize[collectionName].some(item => item.ref.path === ref.path)) {
      docRefsToAnonymize[collectionName].push({ ref, update });
    }
  };

  // Add primary profile doc if exists
  if (userDoc.exists) {
    addDocRef("users", userDocRef);
  }

  // Add reviews stats doc if exists
  const reviewStatsRef = db.collection("review_stats").doc(uid);
  const reviewStatsSnap = await reviewStatsRef.get();
  if (reviewStatsSnap.exists) {
    addDocRef("review_stats", reviewStatsRef);
  }

  // Add account deletion requests doc if exists
  const accountDeletionReqRef = db.collection("accountDeletionRequests").doc(uid);
  const accountDeletionReqSnap = await accountDeletionReqRef.get();
  if (accountDeletionReqSnap.exists) {
    addDocRef("accountDeletionRequests", accountDeletionReqRef);
  }

  // 3. Subcollections of the users document (e.g. portfolio, client_notes, push_subscriptions, etc.)
  try {
    const subcollections = await userDocRef.listCollections();
    for (const subcol of subcollections) {
      const snap = await subcol.get();
      for (const doc of snap.docs) {
        subcolRefsToDelete.push(doc.ref);
      }
    }
  } catch (err: any) {
    logger.warn("DELETION", `Erro ao listar subcoleções do usuário: ${uid}`, { error: err.message });
  }

  // 4. Query other collections by professionalId / userId / uid where they are the owner
  const queryConfigs = [
    { name: "services", field: "professionalId" },
    { name: "appointments", field: "professionalId" },
    { name: "blocked_schedules", field: "professionalId" },
    { name: "blocked_slots", field: "professionalId" },
    { name: "blocked_slots", field: "userId" },
    { name: "availability", field: "professionalId" },
    { name: "availability", field: "userId" },
    { name: "reviews", field: "professionalId" },
    { name: "review_requests", field: "professionalId" },
    { name: "waitlist", field: "professionalId" },
    { name: "waitlist_stats", field: "professionalId" },
    { name: "coupons", field: "professionalId" },
    { name: "client_summaries", field: "professionalId" },
    { name: "analytics_events", field: "professionalId" },
    { name: "reservation_links", field: "professionalId" },
    { name: "whatsapp_logs", field: "professionalId" },
    { name: "whatsapp_logs", field: "userId" },
    { name: "billing_logs", field: "userId" },
    { name: "alerts", field: "professionalId" },
    { name: "alerts", field: "userId" },
    { name: "oauth_states", field: "uid" },
    { name: "accountDeletionRequests", field: "uid" },
    { name: "slugs", field: "uid" }
  ];

  for (const q of queryConfigs) {
    try {
      const snap = await db.collection(q.name).where(q.field, "==", uid).get();
      for (const doc of snap.docs) {
        addDocRef(q.name, doc.ref);
      }
    } catch (err: any) {
      logger.warn("DELETION", `Erro ao consultar coleção ${q.name} com campo ${q.field}`, { error: err.message });
    }
  }

  // 5. Query slugs collection specifically by document ID (user slug)
  if (slug) {
    try {
      const slugRef = db.collection("slugs").doc(slug.toLowerCase().trim());
      const slugSnap = await slugRef.get();
      if (slugSnap.exists) {
        addDocRef("slugs", slugRef);
      }
    } catch (err: any) {
      logger.warn("DELETION", `Erro ao verificar documento de slug individual: ${slug}`, { error: err.message });
    }
  }

  // 6. Range query for locks (booking_locks and waitlist_locks) starting with professionalId
  const lockCollections = ["booking_locks", "waitlist_locks"];
  for (const colName of lockCollections) {
    try {
      const locksSnap = await db.collection(colName)
        .where(admin.firestore.FieldPath.documentId(), ">=", uid + "_")
        .where(admin.firestore.FieldPath.documentId(), "<=", uid + "_\uf8ff")
        .get();
      for (const doc of locksSnap.docs) {
        addDocRef(colName, doc.ref);
      }
    } catch (err: any) {
      logger.warn("DELETION", `Erro ao consultar prefixo em ${colName}`, { error: err.message });
    }
  }

  // 7. Storage files with portfolio and avatar prefixes
  try {
    const bucket = getStorageBucket();
    if (bucket) {
      // Portfolio files
      const [portfolioFiles] = await bucket.getFiles({ prefix: `portfolio/${uid}/` });
      for (const file of portfolioFiles) {
        storageFilesToDelete.push(file.name);
      }

      // Avatar file
      const avatarFile = bucket.file(`avatars/${uid}`);
      const [exists] = await avatarFile.exists();
      if (exists) {
        storageFilesToDelete.push(avatarFile.name);
      }
    }
  } catch (err: any) {
    logger.warn("DELETION", `Erro ao verificar Firebase Storage do usuário: ${uid}`, { error: err.message });
  }

  // 8. ADVANCED SAFETY NET: Query and anonymize Wellington's data as a CLIENT in third-party collections
  const runThirdPartySearch = emails.length > 0 || uniquePhones.length > 0;
  
  logger.info("DELETION", `[DRY-RUN LOG] Busca de terceiros: ${runThirdPartySearch ? "EXECUTADA" : "IGNORADA"}. Emails válidos: ${emails.length}, Telefones válidos: ${uniquePhones.length}`);

  let thirdPartySearchMsg = "";
  const matchesByCollection: Record<string, Record<string, number>> = {
    appointments: {},
    waitlist: {},
    reviews: {},
    review_requests: {},
    whatsapp_logs: {},
    alerts: {}
  };

  const maskIdentifier = (id: string): string => {
    if (id.includes("@")) {
      const parts = id.split("@");
      const username = parts[0] || "";
      const domain = parts[1] || "";
      const maskedUsername = username.length > 1 ? username[0] + "*".repeat(username.length - 1) : "*";
      return `${maskedUsername}@${domain}`;
    } else {
      const digits = id.replace(/\D/g, "");
      if (digits.length <= 4) return "****";
      return "*".repeat(digits.length - 4) + digits.substring(digits.length - 4);
    }
  };

  const emailDiagnostics = emails.map(em => {
    const parts = em.split("@");
    const domain = parts[1] || "";
    const firstLetter = parts[0] ? parts[0][0] : "";
    const isProfile = em === profileEmail.trim().toLowerCase();
    const isAuth = em === authEmail.trim().toLowerCase();
    let origin = "Desconhecido";
    if (isProfile && isAuth) origin = "Perfil e Auth";
    else if (isProfile) origin = "Perfil (email)";
    else if (isAuth) origin = "Auth (email)";

    return {
      masked: maskIdentifier(em),
      domain,
      firstLetter,
      length: em.length,
      origin
    };
  });

  const phoneDiagnostics = uniquePhones.map(ph => {
    const digits = ph.replace(/\D/g, "");
    const lastFour = digits.substring(digits.length - 4);
    
    const isProfile = profilePhone ? getPhoneVariants(profilePhone).includes(ph) : false;
    const isAuth = authPhone ? getPhoneVariants(authPhone).includes(ph) : false;
    let origin = "Desconhecido";
    if (isProfile && isAuth) origin = "Perfil e Auth";
    else if (isProfile) origin = "Perfil (whatsapp/phone)";
    else if (isAuth) origin = "Auth (phoneNumber)";

    return {
      masked: maskIdentifier(ph),
      digitCount: digits.length,
      lastFour,
      origin
    };
  });

  if (!runThirdPartySearch) {
    thirdPartySearchMsg = "Busca de terceiros ignorada: nenhum identificador forte encontrado.";
  } else {
    thirdPartySearchMsg = "Busca de terceiros executada com sucesso.";
    logger.info("DELETION", `Consultando referências de cliente do usuário para anonimização...`, { emails, uniquePhones });

    // A. Query third party appointments where this user is the client
    const apptQueries: { promise: Promise<any>, identifier: string }[] = [];
    for (const em of emails) {
      if (em && isValidEmail(em)) {
        apptQueries.push({
          promise: db.collection("appointments").where("clientEmail", "==", em).get(),
          identifier: em
        });
      }
    }
    for (const ph of uniquePhones) {
      if (ph && isValidPhone(ph)) {
        apptQueries.push({
          promise: db.collection("appointments").where("clientPhone", "==", ph).get(),
          identifier: ph
        });
        apptQueries.push({
          promise: db.collection("appointments").where("clientWhatsapp", "==", ph).get(),
          identifier: ph
        });
        apptQueries.push({
          promise: db.collection("appointments").where("clientPhoneNormalized", "==", ph).get(),
          identifier: ph
        });
        apptQueries.push({
          promise: db.collection("appointments").where("clientWhatsappNormalized", "==", ph).get(),
          identifier: ph
        });
      }
    }

    try {
      const anonymizedApptIds: string[] = [];

      for (const q of apptQueries) {
        const snap = await q.promise;
        let queryMatches = 0;
        for (const doc of snap.docs) {
          const data = doc.data();
          // Safety: Only update/anonymize if it belongs to another professional (not deleted)
          if (data.professionalId !== uid) {
            queryMatches++;
            if (!anonymizedApptIds.includes(doc.id)) {
              anonymizedApptIds.push(doc.id);
              const appointmentUpdate = {
                clientName: "Cliente Removido",
                clientEmail: "removido@nera.com.br",
                clientPhone: "00000000000",
                clientWhatsapp: "00000000000",
                clientPhoneNormalized: "00000000000",
                clientWhatsappNormalized: "00000000000",
                clientPhotoUrl: "",
                clientNotes: admin.firestore.FieldValue.delete(),
                timeline: admin.firestore.FieldValue.arrayUnion({
                  type: "client_anonymized",
                  createdAt: new Date().toISOString(),
                  actor: "system",
                  label: "Dados pessoais do cliente removidos por solicitação de privacidade"
                }),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              };
              addAnonymize("appointments", doc.ref, appointmentUpdate);
            }
          }
        }
        if (queryMatches > 0) {
          const mKey = maskIdentifier(q.identifier);
          matchesByCollection.appointments[mKey] = (matchesByCollection.appointments[mKey] || 0) + queryMatches;
        }
      }

      // B. Query third party waitlist entries where this user is the client
      const waitlistQueries: { promise: Promise<any>, identifier: string }[] = [];
      for (const em of emails) {
        if (em && isValidEmail(em)) {
          waitlistQueries.push({
            promise: db.collection("waitlist").where("clientEmail", "==", em).get(),
            identifier: em
          });
        }
      }
      for (const ph of uniquePhones) {
        if (ph && isValidPhone(ph)) {
          waitlistQueries.push({
            promise: db.collection("waitlist").where("clientWhatsapp", "==", ph).get(),
            identifier: ph
          });
          waitlistQueries.push({
            promise: db.collection("waitlist").where("clientPhoneNormalized", "==", ph).get(),
            identifier: ph
          });
          waitlistQueries.push({
            promise: db.collection("waitlist").where("clientWhatsappNormalized", "==", ph).get(),
            identifier: ph
          });
        }
      }

      for (const q of waitlistQueries) {
        const snap = await q.promise;
        let queryMatches = 0;
        for (const doc of snap.docs) {
          const data = doc.data();
          if (data.professionalId !== uid) {
            queryMatches++;
            const waitlistUpdate = {
              clientName: "Cliente Removido",
              clientEmail: "removido@nera.com.br",
              clientWhatsapp: "00000000000",
              clientPhoneNormalized: "00000000000",
              clientWhatsappNormalized: "00000000000",
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            addAnonymize("waitlist", doc.ref, waitlistUpdate);
          }
        }
        if (queryMatches > 0) {
          const mKey = maskIdentifier(q.identifier);
          matchesByCollection.waitlist[mKey] = (matchesByCollection.waitlist[mKey] || 0) + queryMatches;
        }
      }

      // C. Query dependent records using the chunked appointment IDs
      const uniqueApptIds = Array.from(new Set(anonymizedApptIds));
      if (uniqueApptIds.length > 0) {
        const chunk = <T>(arr: T[], size: number): T[][] => {
          const chunks: T[][] = [];
          for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
          }
          return chunks;
        };

        const apptIdChunks = chunk(uniqueApptIds, 10);
        const dependentPromises: Promise<any>[] = [];

        for (const c of apptIdChunks) {
          dependentPromises.push(db.collection("reviews").where("bookingId", "in", c).get());
          dependentPromises.push(db.collection("review_requests").where("bookingId", "in", c).get());
          dependentPromises.push(db.collection("whatsapp_logs").where("appointmentId", "in", c).get());
          dependentPromises.push(db.collection("alerts").where("appointmentId", "in", c).get());
        }

        const depSnapshots = await Promise.all(dependentPromises);
        for (const snap of depSnapshots) {
          for (const doc of snap.docs) {
            const data = doc.data();
            const colName = doc.ref.parent.id;

            if (data.professionalId !== uid && data.userId !== uid) {
              matchesByCollection[colName] = matchesByCollection[colName] || {};
              matchesByCollection[colName]["via appointments matched"] = (matchesByCollection[colName]["via appointments matched"] || 0) + 1;

              if (colName === "reviews") {
                const reviewUpdate = {
                  firstName: "Cliente Anônima",
                  neighborhood: "",
                  locationLabel: "",
                  comment: "Comentário removido por solicitação de privacidade",
                  publicDisplayMode: "anonymous",
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                addAnonymize("reviews", doc.ref, reviewUpdate);
              } else if (colName === "review_requests") {
                const reviewRequestUpdate = {
                  clientDisplayName: "Cliente Removido",
                  clientNeighborhood: ""
                };
                addAnonymize("review_requests", doc.ref, reviewRequestUpdate);
              } else if (colName === "whatsapp_logs") {
                const whatsappLogUpdate = {
                  clientName: "Cliente Removido",
                  clientWhatsapp: "00000000000",
                  phone: "00000000000"
                };
                addAnonymize("whatsapp_logs", doc.ref, whatsappLogUpdate);
              } else if (colName === "alerts") {
                const alertUpdate = {
                  message: "Solicitação de agendamento (dados do cliente removidos por privacidade)",
                  title: "Agendamento Modificado"
                };
                addAnonymize("alerts", doc.ref, alertUpdate);
              }
            }
          }
        }
      }
    } catch (err: any) {
      logger.error("DELETION", "Erro ao buscar referências de cliente para anonimização", { error: err.message });
    }
  }

  // 9. Calculate aggregate categories and complete report
  const details: Record<string, number> = {};
  let collectionsAffected: string[] = [];

  for (const [colName, refs] of Object.entries(docRefsToDelete)) {
    if (refs.length > 0) {
      details[colName] = refs.length;
      collectionsAffected.push(colName);
    }
  }

  if (subcolRefsToDelete.length > 0) {
    details["subcollections_documents"] = subcolRefsToDelete.length;
    if (!collectionsAffected.includes("users")) {
      collectionsAffected.push("users");
    }
  }

  if (storageFilesToDelete.length > 0) {
    details["storage_files"] = storageFilesToDelete.length;
  }

  // Exact mappings for report fields
  const getColCount = (col: string) => (docRefsToDelete[col] || []).length;

  const profileCount = userDoc.exists ? 1 : 0;
  const appointmentsCount = getColCount("appointments");
  const clientsCount = getColCount("client_summaries");
  const blockedSlotsCount = getColCount("blocked_schedules") + getColCount("blocked_slots");
  const analyticsCount = getColCount("analytics_events");
  const auditCount = getColCount("billing_logs") + 
                     getColCount("whatsapp_logs") + 
                     getColCount("alerts") + 
                     getColCount("oauth_states") + 
                     getColCount("accountDeletionRequests");

  const totalDbDocs = Object.values(docRefsToDelete).reduce((sum, list) => sum + list.length, 0);
  const totalSubcolDocs = subcolRefsToDelete.length;
  const totalStorageFiles = storageFilesToDelete.length;
  const totalAuthUser = authUserExists ? 1 : 0;

  const estimatedDeletes = totalDbDocs + totalSubcolDocs + totalStorageFiles + totalAuthUser;

  // Anonymization stats
  const anonymizedDetails: Record<string, number> = {};
  let anonymizedRecordsCount = 0;
  if (runThirdPartySearch) {
    for (const [colName, list] of Object.entries(docRefsToAnonymize)) {
      if (list.length > 0) {
        anonymizedDetails[colName] = list.length;
        anonymizedRecordsCount += list.length;
      }
    }
  }

  const report: UserDeletionReport = {
    uid,
    slug: slug || "",
    authUser: authUserExists,
    profile: profileCount,
    appointments: appointmentsCount,
    clients: clientsCount,
    blockedSlots: blockedSlotsCount,
    analyticsEvents: analyticsCount,
    auditLogs: auditCount,
    storageFiles: totalStorageFiles,
    collectionsAffected: collectionsAffected.sort(),
    estimatedDeletes,
    details,
    anonymizedRecordsCount,
    anonymizedDetails,
    message: thirdPartySearchMsg,
    diagnostics: {
      emails: emailDiagnostics,
      phones: phoneDiagnostics,
      matchesByCollection
    }
  };

  return {
    report,
    docRefsToDelete,
    subcolRefsToDelete,
    storageFilesToDelete,
    docRefsToAnonymize
  };
}

/**
 * Exclui completamente um usuário pelo seu UID.
 */
export async function deleteUser(uid: string, options: UserDeletionOptions = {}): Promise<UserDeletionReport> {
  const db = getDb();
  if (!db) {
    throw new Error("Conexão com o banco de dados não inicializada.");
  }

  if (!uid || typeof uid !== "string" || uid.trim() === "") {
    throw new Error("UID inválido ou vazio para a exclusão.");
  }

  const { report, docRefsToDelete, subcolRefsToDelete, storageFilesToDelete, docRefsToAnonymize } = await gatherUserData(uid, db);

  // If dryRun is requested (or true by default), stop here and return the report
  if (options.dryRun !== false) {
    return report;
  }

  // Validation: check if anything at all was found to prevent empty accidental deletes/misconfigurations
  if (report.estimatedDeletes === 0 && (report.anonymizedRecordsCount || 0) === 0) {
    throw new Error("Nenhum dado ou usuário com o UID especificado foi encontrado para exclusão ou anonimização.");
  }

  logger.info("DELETION", `Iniciando exclusão real do usuário: ${uid}`, { 
    estimatedDeletes: report.estimatedDeletes, 
    anonymizedRecordsCount: report.anonymizedRecordsCount 
  });

  // 1. Delete Storage Files
  const bucket = getStorageBucket();
  if (bucket && storageFilesToDelete.length > 0) {
    for (const filePath of storageFilesToDelete) {
      try {
        await bucket.file(filePath).delete();
        logger.info("DELETION", `Arquivo de storage removido com sucesso: ${filePath}`);
      } catch (err: any) {
        logger.error("DELETION", `Erro ao remover arquivo de storage: ${filePath}`, { error: err.message });
        throw new Error(`Falha crítica na exclusão de arquivos: ${err.message}`);
      }
    }
  }

  // 2. Delete Firestore Documents & Subcollections in Batches
  const allDocRefs: admin.firestore.DocumentReference[] = [
    ...subcolRefsToDelete
  ];

  for (const refs of Object.values(docRefsToDelete)) {
    allDocRefs.push(...refs);
  }

  const BATCH_SIZE = 400;
  for (let i = 0; i < allDocRefs.length; i += BATCH_SIZE) {
    const chunk = allDocRefs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const ref of chunk) {
      batch.delete(ref);
    }
    try {
      await batch.commit();
      logger.info("DELETION", `Lote de ${chunk.length} documentos excluído com sucesso.`);
    } catch (err: any) {
      logger.error("DELETION", "Erro ao executar lote de exclusão no Firestore", { error: err.message });
      throw new Error(`Falha crítica ao excluir registros no Firestore: ${err.message}`);
    }
  }

  // 3. Update/Anonymize third-party records in Batches
  const allAnonymizeRefs: { ref: admin.firestore.DocumentReference, update: Record<string, any> }[] = [];
  for (const list of Object.values(docRefsToAnonymize)) {
    allAnonymizeRefs.push(...list);
  }

  if (allAnonymizeRefs.length > 0) {
    for (let i = 0; i < allAnonymizeRefs.length; i += BATCH_SIZE) {
      const chunk = allAnonymizeRefs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const item of chunk) {
        batch.update(item.ref, item.update);
      }
      try {
        await batch.commit();
        logger.info("DELETION", `Lote de ${chunk.length} documentos de terceiros anonimizados com sucesso.`);
      } catch (err: any) {
        logger.error("DELETION", "Erro ao executar lote de anonimização no Firestore", { error: err.message });
        throw new Error(`Falha crítica ao anonimizar registros de terceiros no Firestore: ${err.message}`);
      }
    }
  }

  // 4. Delete user from Firebase Auth
  if (report.authUser) {
    try {
      await admin.auth().deleteUser(uid);
      logger.info("DELETION", `Usuário Auth removido com sucesso: ${uid}`);
    } catch (err: any) {
      logger.error("DELETION", `Erro ao remover usuário Auth: ${uid}`, { error: err.message });
      throw new Error(`Falha crítica ao remover usuário do Firebase Auth: ${err.message}`);
    }
  }

  // 5. Register Audit Log of Deletion
  try {
    const auditRef = db.collection("audit_logs").doc("user_deletions").collection("events").doc();
    await auditRef.set({
      uid,
      slug: report.slug,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      estimatedDeletes: report.estimatedDeletes,
      collectionsAffected: report.collectionsAffected,
      details: report.details,
      anonymizedRecordsCount: report.anonymizedRecordsCount,
      anonymizedDetails: report.anonymizedDetails,
      initiatedBy: "admin_deletion_tool"
    });
    logger.info("DELETION", `Log de auditoria registrado para a exclusão do UID: ${uid}`);
  } catch (err: any) {
    logger.warn("DELETION", "Erro ao gravar o log de auditoria da exclusão", { error: err.message });
  }

  return {
    ...report,
    estimatedDeletes: report.estimatedDeletes
  };
}

/**
 * Exclui completamente um usuário pelo seu Slug.
 */
export async function deleteUserBySlug(slug: string, options: UserDeletionOptions = {}): Promise<UserDeletionReport> {
  const db = getDb();
  if (!db) {
    throw new Error("Conexão com o banco de dados não inicializada.");
  }

  if (!slug || typeof slug !== "string" || slug.trim() === "") {
    throw new Error("Slug inválido ou vazio para a exclusão.");
  }

  const cleanSlug = slug.toLowerCase().trim();

  // 1. Resolve UID via slugs collection (Source of Truth)
  const slugRef = db.collection("slugs").doc(cleanSlug);
  const slugDoc = await slugRef.get();
  let uid = "";

  if (slugDoc.exists) {
    uid = slugDoc.data()?.uid || "";
  }

  // 2. Fallback to users collection
  if (!uid) {
    const usersQuery = db.collection("users").where("slug", "==", cleanSlug).limit(1);
    const usersSnapshot = await usersQuery.get();
    if (!usersSnapshot.empty) {
      uid = usersSnapshot.docs[0].id;
    }
  }

  if (!uid) {
    throw new Error(`Usuário com o slug '${slug}' não foi encontrado.`);
  }

  // Call main deleteUser function
  return deleteUser(uid, options);
}
