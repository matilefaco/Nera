import {
  bookingRateLimiter,
  reviewSubmitLimiter,
} from "../middleware/rateLimiter.js";
import express from "express";
import { randomBytes } from "crypto";
import admin from "firebase-admin";
import { getDb } from "../firebaseAdmin.js";
import { logger, maskPhone, maskToken, maskUid } from "../utils/logger.js";
import {
  sendBookingConfirmedEmail,
  sendDigitalReceiptEmail,
  sendBookingCancelledClientEmail,
  sendBookingDeclinedClientEmail,
  sendProfessionalBookingRescheduledEmail,
} from "../emails/sendEmail.js";
import {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from "./calendarRoutes.js";
import {
  requireFirebaseAuth,
  AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import {
  isRevenueStatus,
  isCancelledStatus,
  isPendingStatus,
  isActiveSlotStatus,
} from "../constants/appointmentStatus.js";
import {
  sendBookingPendingClientNotification,
  sendNewBookingRequestNotification,
  sendBookingConfirmedClientNotification,
} from "../services/notificationService.js";
import { requireCronSecret } from "../middleware/cronSecretMiddleware.js";
import { PUBLIC_APP_URL, shouldSendEmail, markEmailSent } from "../utils.js";
import { buildCancellationByProMessageForClient, buildBookingRejectedMessageForClient } from "../services/whatsappMessages.js";
import { sendWhatsApp } from "../services/whatsappService.js";

const router = express.Router();

const debugOnly = (req: any, res: any, next: any) => {
  const isProdEnv = process.env.NODE_ENV === "production";
  const isFirebaseProd =
    process.env.GCLOUD_PROJECT && process.env.FUNCTIONS_EMULATOR !== "true";

  // Try to block if we know for sure it's production
  if (isProdEnv || (isFirebaseProd && !process.env.NODE_ENV)) {
    return res.status(404).send("Not Found");
  }

  // Check the hostname as a fallback for SSR / Express
  if (req.hostname && req.hostname.includes("usenera.com")) {
    return res.status(404).send("Not Found");
  }

  return next();
};

// --- HELPER FUNCTIONS FOR BACKEND BOOKING ---
const normalizeId = (id: any): string => {
  return String(id || "")
    .trim()
    .replace(/^"+|"+$/g, "");
};

const getClientKey = (
  phone?: string,
  email?: string,
  name?: string,
): string => {
  const cleanPhone = phone?.replace(/\D/g, "") || "";
  if (cleanPhone && cleanPhone.length >= 8) return cleanPhone;
  if (email) return email.toLowerCase().trim();
  return `name-${(name || "anon").toLowerCase().replace(/\s+/g, "-")}`;
};

// --- NEW: SECURE SLOT LOOKUP (Blindagem) ---
router.get("/public/occupied-slots/:professionalId", async (req, res) => {
  console.log("[DEBUG_OCCUPIED_SLOTS] Routing info:", {
    params: req.params,
    professionalId: req.params.professionalId,
    query: req.query,
    url: req.url,
    originalUrl: req.originalUrl,
  });

  const db = getDb();
  const { professionalId } = req.params;
  const start = req.query?.start;
  const end = req.query?.end;

  let startVal = start;
  let endVal = end;

  // Fallback for Firebase / Proxies dropping query strings from req.query
  if (!startVal || !endVal) {
    try {
      const urlStr = req.originalUrl || req.url || "";
      if (urlStr.includes("?")) {
        const searchParams = new URLSearchParams(
          urlStr.substring(urlStr.indexOf("?")),
        );
        if (!startVal) startVal = searchParams.get("start");
        if (!endVal) endVal = searchParams.get("end");
      }
    } catch (e) {
      console.error("Error parsing fallback query params:", e);
    }
  }

  // 1. Strict Validation of Inputs
  if (
    !professionalId ||
    typeof professionalId !== "string" ||
    professionalId === "undefined" ||
    professionalId === "null"
  ) {
    logger.warn("BOOKING", "occupied-slots blocked: invalid professionalId", {
      meta: { professionalId },
    });
    return res
      .status(400)
      .json({ error: "Identificador de profissional inválido", slots: [] });
  }

  // Ensure start and end are valid strings (Express can return string | string[] | ParsedQs | ParsedQs[])
  const startStr =
    typeof startVal === "string"
      ? startVal.trim()
      : Array.isArray(startVal)
        ? String(startVal[0]).trim()
        : "";
  const endStr =
    typeof endVal === "string"
      ? endVal.trim()
      : Array.isArray(endVal)
        ? String(endVal[0]).trim()
        : "";

  if (!startStr || !endStr) {
    logger.warn(
      "BOOKING",
      "occupied-slots blocked: missing or malformed ranges",
      {
        meta: {
          start: startVal,
          end: endVal,
          url: req.url,
          originalUrl: req.originalUrl,
          query: req.query,
        },
      },
    );
    return res
      .status(400)
      .json({ error: "Datas de início e fim são obrigatórias", slots: [] });
  }

  // 1.2 Format and range limit validation (prevent massive scans)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startStr) || !dateRegex.test(endStr)) {
    return res
      .status(400)
      .json({
        error: "Parâmetros de data inválidos. Utilize o formato AAAA-MM-DD.",
        slots: [],
      });
  }

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res
      .status(400)
      .json({ error: "As datas fornecidas são inválidas.", slots: [] });
  }

  if (startStr > endStr) {
    return res
      .status(400)
      .json({
        error: "A data de início deve ser menor ou igual à data de término.",
        slots: [],
      });
  }

  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays > 180) {
    return res
      .status(400)
      .json({
        error: "O intervalo máximo de consulta é de 180 dias.",
        slots: [],
      });
  }

  try {
    if (!db) {
      throw new Error(
        "Database connection unavailable during occupied-slots request",
      );
    }

    // 1.3 Professional existence check
    const userSnap = await db.collection("users").doc(professionalId).get();
    if (!userSnap.exists) {
      logger.warn("BOOKING", "occupied-slots: professional does not exist", {
        professionalId,
      });
      return res
        .status(404)
        .json({
          error: "Profissional não cadastrado ou não encontrado.",
          slots: [],
        });
    }

    // 2. High-Performance Query with Dynamic Fallback if Composite Index is missing
    let snapshot;
    let locksSnapshot;
    try {
      // Primary Optimized Query: Restricts the retrieval window natively (Requires professionalId + date index)
      snapshot = await db
        .collection("appointments")
        .where("professionalId", "==", professionalId)
        .where("date", ">=", startStr)
        .where("date", "<=", endStr)
        .get();
    } catch (queryErr: any) {
      const isIndexError =
        queryErr.message &&
        (queryErr.message.includes("index") ||
          queryErr.code === "FAILED_PRECONDITION" ||
          queryErr.code === 9);
      if (isIndexError) {
        logger.warn(
          "BOOKING",
          "occupied-slots appointments query failed (missing composite index) - Retrying with resilient single-field query",
          {
            professionalId,
            error: queryErr.message,
          },
        );
        snapshot = await db
          .collection("appointments")
          .where("professionalId", "==", professionalId)
          .get();
      } else {
        throw queryErr;
      }
    }

    try {
      // Fast single-field query for locks (no composite index needed)
      locksSnapshot = await db
        .collection("booking_locks")
        .where("professionalId", "==", professionalId)
        .get();
    } catch (err: any) {
      logger.error(
        "BOOKING",
        "Failed to fetch booking locks in occupied-slots",
        { professionalId, error: err.message },
      );
      locksSnapshot = null;
    }

    const countingStatuses = [
      "pending",
      "pending_confirmation",
      "pending_conflict",
      "confirmed",
      "accepted",
      "completed",
      "concluido",
    ];
    const nowMs = Date.now();

    // Create a dictionary of locks for fast lookup
    const lockDict: Record<string, any> = {};
    if (locksSnapshot) {
      locksSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data && data.date && data.time) {
          const cleanTime = data.time.replace(":", "");
          const lockId = `${professionalId}_${data.date}_${cleanTime}`;
          lockDict[lockId] = data;
        }
      });
    }

    // 3. Resilient Mapping, In-Memory filtering, and Sanitization of Corrupt Data
    const apptSlots = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        if (!data) return null;

        // Ensure string formats and trim whitespace
        const date = typeof data.date === "string" ? data.date.trim() : "";
        const time = typeof data.time === "string" ? data.time.trim() : "";

        // Exact range check guarantees validity even if fallback query was used
        if (!date || date < startStr || date > endStr) return null;
        if (!time) return null;

        // Guard against corrupted or NaN duration values
        const rawDuration = data.duration || data.serviceDuration;
        const durationValue =
          typeof rawDuration === "number"
            ? rawDuration
            : Number(rawDuration) || 60;
        const finalDuration =
          isNaN(durationValue) || durationValue <= 0 ? 60 : durationValue;

        const rawStatus =
          typeof data.status === "string" ? data.status.trim() : "pending";

        // Only include slots that are relevant for active booking/availability tracking
        if (countingStatuses.includes(rawStatus)) {
          // Additional safety check: If it's a pending status, check if an associated lock exists and is expired.
          // If the lock has expired, THIS pending appointment is invalid and should NOT block the slot!
          const isPending =
            rawStatus === "pending" ||
            rawStatus === "pending_confirmation" ||
            rawStatus === "pending_conflict";
          if (isPending) {
            const cleanTime = time.replace(":", "");
            const lockId = `${professionalId}_${date}_${cleanTime}`;
            const lockData = lockDict[lockId];
            if (lockData) {
              let isExpired = false;
              if (lockData.expiresAt) {
                if (typeof lockData.expiresAt.toMillis === "function") {
                  isExpired = lockData.expiresAt.toMillis() <= nowMs;
                } else if (
                  typeof lockData.expiresAt === "string" ||
                  typeof lockData.expiresAt === "number"
                ) {
                  isExpired = new Date(lockData.expiresAt).getTime() <= nowMs;
                } else if (lockData.expiresAt instanceof Date) {
                  isExpired = lockData.expiresAt.getTime() <= nowMs;
                }
              }
              // Only ignore if the lock belongs to this specific appointment
              if (isExpired && lockData.appointmentId === doc.id) {
                return null; // Ignore pending appointment whose lock expired
              }
            }
          }

          return {
            date,
            time,
            duration: finalDuration,
            status: rawStatus,
          };
        }
        return null;
      })
      .filter((s: any) => s && s.date && s.time);

    const lockSlots = locksSnapshot
      ? locksSnapshot.docs
          .map((doc) => {
            const data = doc.data();
            if (!data) return null;

            const date = typeof data.date === "string" ? data.date.trim() : "";
            const time = typeof data.time === "string" ? data.time.trim() : "";

            if (!date || date < startStr || date > endStr) return null;
            if (!time) return null;

            let isExpired = false;
            if (data.expiresAt) {
              if (typeof data.expiresAt.toMillis === "function") {
                isExpired = data.expiresAt.toMillis() <= nowMs;
              } else if (
                typeof data.expiresAt === "string" ||
                typeof data.expiresAt === "number"
              ) {
                isExpired = new Date(data.expiresAt).getTime() <= nowMs;
              } else if (data.expiresAt instanceof Date) {
                isExpired = data.expiresAt.getTime() <= nowMs;
              }
            }

            // Se já expirou, não bloqueia
            if (isExpired) return null;

            // Consider possible active locks mapping to pending
            return {
              date,
              time,
              duration: Number(data.duration) || 60,
              status: "pending", // forces block on frontend
            };
          })
          .filter((s: any) => s && s.date && s.time)
      : [];

    const slots = [...apptSlots, ...lockSlots];

    res.json({ slots });
  } catch (err: any) {
    // 4. Global Catch-All (Prevents 500 crashes and guarantees formatted JSON output)
    logger.error(
      "BOOKING",
      "Failed to fetch occupied slots - CRITICAL FAILSAFE triggered",
      {
        requestId: req.requestId,
        professionalId,
        start: startStr,
        end: endStr,
        error: err.message,
        stack: err.stack,
        code: err.code,
      },
    );

    // Specific informative message for common Firestore configuration errors
    if (
      err.message &&
      (err.message.includes("index") || err.code === "FAILED_PRECONDITION")
    ) {
      return res.status(500).json({
        error:
          "Database configuration requires attention. Please contact Nera support.",
        slots: [],
      });
    }

    res.status(500).json({
      error:
        "Ocorreu um erro interno ao carregar os horários. Tente novamente.",
      message: process.env.NODE_ENV === "production" ? undefined : err.message,
      slots: [],
    });
  }
});

// Tokens públicos de acesso precisam ser criptograficamente seguros. Não usar Math.random.
function generateSecureToken(bytes: number = 16): string {
  return randomBytes(bytes).toString("hex");
}

const generateRandomSuffix = (length: number = 4) => {
  return generateSecureToken(Math.ceil(length / 2))
    .substring(0, length)
    .toUpperCase();
};

const generateReservationCode = (date: string) => {
  const formattedDate = (date || "").replace(/-/g, "");
  return `NR-${formattedDate}-${generateRandomSuffix()}`;
};

const removeEmptyFields = (obj: any): any => {
  const newObj: any = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      newObj[key] = obj[key];
    }
  });
  return newObj;
};

const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const intervalsOverlap = (
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean => {
  return Math.max(startA, startB) < Math.min(endA, endB);
};

function getBookingLockId(appointment: any): string | null {
  const dateAttr =
    appointment.date ||
    appointment.appointmentDate ||
    appointment.selectedDate ||
    appointment.scheduledDate;
  const timeAttr =
    appointment.time ||
    appointment.appointmentTime ||
    appointment.selectedTime ||
    appointment.startTime;
  if (!appointment?.professionalId || !dateAttr || !timeAttr) return null;
  const cleanTime = String(timeAttr).replace(":", "");
  return appointment.professionalId + "_" + dateAttr + "_" + cleanTime;
}

const sanitizeAppointment = (data: any, isUpdate = false): any => {
  const sanitized = { ...data };

  if (!isUpdate || sanitized.clientName !== undefined) {
    sanitized.clientName =
      typeof sanitized.clientName === "string" &&
      sanitized.clientName.trim() !== ""
        ? sanitized.clientName.trim()
        : "Cliente";
  }

  if (!isUpdate || sanitized.price !== undefined) {
    sanitized.price = Number(sanitized.price) || 0;
  }

  if (!isUpdate || sanitized.status !== undefined) {
    const validStatuses = [
      "pending",
      "confirmed",
      "cancelled",
      "completed",
      "cancelled_by_professional",
      "cancelled_by_client",
      "declined",
      "accepted",
      "pending_conflict",
    ];
    if (!validStatuses.includes(sanitized.status)) {
      sanitized.status = "pending";
    }
  }

  if (!isUpdate && !sanitized.professionalId) {
    throw new Error("professionalId é obrigatório");
  }

  if (!isUpdate && !sanitized.createdAt) {
    sanitized.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  Object.keys(sanitized).forEach((key) => {
    if (sanitized[key] === undefined) {
      delete sanitized[key];
    }
  });

  return sanitized;
};

async function updateClientSummaryInternal(
  transaction: admin.firestore.Transaction,
  appointment: any,
  professionalId: string,
  isNew: boolean,
  oldStatus?: string,
  preFetchedSnap?: admin.firestore.DocumentSnapshot,
) {
  const db = getDb();
  const clientKey = getClientKey(
    appointment.clientWhatsapp,
    appointment.clientEmail,
    appointment.clientName,
  );
  const summaryId = `${professionalId}_${clientKey}`;
  const summaryRef = db.collection("client_summaries").doc(summaryId);

  const summarySnap = preFetchedSnap || (await transaction.get(summaryRef));
  let summary = summarySnap.exists
    ? (summarySnap.data() as any)
    : {
        professionalId,
        clientKey,
        clientName: appointment.clientName || "Cliente",
        clientPhone: appointment.clientWhatsapp || "",
        clientEmail: appointment.clientEmail || "",
        totalAppointments: 0,
        confirmedAppointments: 0,
        cancelledAppointments: 0,
        noShowCount: 0,
        totalSpent: 0,
        lastAppointmentDate: appointment.date || "",
        lastServiceName: appointment.serviceName || "",
        firstAppointmentDate: appointment.date || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

  const status = appointment.status;
  const price =
    (Number(appointment.price) || 0) + (Number(appointment.travelFee) || 0);

  if (isNew) {
    summary.totalAppointments += 1;
    if (
      !summary.firstAppointmentDate ||
      new Date(appointment.date) < new Date(summary.firstAppointmentDate)
    ) {
      summary.firstAppointmentDate = appointment.date;
    }
  }

  const wasConfirmed = isRevenueStatus(oldStatus);
  const isNowConfirmed = isRevenueStatus(status);

  if (isNowConfirmed && !wasConfirmed) {
    summary.confirmedAppointments += 1;
    summary.totalSpent += price;
  } else if (!isNowConfirmed && wasConfirmed) {
    summary.confirmedAppointments = Math.max(
      0,
      summary.confirmedAppointments - 1,
    );
    summary.totalSpent = Math.max(0, summary.totalSpent - price);
  }

  if (isCancelledStatus(status)) {
    if (!isCancelledStatus(oldStatus)) {
      summary.cancelledAppointments += 1;
    }
  }

  if (appointment.noShow) {
    summary.noShowCount += 1;
  }

  if (
    !summary.lastAppointmentDate ||
    new Date(appointment.date || "") >= new Date(summary.lastAppointmentDate)
  ) {
    summary.lastAppointmentDate = appointment.date || "";
    summary.lastServiceName = appointment.serviceName || "";
    summary.clientName =
      appointment.clientName || summary.clientName || "Cliente";
    summary.clientPhone =
      appointment.clientWhatsapp || summary.clientPhone || "";
    summary.clientEmail = appointment.clientEmail || summary.clientEmail || "";
  }

  summary.updatedAt = new Date().toISOString();
  transaction.set(summaryRef, summary, { merge: true });
}

// --- SECURE PUBLIC BOOKING ENDPOINT ---
router.get("/public/booking-health", (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    route: "booking",
  });
});

router.post("/public/create-booking", bookingRateLimiter, async (req, res) => {
  const db = getDb();
  const appointmentData = req.body;

  if (
    !appointmentData.professionalId ||
    !appointmentData.date ||
    !appointmentData.time
  ) {
    logger.warn("BOOKING", "Rejected missing fields", {
      meta: { hasName: Boolean(appointmentData?.clientName) },
    });
    return res
      .status(400)
      .json({
        error:
          "Dados de agendamento incompletos (professionalId, date ou time ausentes)",
      });
  }

  try {
    const cleanedData = removeEmptyFields(appointmentData);
    const apptRef = db.collection("appointments").doc();
    const reservationCode = generateReservationCode(appointmentData.date);
    const manageSlug = generateSecureToken(24);

    const finalData: any = {
      ...cleanedData,
      status: "pending",
      token: manageSlug,
      publicToken: manageSlug,
      manageToken: manageSlug,
      reservationCode,
      manageSlug,
      clientWhatsapp:
        appointmentData.clientWhatsapp || appointmentData.clientPhone || "",
      clientPhone:
        appointmentData.clientWhatsapp || appointmentData.clientPhone || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.runTransaction(async (transaction) => {
      // Professional Check
      const proRef = db.collection("users").doc(appointmentData.professionalId);
      const proSnap = await transaction.get(proRef);
      if (!proSnap.exists) {
        logger.error(
          "BOOKING",
          `Professional not found: ${appointmentData.professionalId}`,
        );
        throw new Error(
          `Profissional não encontrado (${appointmentData.professionalId}). Verifique se o perfil existe.`,
        );
      }

      const proData = proSnap.data() as any;

      if (
        proData?.accountStatus === "scheduled_for_deletion" ||
        proData?.accountStatus === "deleted"
      ) {
        logger.warn(
          "BOOKING",
          `Attempt to book with disabled professional: ${appointmentData.professionalId}`,
        );
        const err = new Error(
          "Este profissional não está mais aceitando agendamentos no momento.",
        );
        (err as any).status = 403;
        throw err;
      }

      // Enforce Active Plan Limits Securely Inside Transaction
      const basePlan = proData?.plan || "free";
      const expiresAt = proData?.planExpiresAt;
      const subStatus = proData?.stripeSubscriptionStatus;

      let isExpired = false;
      if (basePlan !== "free") {
        const timeIsExpired = expiresAt
          ? new Date(expiresAt).getTime() < Date.now()
          : false;
        const hasActiveSub = subStatus === "active" || subStatus === "trialing";

        if (expiresAt && timeIsExpired) {
          isExpired = true;
        } else if (!hasActiveSub) {
          if (!expiresAt || timeIsExpired) {
            isExpired = true;
          }
        }
      }

      const activePlan = isExpired ? "free" : basePlan;
      const hasUnlimitedBookings =
        activePlan === "essencial" || activePlan === "pro";

      let quotaLockRef: admin.firestore.DocumentReference | null = null;
      let limitHit = false;

      // Waitlist Entry Verification
      let waitlistSnap = null;
      if (appointmentData.waitlistEntryId) {
        const waitlistRef = db.collection("waitlist").doc(appointmentData.waitlistEntryId);
        waitlistSnap = await transaction.get(waitlistRef);
        if (!waitlistSnap.exists) {
          throw new Error("Convite não encontrado.");
        }
        const waitlistData = waitlistSnap.data();
        if (waitlistData?.status !== "invited") {
          throw new Error("Este convite já foi utilizado, expirado ou cancelado.");
        }
        if (waitlistData?.invitationExpiresAt) {
          const expiresAt = new Date(waitlistData.invitationExpiresAt).getTime();
          if (expiresAt <= Date.now()) {
            throw new Error("Este convite já expirou. A vaga foi repassada para o próximo da lista.");
          }
        }
      }

      if (!hasUnlimitedBookings) {
        const now = new Date();
        const currentYear = now.getUTCFullYear();
        const currentMonth = String(now.getUTCMonth() + 1).padStart(2, "0");
        const startOfMonth = `${currentYear}-${currentMonth}-01`;
        const endOfM = new Date(
          Date.UTC(currentYear, now.getUTCMonth() + 1, 0),
        );
        const endOfMonth = endOfM.toISOString().split("T")[0];

        // Read a deterministic quota lock doc to ensure atomic concurrency tracking for this month
        quotaLockRef = db
          .collection("quota_locks")
          .doc(
            `${appointmentData.professionalId}_${currentYear}_${currentMonth}`,
          );
        await transaction.get(quotaLockRef);

        const snapshot = await transaction.get(
          db
            .collection("appointments")
            .where("professionalId", "==", appointmentData.professionalId)
            .where("date", ">=", startOfMonth)
            .where("date", "<=", endOfMonth),
        );

        const countingStatuses = [
          "pending",
          "pending_confirmation",
          "pending_conflict",
          "confirmed",
          "accepted",
          "completed",
          "concluido",
        ];

        // Prevent high cost by capping iterations if there are somehow thousands of cancelled
        let bookingCountOfMonth = 0;
        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (countingStatuses.includes(data.status) && data.source !== "manual") {
            bookingCountOfMonth++;
          }
        }

        if (bookingCountOfMonth >= 15) {
          logger.warn("BOOKING", `Booking limit reached for free plan`, {
            professionalId: maskUid(appointmentData.professionalId),
            meta: { currentCount: bookingCountOfMonth },
          });
          const err = new Error(
            "A agenda desta profissional já está lotada para este mês ✨ Entre em contato diretamente com ela para verificar possibilidades de encaixe.",
          );
          (err as any).status = 403;
          (err as any).code = "BOOKING_LIMIT_REACHED";
          throw err;
        }
      }

      // Service Check & Official Price
      if (!appointmentData.serviceId) {
        logger.error("BOOKING", `Missing serviceId`);
        throw new Error("ID do serviço não fornecido.");
      }
      const serviceRef = db
        .collection("services")
        .doc(appointmentData.serviceId);
      const serviceSnap = await transaction.get(serviceRef);
      if (!serviceSnap.exists) {
        logger.error(
          "BOOKING",
          `Service not found: ${appointmentData.serviceId}`,
        );
        throw new Error(
          `Serviço não encontrado (${appointmentData.serviceId}). Verifique se o serviço ainda existe.`,
        );
      }
      const service = serviceSnap.data() as any;

      // Ownership check (Critical for data integrity after migration)
      if (
        service.professionalId &&
        normalizeId(service.professionalId) !==
          normalizeId(appointmentData.professionalId)
      ) {
        logger.error(
          "BOOKING",
          `SECURITY MALFORMED PAYLOAD: Service ${appointmentData.serviceId} belongs to ${service.professionalId}, but booking requested for ${appointmentData.professionalId}.`,
        );
        const err = new Error("Serviço inválido para este profissional.");
        (err as any).status = 400;
        (err as any).code = "SERVICE_OWNER_MISMATCH";
        throw err;
      }

      // Force official price and duration from service
      let baseOriginalPrice = Number(service.price) || 0;
      let durationCalc = Number(service.duration) || 60;

      const verifiedAdditionalServices = [];
      if (Array.isArray(appointmentData.additionalServices)) {
        for (const addSvc of appointmentData.additionalServices) {
          if (!addSvc.id) continue;
          const addSvcRef = db.collection("services").doc(addSvc.id);
          const addSvcSnap = await transaction.get(addSvcRef);
          if (addSvcSnap.exists) {
            const addSvcData = addSvcSnap.data() as any;
            if (
              addSvcData.professionalId &&
              normalizeId(addSvcData.professionalId) ===
                normalizeId(appointmentData.professionalId)
            ) {
              verifiedAdditionalServices.push({
                id: addSvcSnap.id,
                name: addSvcData.name,
                price: Number(addSvcData.price) || 0,
                duration: Number(addSvcData.duration) || 0,
              });
              baseOriginalPrice += Number(addSvcData.price) || 0;
              durationCalc += Number(addSvcData.duration) || 0;
            }
          }
        }
      }

      finalData.additionalServices = verifiedAdditionalServices;
      finalData.price = baseOriginalPrice;
      finalData.duration = durationCalc;
      finalData.serviceName = service.name;
      finalData.professionalId = service.professionalId; // Force owner from service

      // --- VALIDATION: Working Days & Hours & Blocked Schedules ---
      const apptDateStr = finalData.date;
      const apptDayOfWeek = new Date(apptDateStr + "T12:00:00").getDay();
      const apptStartMin = timeToMinutes(finalData.time);
      const apptEndMin = apptStartMin + finalData.duration;

      if (proData && proData.workingHours) {
        if (
          Array.isArray(proData.workingHours.workingDays) &&
          proData.workingHours.workingDays.length > 0
        ) {
          if (!proData.workingHours.workingDays.includes(apptDayOfWeek)) {
            const err = new Error(
              "Horário indisponível. Escolha outro horário.",
            );
            (err as any).status = 400;
            throw err;
          }
        }

        if (proData.workingHours.startTime && proData.workingHours.endTime) {
          const whStart = timeToMinutes(proData.workingHours.startTime);
          const whEnd = timeToMinutes(proData.workingHours.endTime);
          if (apptStartMin < whStart || apptEndMin > whEnd) {
            const err = new Error(
              "Horário indisponível. Escolha outro horário.",
            );
            (err as any).status = 400;
            throw err;
          }
        }
      }

      const blockedQ = db
        .collection("blocked_schedules")
        .where("professionalId", "==", finalData.professionalId);
      const blockedSnap = await transaction.get(blockedQ);

      for (const bDoc of blockedSnap.docs) {
        const b = bDoc.data();
        const isFixed = b.date === apptDateStr;
        const isRecurring =
          b.isRecurring &&
          Array.isArray(b.recurringDays) &&
          b.recurringDays.includes(apptDayOfWeek);

        if (isFixed || isRecurring) {
          if (b.type === "full_day" || b.allDay) {
            const err = new Error(
              "Horário indisponível. Escolha outro horário.",
            );
            (err as any).status = 400;
            throw err;
          }
          if (b.startTime && b.endTime) {
            const bStart = timeToMinutes(b.startTime);
            const bEnd = timeToMinutes(b.endTime);
            if (intervalsOverlap(apptStartMin, apptEndMin, bStart, bEnd)) {
              const err = new Error(
                "Horário indisponível. Escolha outro horário.",
              );
              (err as any).status = 400;
              throw err;
            }
          }
        }
      }
      // --- END OF VALIDATION ---

      // Coupon (if any)
      let couponSnap = null;
      let couponRef = null;
      if (appointmentData.couponId) {
        couponRef = db.collection("coupons").doc(appointmentData.couponId);
        couponSnap = await transaction.get(couponRef);
      }

      // Check Booking Lock (Must be before writes)
      const lockId = getBookingLockId(finalData);
      let lockRef: admin.firestore.DocumentReference | null = null;
      let lockSnap: admin.firestore.DocumentSnapshot | null = null;
      if (lockId) {
        lockRef = db.collection("booking_locks").doc(lockId);
        lockSnap = await transaction.get(lockRef);
        if (lockSnap.exists) {
          const lockData = lockSnap.data();
          const isPending =
            lockData?.status === "pending" ||
            lockData?.status === "pending_confirmation" ||
            lockData?.status === "pending_conflict";
          const isWaitlistLock = lockData?.status === "waitlist_lock";

          let isExpired = false;
          if ((isPending || isWaitlistLock) && lockData?.expiresAt) {
            if (typeof lockData.expiresAt.toMillis === "function") {
              isExpired = lockData.expiresAt.toMillis() <= Date.now();
            } else if (
              typeof lockData.expiresAt === "string" ||
              typeof lockData.expiresAt === "number"
            ) {
              isExpired = new Date(lockData.expiresAt).getTime() <= Date.now();
            } else if (lockData.expiresAt instanceof Date) {
              isExpired = lockData.expiresAt.getTime() <= Date.now();
            }
          }
          if (isPending && !isExpired) {
            throw new Error(
              "SLOT_LOCKED:Este horário acabou de ser reservado. Escolha outro horário.",
            );
          }
          if (isWaitlistLock && !isExpired) {
            if (!appointmentData.waitlistEntryId || appointmentData.waitlistEntryId !== lockData.waitlistEntryId) {
              throw new Error(
                "SLOT_WAITLIST:Este horário está temporariamente reservado para uma cliente da lista de espera.",
              );
            }
          }
        }
      }

      // Check for duration overlap with other appointments
      const existingApptsSnap = await transaction.get(
        db
          .collection("appointments")
          .where("professionalId", "==", finalData.professionalId)
          .where("date", "==", finalData.date),
      );

      const overlapBlockingStatuses = [
        "pending",
        "pending_confirmation",
        "pending_conflict",
        "confirmed",
        "accepted",
        "completed",
        "concluido",
      ];
      const newStart = timeToMinutes(finalData.time);
      const newEnd = newStart + finalData.duration;

      for (const doc of existingApptsSnap.docs) {
        const existing = doc.data();
        if (overlapBlockingStatuses.includes(existing.status)) {
          const isPending =
            existing.status === "pending" ||
            existing.status === "pending_confirmation" ||
            existing.status === "pending_conflict";
          if (isPending) {
            const existingLockId = getBookingLockId(existing);
            if (existingLockId) {
              const existingLockSnap =
                existingLockId === lockId && lockSnap
                  ? lockSnap
                  : await transaction.get(
                      db.collection("booking_locks").doc(existingLockId),
                    );
              if (existingLockSnap.exists) {
                const existingLockData = existingLockSnap.data();
                let isExpired = false;
                if (existingLockData && existingLockData.expiresAt) {
                  if (
                    typeof existingLockData.expiresAt.toMillis === "function"
                  ) {
                    isExpired =
                      existingLockData.expiresAt.toMillis() <= Date.now();
                  } else if (
                    typeof existingLockData.expiresAt === "string" ||
                    typeof existingLockData.expiresAt === "number"
                  ) {
                    isExpired =
                      new Date(existingLockData.expiresAt).getTime() <=
                      Date.now();
                  } else if (existingLockData.expiresAt instanceof Date) {
                    isExpired =
                      existingLockData.expiresAt.getTime() <= Date.now();
                  }
                }
                if (isExpired) {
                  continue; // Ignorar o appointment pending cujo lock expirou
                }
              } else {
                continue; // Se não tem lock, não deveria estar bloqueando
              }
            }
          }

          const existingStart = timeToMinutes(existing.time);
          const existingDuration = Number(
            existing.duration || existing.serviceDuration || 60,
          );
          const existingEnd = existingStart + existingDuration;

          if (intervalsOverlap(newStart, newEnd, existingStart, existingEnd)) {
            logger.warn(
              "BOOKING",
              "Durational overlap detected in create-booking",
              {
                professionalId: maskUid(finalData.professionalId),
                meta: {
                  date: finalData.date,
                  time: finalData.time,
                  newDuration: finalData.duration,
                  existingTime: existing.time,
                  existingDuration,
                },
              },
            );
            throw new Error(
              "SLOT_LOCKED:Este horário acabou de ficar indisponível. Escolha outro horário.",
            );
          }
        }
      }

      // Read Client Summary
      const clientKey = getClientKey(
        appointmentData.clientWhatsapp,
        appointmentData.clientEmail,
        appointmentData.clientName,
      );
      const summaryId = `${appointmentData.professionalId}_${clientKey}`;
      const summaryRef = db.collection("client_summaries").doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);

      // --- ADDED COUPON & TRAVEL FEE CALCULATION ---
      let originalPrice = finalData.price || 0; // use pre-calculated baseOriginalPrice (includes additional Services)
      let travelFee = 0;

      // Calculate Official Travel Fee
      if (finalData.locationType === "home" && proData) {
        if (proData.travelFeeMode === "fixed") {
          travelFee = Number(proData.fixedTravelFee) || 0;
        } else if (
          proData.serviceAreas &&
          Array.isArray(proData.serviceAreas) &&
          finalData.neighborhood
        ) {
          const matchedArea = proData.serviceAreas.find(
            (a: any) =>
              (a.name || "").toLowerCase().trim() ===
              (finalData.neighborhood || "").toLowerCase().trim(),
          );
          if (matchedArea) {
            travelFee = Number(matchedArea.fee) || 0;
          }
        }
      }

      let subtotalBeforeDiscount = originalPrice + travelFee;
      let discountAmount = 0;

      // 2. LOGIC & WRITES
      if (couponSnap && couponSnap.exists) {
        const coupon = couponSnap.data() as any;

        // P0: Tenant Isolation
        if (coupon.professionalId !== finalData.professionalId) {
          throw new Error("Cupom inválido para este profissional.");
        }

        // P0: Active Validation
        if (coupon.active !== true) {
          throw new Error("Este cupom não está mais ativo.");
        }

        // P0: Expiration Validation
        if (coupon.expiresAt) {
          let isExpired = false;
          if (typeof coupon.expiresAt.toMillis === "function") {
            isExpired = coupon.expiresAt.toMillis() <= Date.now();
          } else if (
            typeof coupon.expiresAt === "string" ||
            typeof coupon.expiresAt === "number"
          ) {
            isExpired = new Date(coupon.expiresAt).getTime() <= Date.now();
          } else if (coupon.expiresAt instanceof Date) {
            isExpired = coupon.expiresAt.getTime() <= Date.now();
          }
          if (isExpired) {
            throw new Error("Este cupom já expirou.");
          }
        }

        // P0: Service Applicability Validation
        if (
          coupon.applicableServiceIds &&
          Array.isArray(coupon.applicableServiceIds) &&
          coupon.applicableServiceIds.length > 0
        ) {
          if (!coupon.applicableServiceIds.includes(finalData.serviceId)) {
            throw new Error(
              "Este cupom não é válido para o serviço selecionado.",
            );
          }
        }

        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
          throw new Error("Este cupom atingiu o limite de usos.");
        }

        // Check perClientLimit
        if (coupon.perClientLimit === 1) {
          const cleanPhone = (
            appointmentData.clientWhatsapp ||
            appointmentData.clientPhone ||
            ""
          ).replace(/\D/g, "");
          const cleanEmail = (appointmentData.clientEmail || "")
            .trim()
            .toLowerCase();

          if (!cleanPhone && !cleanEmail) {
            throw new Error(
              "Preencha seu nome, WhatsApp ou e-mail antes de aplicar o cupom.",
            );
          }

          let usedCountByClient = 0;

          if (cleanPhone) {
            const phoneSnap = await transaction.get(
              db
                .collection("appointments")
                .where("professionalId", "==", finalData.professionalId)
                .where("clientWhatsapp", "==", cleanPhone)
                .limit(50),
            );
            for (const doc of phoneSnap.docs) {
              const d = doc.data();
              if (
                (d.couponCode === coupon.code ||
                  d.appliedCouponCode === coupon.code) &&
                ["pending", "confirmed", "completed"].includes(d.status)
              ) {
                usedCountByClient++;
                break;
              }
            }
          }

          if (usedCountByClient === 0 && cleanEmail) {
            const emailSnap = await transaction.get(
              db
                .collection("appointments")
                .where("professionalId", "==", finalData.professionalId)
                .where("clientEmail", "==", cleanEmail)
                .limit(50),
            );
            for (const doc of emailSnap.docs) {
              const d = doc.data();
              if (
                (d.couponCode === coupon.code ||
                  d.appliedCouponCode === coupon.code) &&
                ["pending", "confirmed", "completed"].includes(d.status)
              ) {
                usedCountByClient++;
                break;
              }
            }
          }

          if (usedCountByClient > 0) {
            throw new Error(
              "Você já utilizou este cupom em outro agendamento.",
            );
          }
        }

        // P1: Travel Fee Isolation
        if (coupon.type === "percentage") {
          discountAmount = (originalPrice * (Number(coupon.value) || 0)) / 100;
        } else if (coupon.type === "fixed") {
          discountAmount = Math.min(Number(coupon.value) || 0, originalPrice);
        }

        finalData.couponCode = coupon.code || "";
        finalData.appliedCouponCode = coupon.code || ""; // Fallback for legacy frontend queries
        finalData.couponType = coupon.type || "";
        finalData.couponValue = coupon.value || "";

        transaction.update(couponRef!, {
          usedCount: admin.firestore.FieldValue.increment(1),
        });
      } else {
        // Clear any spoofed coupon data from the frontend if the coupon wasn't officially validated
        delete finalData.couponCode;
        delete finalData.appliedCouponCode;
        delete finalData.couponType;
        delete finalData.couponValue;
      }

      const calculatedFinalPrice = Math.max(
        0,
        subtotalBeforeDiscount - discountAmount,
      );

      // Safely persist everything on the backend
      finalData.originalPrice = originalPrice;
      finalData.travelFee = travelFee;
      finalData.subtotalBeforeDiscount = subtotalBeforeDiscount;
      finalData.discountAmount = discountAmount; // Used reliably going forward
      delete finalData.discount; // Destroy any spoofed "discount" payload from the frontend
      finalData.finalPrice = calculatedFinalPrice;
      finalData.totalPrice = calculatedFinalPrice;

      // Temporarily override price for compatibility, but it will be the discounted value
      finalData.price = calculatedFinalPrice;
      // --- END CALCULATION ---

      // Create Booking Lock
      if (lockRef) {
        transaction.set(lockRef, {
          professionalId: finalData.professionalId,
          date: finalData.date,
          time: finalData.time,
          appointmentId: apptRef.id,
          serviceId: finalData.serviceId || "unknown",
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // If quota was checked, write to the lock doc to ensure Firestore transaction validation (race condition prevention)
      if (quotaLockRef) {
        transaction.set(
          quotaLockRef,
          {
            lastBookingAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      // Sanitize before inserting to enforce schemas
      const safeData = sanitizeAppointment(finalData, false);

      // Create Appointment
      transaction.set(apptRef, safeData);

      // Create reservation_links
      const linkRef = db.collection("reservation_links").doc(manageSlug);
      transaction.set(linkRef, {
        appointmentId: apptRef.id,
        manageSlug,
        reservationCode,
        professionalId: appointmentData.professionalId,
        clientEmail: appointmentData.clientEmail,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update Waitlist Entry if booked from waitlist
      if (appointmentData.waitlistEntryId) {
        const waitlistRef = db.collection("waitlist").doc(appointmentData.waitlistEntryId);
        transaction.update(waitlistRef, {
          status: "booked",
          bookedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Update Client Summary
      await updateClientSummaryInternal(
        transaction,
        safeData,
        appointmentData.professionalId,
        true,
        undefined,
        summarySnap,
      );
    });

    logger.info("BOOKING", `SUCCESS: Committed Appt ${apptRef.id}`);

    const baseUrl = PUBLIC_APP_URL;

    // Send notifications safely without failing the booking
    // Using Promise.allSettled avoids freezing in serverless environments (Cloud Run/Firebase Functions) 
    // before the async task finishes, while also executing them in parallel.
    await Promise.allSettled([
      (async () => {
        try {
          const proDoc = await db
            .collection("users")
            .doc(appointmentData.professionalId)
            .get();
          const proData = proDoc.exists ? proDoc.data() : null;

          let paymentMethodsArr: string[] = Array.isArray(
            appointmentData.paymentMethods,
          )
            ? appointmentData.paymentMethods
            : appointmentData.paymentMethods
              ? [String(appointmentData.paymentMethods)]
              : [];

          const isHomeService =
            finalData.locationType === "home" ||
            finalData.locationType === "domicilio";
          let locationDetail = "No Estúdio";
          if (isHomeService) {
            locationDetail = `${finalData.neighborhood || "Bairro omitido"}, ${proData?.city || "Cidade omitida"}`;
          }

          const displayServiceName =
            finalData.additionalServices?.length > 0
              ? [
                  finalData.serviceName,
                  ...finalData.additionalServices.map((s: any) => s.name),
                ].join(", ")
              : finalData.serviceName;

          // Executa os envios em paralelo para não atrasar a resposta
          await Promise.allSettled([
            sendBookingPendingClientNotification(
              {
                clientEmail: appointmentData.clientEmail,
                clientName: appointmentData.clientName,
                professionalName: proData?.name || "Profissional",
                professionalWhatsapp: proData?.whatsapp || "",
                serviceName: displayServiceName,
                date: finalData.date,
                time: finalData.time,
                price: `R$ ${(finalData.price || 0).toFixed(2).replace(".", ",")}`,
                travelFee: finalData.travelFee,
                totalPrice: finalData.finalPrice,
                reservationCode,
                manageUrl: `${baseUrl}/r/${manageSlug}`,
                appointmentId: apptRef.id,
                paymentMethods: paymentMethodsArr,
              },
              baseUrl,
            ),
            sendNewBookingRequestNotification(
              {
                professionalId: appointmentData.professionalId,
                clientName: appointmentData.clientName,
                serviceName: displayServiceName,
                date: finalData.date,
                time: finalData.time,
                totalPrice: finalData.finalPrice,
                travelFee: finalData.travelFee,
                price: finalData.price,
                appointmentId: apptRef.id,
                token: manageSlug,
                paymentMethods: paymentMethodsArr,
                locationDetail: locationDetail,
                clientWhatsapp:
                  appointmentData.clientWhatsapp ||
                  appointmentData.clientPhone ||
                  "",
                clientEmail: appointmentData.clientEmail,
              },
              baseUrl,
            )
          ]);
        } catch (err: any) {
          logger.error(
            "NOTIFICATION",
            "Failed to send post-booking notifications",
            {
              appointmentId: apptRef.id,
              error: err.message,
            },
          );
        }
      })()
    ]);

    res.json({
      success: true,
      bookingId: apptRef.id,
      token: manageSlug,
      reservationCode,
    });
  } catch (err: any) {
    if (err.message && err.message.includes("SLOT_LOCKED:")) {
      return res
        .status(409)
        .json({ error: err.message.replace("SLOT_LOCKED:", "") });
    }
    logger.error("BOOKING", "BOOKING ERROR", {
      requestId: req.requestId,
      error: err,
    });
    const status = err.status || 500;
    res.status(status).json({
      error: err.message,
      code: err.code || null,
    });
  }
});

// --- NEW: PUBLIC ENDPOINT TO FETCH REVIEW REQUEST ---
router.get("/public/reviews/:token", reviewSubmitLimiter, async (req, res) => {
  const db = getDb();
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ error: "Token é obrigatório." });
  }

  try {
    const q = db
      .collection("review_requests")
      .where("token", "==", token)
      .limit(1);
    const requestSnaps = await q.get();

    if (requestSnaps.empty) {
      return res
        .status(404)
        .json({
          error: "Solicitação de avaliação não encontrada ou inválida.",
        });
    }

    const requestData = requestSnaps.docs[0].data();

    if (requestData.status === "submitted") {
      return res.status(400).json({ error: "Esta avaliação já foi enviada." });
    }
    if (requestData.status === "expired") {
      return res.status(400).json({ error: "Este link de avaliação expirou." });
    }

    const professionalId = requestData.professionalId;
    const bookingId = requestData.bookingId;

    let professionalName = "";
    let professionalPhoto = "";
    let serviceName = "";
    let appointmentDate = "";

    if (professionalId) {
      const profSnap = await db.collection("users").doc(professionalId).get();
      if (profSnap.exists) {
        const profData = profSnap.data()!;
        if (
          profData.accountStatus === "scheduled_for_deletion" ||
          profData.accountStatus === "deleted"
        ) {
          return res
            .status(404)
            .json({ error: "Este link de avaliação não é mais válido." });
        }
        professionalName = profData.displayName || profData.name || "";
        professionalPhoto =
          profData.avatar || profData.photoUrl || profData.photoURL || "";
      }
    }

    if (bookingId) {
      const apptSnap = await db.collection("appointments").doc(bookingId).get();
      if (apptSnap.exists) {
        const apptData = apptSnap.data()!;
        serviceName = apptData.serviceName || "";
        appointmentDate = apptData.date || "";
      }
    }

    return res.json({
      success: true,
      professionalName,
      professionalPhoto,
      serviceName,
      appointmentDate,
      clientDisplayName: requestData.clientDisplayName || "",
      clientNeighborhood: requestData.clientNeighborhood || "",
      canReview: true,
    });
  } catch (err: any) {
    logger.error("REVIEW", "Fetch review error", { error: err });
    res
      .status(500)
      .json({ error: "Erro interno ao buscar dados da avaliação." });
  }
});

// --- NEW: PUBLIC ENDPOINT TO SUBMIT REVIEW ---
router.post(
  "/public/reviews/:token/submit",
  reviewSubmitLimiter,
  async (req, res) => {
    const db = getDb();
    const { token } = req.params;
    const {
      rating,
      tags,
      comment,
      publicDisplayMode,
      firstName,
      neighborhood,
      serviceId,
      serviceName,
    } = req.body;

    if (!token || !rating) {
      return res
        .status(400)
        .json({ error: "Token e rating são obrigatórios." });
    }

    try {
      const result = await db.runTransaction(async (transaction) => {
        // 1. Find review request
        const q = db
          .collection("review_requests")
          .where("token", "==", token)
          .limit(1);
        const requestSnaps = await transaction.get(q);

        if (requestSnaps.empty) {
          throw new Error(
            "Solicitação de avaliação não encontrada ou inválida.",
          );
        }

        const requestDoc = requestSnaps.docs[0];
        const requestData = requestDoc.data();

        if (requestData.status === "submitted") {
          throw new Error("Esta avaliação já foi enviada.");
        }
        if (requestData.status === "expired") {
          throw new Error("Este link de avaliação expirou.");
        }

        const professionalId = requestData.professionalId;
        const reviewRef = db.collection("reviews").doc();
        const statsRef = db.collection("review_stats").doc(professionalId);

        // READS MUST BE BEFORE WRITES
        const statsDoc = await transaction.get(statsRef);
        const apptRef = db
          .collection("appointments")
          .doc(requestData.bookingId);
        const apptDoc = await transaction.get(apptRef);
        const profRef = db.collection("users").doc(professionalId);
        const profDoc = await transaction.get(profRef);

        let locationLabel = "";
        let safeServiceId = serviceId || "";
        let safeServiceName = serviceName || "";

        if (profDoc.exists && apptDoc.exists) {
          const prof = profDoc.data()!;
          const appt = apptDoc.data()!;

          // Harden service parameters from actual appointment
          safeServiceId = appt.serviceId || safeServiceId;
          safeServiceName = appt.serviceName || safeServiceName;

          const locType = appt.locationType;
          if (locType === "home" || locType === "domicilio") {
            const apptNeigh = appt.neighborhood || neighborhood || "";
            const city = prof.city || "";
            if (apptNeigh && city) locationLabel = `${apptNeigh}, ${city}`;
            else if (city) locationLabel = city;
          } else {
            // studio
            const profNeigh = prof.neighborhood || "";
            const city = prof.city || "";
            if (profNeigh && city) locationLabel = `${profNeigh}, ${city}`;
            else if (city) locationLabel = city;
          }
        }

        // Safe comment
        const safeComment = comment ? String(comment).trim().slice(0, 500) : "";

        // Normalize display mode (fallback to 'anonymous' for safety)
        let finalDisplayMode = "anonymous";
        if (publicDisplayMode === "named" || publicDisplayMode === "private") {
          finalDisplayMode = publicDisplayMode;
        }

        const isAnonymous = finalDisplayMode === "anonymous";
        const finalFirstName = isAnonymous
          ? "Cliente Anônima"
          : firstName || "Cliente";
        const finalNeighborhood = isAnonymous ? "" : neighborhood || "";
        if (isAnonymous) locationLabel = "";

        const KNOWN_TAGS = [
          "Pontualidade",
          "Delicadeza",
          "Atendimento profissional",
          "Resultado natural",
          "Organização",
          "Praticidade",
          "Boa comunicação",
          "Voltaria a agendar",
        ];
        const sanitizedTags = Array.isArray(tags)
          ? tags.filter((t) => KNOWN_TAGS.includes(t))
          : [];

        // 2. Create the review
        transaction.set(reviewRef, {
          bookingId: requestData.bookingId,
          professionalId: professionalId,
          serviceId: safeServiceId,
          serviceName: safeServiceName,
          rating: Number(rating),
          tags: sanitizedTags,
          comment: safeComment,
          publicDisplayMode: finalDisplayMode,
          publicApproved: false,
          moderationStatus: "pending",
          firstName: finalFirstName,
          neighborhood: finalNeighborhood,
          locationLabel: locationLabel,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 3. Complete the request
        transaction.update(requestDoc.ref, {
          status: "submitted",
          submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 4. Update appointment timeline
        if (apptDoc.exists && apptRef) {
          transaction.update(apptRef, {
            timeline: admin.firestore.FieldValue.arrayUnion({
              type: "review_submitted",
              createdAt: new Date().toISOString(),
              actor: "client",
              label: "Cliente enviou uma avaliação",
            }),
          });
        }

        return {
          success: true,
          professionalId,
          firstName: firstName || "Cliente",
          rating: Number(rating),
          comment: comment ? String(comment).trim() : "",
        };
      });

      logger.info("REVIEW", "Review submitted successfully", {
        meta: { reviewToken: maskToken(token) },
      });

      // Async push notification
      if (result.professionalId) {
        db.collection("users")
          .doc(result.professionalId)
          .get()
          .then((proDoc) => {
            if (proDoc.exists && proDoc.data()?.email) {
              const proData = proDoc.data();
              import("../emails/sendEmail.js")
                .then(({ sendReviewReceivedEmail }) => {
                  sendReviewReceivedEmail({
                    professionalEmail: proData!.email,
                    professionalName: proData!.name || "Profissional",
                    clientName: result.firstName,
                    rating: result.rating,
                    comment: result.comment,
                  });
                })
                .catch((e) =>
                  logger.error("REVIEW", "Error importing email sender", {
                    error: e,
                  }),
                );
            }
          });
      }

      res.json({ success: true });
    } catch (err: any) {
      logger.error("REVIEW", "Submit review error", {
        error: err,
        meta: { reviewToken: maskToken(token) },
      });
      res
        .status(400)
        .json({
          error:
            err.message || "Não foi possível enviar agora. Tente novamente.",
        });
    }
  },
);

// --- DIAGNOSTIC ENDPOINT FOR EMAILS ---
router.get("/debug-booking-email", (req, res) => {
  return res.status(404).send("Not Found");
});

// --- NEW: DIAGNOSTIC ENDPOINT FOR CONFIRMATION FLOW ---
router.get("/debug-confirmation-email", debugOnly, async (req, res) => {
  try {
    const db = getDb();
    const { appointmentId } = req.query;
    if (!appointmentId)
      return res.status(400).json({ error: "Missing appointmentId" });

    process.stdout.write(
      `[FIRESTORE READ] Attempting to read appointments/${appointmentId}... `,
    );
    const apptDoc = await db
      .collection("appointments")
      .doc(appointmentId as string)
      .get();

    if (!apptDoc.exists) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const data = apptDoc.data();
    const result: any = {
      appointmentId,
      currentStatus: data?.status,
      clientEmail: data?.clientEmail,
      professionalId: data?.professionalId,
      token: data?.token,
      hasToken: !!data?.token,
      clientName: data?.clientName,
      shouldSendConfirmationEmail:
        (data?.status === "confirmed" || data?.status === "accepted") &&
        !!data?.clientEmail,
      reason: "",
    };

    if (data?.status !== "confirmed" && data?.status !== "accepted")
      result.reason = `Status is '${data?.status}', not 'confirmed'. `;
    if (!data?.clientEmail) result.reason += "Missing clientEmail. ";
    if (!data?.token) result.reason += "Missing token. ";

    if (data?.professionalId) {
      process.stdout.write(
        `[FIRESTORE READ] Attempting to read users/${data.professionalId}... `,
      );
      const proDoc = await db
        .collection("users")
        .doc(data.professionalId)
        .get();
      if (proDoc.exists) {
        result.professionalEmail = proDoc.data()?.email;
      } else {
      }
    }

    res.json(result);
  } catch (err: any) {
    logger.error("FIRESTORE", "Query error", { error: err });
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// --- NEW: EXECUTION ENDPOINT FOR CONFIRMATION EMAIL ---
router.get("/run-confirmation-email", debugOnly, async (req, res) => {
  const db = getDb();
  const { appointmentId, token: queryToken } = req.query;
  const response: any = {
    receivedAppointmentId: appointmentId || null,
    receivedToken: queryToken || null,
    firestoreDocFound: false,
    realDocumentId: null,
    validationPassed: false,
    sendAttempted: false,
    resendSuccess: false,
    payloadUsed: null,
    token: null,
    bookingId: null,
    publicId: null,
  };

  try {
    if (!appointmentId && !queryToken)
      throw new Error("Missing appointmentId or token");

    let apptDoc: any = null;
    let apptRef: any = null;

    if (appointmentId) {
      apptRef = db.collection("appointments").doc(appointmentId as string);
      const apptSnap = await apptRef.get();
      if (apptSnap.exists) {
        apptDoc = apptSnap.data();
        response.firestoreDocFound = true;
        response.realDocumentId = apptSnap.id;
      }
    }

    // Fallback: Search by token if not found by ID or if ID looks like a token
    if (!apptDoc && (queryToken || appointmentId)) {
      const tokenToSearch = queryToken || appointmentId;
      const qToken = await db
        .collection("appointments")
        .where("token", "==", tokenToSearch)
        .limit(1)
        .get();
      if (!qToken.empty) {
        apptRef = qToken.docs[0].ref;
        apptDoc = qToken.docs[0].data();
        response.firestoreDocFound = true;
        response.realDocumentId = qToken.docs[0].id;
        process.stdout.write(
          `[DEBUG RUN] Found appointment by token: ${qToken.docs[0].id}\n`,
        );
      }
    }

    if (!apptDoc) {
      response.reason = "Appointment not found by ID or Token";
      return res.status(404).json(response);
    }

    response.token = apptDoc.token || "MISSING";
    response.bookingId = response.realDocumentId;
    response.clientEmail = apptDoc.clientEmail || "MISSING";
    response.createdAt = apptDoc.createdAt
      ? apptDoc.createdAt.toDate
        ? apptDoc.createdAt.toDate().toISOString()
        : apptDoc.createdAt
      : "MISSING";
    response.publicId = apptDoc.token
      ? `token_${apptDoc.token.substring(0, 5)}`
      : "N/A";

    const data = apptDoc;
    const proId = data?.professionalId;
    if (!proId) throw new Error("Missing professionalId in appointment");

    const proSnap = await db.collection("users").doc(proId).get();
    const pro = proSnap.exists ? proSnap.data() : null;

    const waPhone = pro?.whatsapp ? pro.whatsapp.replace(/\D/g, "") : "";
    const whatsappUrl = waPhone ? `https://wa.me/${waPhone}` : undefined;

    const payload = {
      clientName: data?.clientName,
      serviceName: data?.serviceName,
      date: data?.date,
      time: data?.time,
      location:
        data?.locationType === "home"
          ? `Domicílio (${data?.neighborhood})`
          : "Estúdio / Local Fixo",
      clientEmail: data?.clientEmail,
      professionalName: pro?.name || "Sua Profissional",
      professionalEmail: pro?.email || "",
      bookingId: response.realDocumentId,
      token: data?.token,
      prepInstructions: data?.prepInstructions,
      whatsappUrl,
    };
    response.payloadUsed = payload;

    // Validation
    if (!payload.clientEmail)
      throw new Error("Validation Failed: Missing clientEmail");
    if (!payload.token) throw new Error("Validation Failed: Missing token");

    const statusOk =
      data?.status === "confirmed" || data?.status === "accepted";
    if (!statusOk) {
      process.stdout.write(`[DEBUG RUN] Warning: Status is ${data?.status}\n`);
      response.statusWarning = `Status is ${data?.status}, expected confirmed/accepted`;
    }
    response.validationPassed = true;

    // Send
    response.sendAttempted = true;
    const result = await sendBookingConfirmedEmail(payload);

    if (result.success) {
      response.resendSuccess = true;
      response.resendId = result.id;
      return res.json(response);
    } else {
      throw new Error(result.error || "Unknown Resend error");
    }
  } catch (err: any) {
    logger.error("DEBUG", "Debug run failed", { error: err });
    response.error = err.message;
    return res.status(400).json(response);
  }
});

// --- NEW: FULL AUDIT ENDPOINT ---
router.get("/debug-confirmation-email-full", debugOnly, async (req, res) => {
  const db = getDb();
  const { appointmentId } = req.query;
  const audit: any = {
    routeHit: true,
    dataLoaded: false,
    validationPassed: false,
    shouldSendConfirmationEmail: false,
    sendFunctionCalled: false,
    resendAttempted: false,
    resendSuccess: false,
    exactFailureStep: "init",
  };

  try {
    if (!appointmentId) {
      audit.exactFailureStep = "missing_id";
      return res.status(400).json(audit);
    }

    audit.exactFailureStep = "loading_data";
    const apptSnap = await db
      .collection("appointments")
      .doc(appointmentId as string)
      .get();
    if (!apptSnap.exists) {
      audit.exactFailureStep = "appointment_not_found";
      return res.status(404).json(audit);
    }
    audit.dataLoaded = true;

    const data = apptSnap.data();
    const proSnap = await db
      .collection("users")
      .doc(data?.professionalId)
      .get();
    const pro = proSnap.exists ? proSnap.data() : null;

    audit.exactFailureStep = "validating";
    const hasEmail = !!data?.clientEmail;
    const hasToken = !!data?.token;
    const isConfirmed =
      data?.status === "confirmed" || data?.status === "accepted";

    audit.validationPassed = hasEmail && hasToken;
    audit.shouldSendConfirmationEmail = audit.validationPassed && isConfirmed;

    if (!audit.validationPassed) {
      audit.exactFailureStep = !hasEmail
        ? "missing_client_email"
        : "missing_token";
      return res.status(200).json(audit);
    }

    audit.exactFailureStep = "calling_function";
    audit.sendFunctionCalled = true;
    audit.resendAttempted = true;

    const waPhone = pro?.whatsapp ? pro.whatsapp.replace(/\D/g, "") : "";
    const whatsappUrl = waPhone ? `https://wa.me/${waPhone}` : undefined;

    const result = await sendBookingConfirmedEmail({
      clientName: data?.clientName,
      serviceName: data?.serviceName,
      date: data?.date,
      time: data?.time,
      location:
        data?.locationType === "home"
          ? `Domicílio (${data?.neighborhood})`
          : "Estúdio / Local Fixo",
      clientEmail: data?.clientEmail,
      professionalName: pro?.name || "Sua Profissional",
      professionalEmail: pro?.email || "",
      bookingId: appointmentId as string,
      token: data?.token,
      prepInstructions: data?.prepInstructions,
      whatsappUrl,
    });

    audit.resendSuccess = result.success;
    audit.resendId = result.id;
    audit.exactFailureStep = "completed";
    res.json(audit);
  } catch (err: any) {
    audit.resendError = err.message;
    res.status(500).json(audit);
  }
});

router.get("/fix-duplicate-slots", debugOnly, async (req, res) => {
  try {
    const db = getDb();
    const { professionalId } = req.query;
    if (!professionalId)
      return res.status(400).json({ error: "Missing professionalId" });

    const apptsSnap = await db
      .collection("appointments")
      .where("professionalId", "==", professionalId)
      .where("status", "in", ["confirmed", "accepted", "completed"])
      .get();

    const slots: Record<string, any[]> = {};
    apptsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const key = `${data.date}_${data.time}`;
      if (!slots[key]) slots[key] = [];
      slots[key].push({ id: doc.id, ...data });
    });

    const fixed = [];
    const conflicts = [];
    const errors = [];

    for (const [key, apps] of Object.entries(slots)) {
      // Sort apps by createdAt to pick the first one
      apps.sort((a, b) => {
        const timeA = a.createdAt?.toDate
          ? a.createdAt.toDate().getTime()
          : new Date(a.createdAt).getTime();
        const timeB = b.createdAt?.toDate
          ? b.createdAt.toDate().getTime()
          : new Date(b.createdAt).getTime();
        return timeA - timeB;
      });

      const winner = apps[0];
      const losers = apps.slice(1);

      // Try to create lock for the winner
      const cleanTime = (winner.time || "").replace(":", "");
      const lockId = `${professionalId}_${winner.date}_${cleanTime}`;
      try {
        await db
          .collection("booking_locks")
          .doc(lockId)
          .set({
            professionalId,
            date: winner.date,
            time: winner.time,
            appointmentId: winner.id,
            serviceId: winner.serviceId || "unknown",
            status: winner.status,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        fixed.push({ lockId, appointmentId: winner.id });
      } catch (err: any) {
        errors.push({ lockId, error: err.message });
      }

      // Flag losers as conflicts
      for (const loser of losers) {
        try {
          const updatePayload = {
            status: "pending_conflict", // specific status for manual resolution
            conflictReason: `Conflito com a reserva ${winner.id}`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          const safeUpdate = sanitizeAppointment(updatePayload, true);

          await db.collection("appointments").doc(loser.id).update(safeUpdate);
          conflicts.push({ id: loser.id, key });
        } catch (err: any) {
          errors.push({ id: loser.id, error: err.message });
        }
      }
    }

    res.json({
      totalCheckedSlots: Object.keys(slots).length,
      fixedLocksCount: fixed.length,
      conflictsFoundCount: conflicts.length,
      fixed,
      conflicts,
      errors,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/debug-slot-lock", debugOnly, async (req, res) => {
  try {
    const db = getDb();
    const { professionalId, date, time } = req.query;
    if (!professionalId || !date || !time)
      return res.status(400).json({ error: "Missing parameters" });

    const cleanTime = (time as string).replace(":", "");
    const lockId = `${professionalId}_${date}_${cleanTime}`;
    const lockDoc = await db.collection("booking_locks").doc(lockId).get();

    const apptsSnap = await db
      .collection("appointments")
      .where("professionalId", "==", professionalId)
      .where("date", "==", date)
      .where("time", "==", time)
      .get();

    const allApps = apptsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const activeApps = allApps.filter(
      (a: any) =>
        isActiveSlotStatus(a.status) || a.status === "pending_conflict",
    );
    const pendingApps = allApps.filter((a: any) => isPendingStatus(a.status));

    res.json({
      lockId,
      lockExists: lockDoc.exists,
      lockData: lockDoc.exists ? lockDoc.data() : null,
      activeAppointmentsAtSlot: activeApps,
      pendingAppointmentsAtSlot: pendingApps,
      duplicateCount: activeApps.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- NEW: CREATE MANUAL APPOINTMENT ENDPOINT ---
router.post(
  "/manual",
  requireFirebaseAuth,
  async (req: AuthenticatedRequest, res: express.Response) => {
    logger.info("BOOKING", "[MANUAL_BOOKING_ROUTE_HIT] Iniciando criação manual");
    const db = getDb();
    const uid = req.uid;
    const appointmentData = req.body;


    logger.info("BOOKING", `[MANUAL_BOOKING_PAYLOAD] Received data for professional: ${appointmentData?.professionalId}`);

    if (!uid) {
      logger.error("BOOKING", "[MANUAL_BOOKING_ERROR] Sessão expirada ou sem auth UID");
      return res.status(401).json({ error: "Sessão expirada.", step: "auth" });
    }
    
    logger.info("BOOKING", `[MANUAL_BOOKING_AUTH_OK] Autenticado como ${uid}`);

    if (appointmentData.professionalId !== uid) {
      logger.error("BOOKING", `[MANUAL_BOOKING_ERROR] Auth incompatível. req.uid=${uid}, payload=${appointmentData.professionalId}`);
      return res.status(403).json({ error: "Acesso negado.", step: "auth_match" });
    }

    if (
      !appointmentData.date ||
      !appointmentData.time ||
      !appointmentData.serviceId
    ) {
      logger.error("BOOKING", "[MANUAL_BOOKING_ERROR] Dados incompletos", appointmentData);
      return res.status(400).json({ error: "Dados incompletos", step: "validation" });
    }

    const priceNum = Number(appointmentData.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      logger.error("BOOKING", "[MANUAL_BOOKING_ERROR] Valor inválido", { price: appointmentData.price });
      return res.status(400).json({ error: "Informe um valor válido.", step: "validation_price" });
    }

    logger.info("BOOKING", `[MANUAL_BOOKING_SERVICE_FOUND] Preparando transação para ${appointmentData.date} ${appointmentData.time}`);

    try {
      const result = await db.runTransaction(async (transaction: any) => {
        // 1. Lock check FIRST READ
        const cleanTime = String(appointmentData.time).replace(":", "");
        const lockId = `${uid}_${appointmentData.date}_${cleanTime}`;
        const lockRef = db.collection("booking_locks").doc(lockId);
        
        logger.info("BOOKING", `[MANUAL_BOOKING_LOCK_CHECK] ID: ${lockId}`);
        const lockSnap = await transaction.get(lockRef);
        const blockingStatuses = ["confirmed", "accepted", "completed"];

        if (lockSnap.exists && blockingStatuses.includes(lockSnap.data()?.status)) {
             throw new Error("Este horário já está ocupado na agenda.");
        }
        
        // 2. Client Summary SECOND READ (Must be before any set)
        const clientKey = getClientKey(
          appointmentData.clientWhatsapp,
          appointmentData.clientEmail,
          appointmentData.clientName,
        );
        const summaryId = `${uid}_${clientKey}`;
        const summaryRef = db.collection("client_summaries").doc(summaryId);
        const summarySnap = await transaction.get(summaryRef);


        // 3. Insert into appointments (WRITES)
        const appointmentId = db.collection("appointments").doc().id;
        const apptRef = db.collection("appointments").doc(appointmentId);

        const appointmentToSave = {
          ...appointmentData,
          id: appointmentId,
          status: "confirmed",
          source: "manual",
          totalPrice: priceNum,
          price: priceNum,
          professionalId: uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const safeAppointment = sanitizeAppointment(appointmentToSave, false);
        transaction.set(apptRef, safeAppointment);
        
        logger.info("BOOKING", `[MANUAL_BOOKING_APPOINTMENT_CREATED] ID: ${appointmentId}`);

        // 4. Set booking Lock (WRITES)
        transaction.set(lockRef, {
            professionalId: uid,
            date: appointmentData.date,
            time: appointmentData.time,
            status: "confirmed",
            appointmentId: appointmentId,
            clientName: appointmentData.clientName || 'Cliente',
            source: "manual",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 5. Update Client Summary (WITH PRE-FETCHED READ)
        await updateClientSummaryInternal(
            transaction,
            safeAppointment,
            uid,
            true,
            "",
            summarySnap
        );
        logger.info("BOOKING", `[MANUAL_BOOKING_CLIENT_SUMMARY_UPDATED] Executado.`);

        return { success: true, appointmentId };
      });
      
      logger.info("BOOKING", `[MANUAL_BOOKING_SUCCESS] ID do backend: ${result.appointmentId}`);
      res.json(result);
    } catch (err: any) {
        logger.error("BOOKING", "[MANUAL_BOOKING_ERROR] Falha na transação", { message: err.message, stack: err.stack });
        if (err.message === "Este horário já está ocupado na agenda.") {
            return res.status(409).json({ error: err.message, step: "lock" });
        }
        res.status(500).json({ error: err.message, step: "transaction" });
    }
  }
);

// --- NEW: ATOMIC APPOINTMENT CONFIRMATION ENDPOINT ---
router.post(
  "/appointments/:appointmentId/confirm",
  requireFirebaseAuth,
  async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDb();
    const { appointmentId } = req.params;
    const { professionalId } = req.body;
    const uid = req.uid;

    try {
      const result = await db.runTransaction(async (transaction) => {
        const apptRef = db.collection("appointments").doc(appointmentId);
        const apptDoc = await transaction.get(apptRef);

        if (!apptDoc.exists) {
          logger.error(
            "BOOKING",
            "Appointment not found during confirm transaction",
          );
          throw { status: 404, message: "Reserva não encontrada." };
        }

        const data: any = apptDoc.data();
        if (!data) {
          logger.error(
            "BOOKING",
            "Appointment has no data during confirm transaction",
          );
          throw { status: 400, message: "Dados da reserva inválidos." };
        }

        // Permission check using Auth UID, completely disregarding payload professionalId for authorization
        if (data.professionalId !== uid) {
          logger.warn("BOOKING", "Confirm permission denied");
          throw {
            status: 403,
            message: "Você não tem permissão para confirmar esta reserva.",
          };
        }

        // Extract date and time with fallbacks
        const dateAttr =
          data.date ||
          data.appointmentDate ||
          data.selectedDate ||
          data.scheduledDate;
        const timeAttr =
          data.time ||
          data.appointmentTime ||
          data.selectedTime ||
          data.startTime;

        if (!dateAttr || !timeAttr) {
          logger.error("BOOKING", "Missing date/time configuration");
          throw {
            status: 400,
            message: `Dados incompletos: ${!dateAttr ? "date" : "time"} ausente`,
          };
        }

        // IMPORTANTE: Firestore transactions exigem todos os reads antes dos writes.
        // 1. READS
        // Check for existing lock
        const cleanTime = timeAttr.replace(":", "");
        const lockId = `${data.professionalId}_${dateAttr}_${cleanTime}`;
        const lockRef = db.collection("booking_locks").doc(lockId);

        const lockSnap = await transaction.get(lockRef);

        // Read Client Summary
        const clientKey = getClientKey(
          data.clientWhatsapp,
          data.clientEmail,
          data.clientName,
        );
        const summaryId = `${data.professionalId}_${clientKey}`;
        const summaryRef = db.collection("client_summaries").doc(summaryId);
        const summarySnap = await transaction.get(summaryRef);

        // Check for duration overlap with other appointments
        const apptsQuery = db
          .collection("appointments")
          .where("professionalId", "==", data.professionalId)
          .where("date", "==", dateAttr);
        const existingApptsSnap = await transaction.get(apptsQuery);

        const blockingStatuses = [
          "confirmed",
          "accepted",
          "completed",
          "concluido",
        ];

        if (lockSnap.exists) {
          const lockData = lockSnap.data();
          if (
            lockData &&
            lockData.appointmentId !== appointmentId &&
            blockingStatuses.includes(lockData.status)
          ) {
            logger.warn("BOOKING", "Confirm failed, slot occupied");
            throw {
              status: 409,
              message: "Este horário acabou de ser ocupado por outra cliente.",
            };
          }
        }

        const newStart = timeToMinutes(timeAttr);
        const newDuration = Number(data.duration || data.serviceDuration || 60);
        const newEnd = newStart + newDuration;

        for (const doc of existingApptsSnap.docs) {
          if (doc.id === appointmentId) continue; // Skip itself

          const existing = doc.data();
          if (blockingStatuses.includes(existing.status)) {
            const existingStart = timeToMinutes(existing.time);
            const existingDuration = Number(
              existing.duration || existing.serviceDuration || 60,
            );
            const existingEnd = existingStart + existingDuration;

            if (
              intervalsOverlap(newStart, newEnd, existingStart, existingEnd)
            ) {
              logger.warn(
                "BOOKING",
                "Confirm failed, durational overlap detected",
                {
                  appointmentId,
                  meta: { existingAppointmentId: doc.id },
                },
              );
              throw {
                status: 409,
                message:
                  "Este horário já possui um agendamento conflitante de outra cliente.",
              };
            }
          }
        }

        // 2. WRITES
        // Update Appointment data
        const updatePayload: any = {
          status: "confirmed",
          confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          date: dateAttr,
          time: timeAttr,
          timeline: admin.firestore.FieldValue.arrayUnion({
            type: "booking_confirmed",
            createdAt: new Date().toISOString(),
            actor: "professional",
            label: "Profissional confirmou o atendimento",
          }),
        };

        const safeUpdate = sanitizeAppointment(updatePayload, true);

        transaction.update(apptRef, safeUpdate);

        // Create/Update the lock
        transaction.set(lockRef, {
          professionalId: data.professionalId,
          date: dateAttr,
          time: timeAttr,
          appointmentId: appointmentId,
          serviceId: data.serviceId || "unknown",
          status: "confirmed",
          createdAt: lockSnap.exists
            ? lockSnap.data().createdAt
            : admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const updatedData = { ...data, ...updatePayload };
        await updateClientSummaryInternal(
          transaction,
          updatedData,
          data.professionalId,
          false,
          data.status,
          summarySnap,
        );

        return { success: true, appointmentId, lockId, status: "confirmed" };
      });

      // Create Google Calendar event and send notification
      // Await safely to avoid serverless container freezing
      await Promise.allSettled([
        (async () => {
          try {
            const apptDoc = await db
              .collection("appointments")
              .doc(appointmentId)
              .get();
            if (apptDoc.exists) {
              const apptData = apptDoc.data();
              
              const p1 = (async () => {
                // 1. Google Calendar Integration
                createGoogleCalendarEvent(
                  { id: appointmentId, ...apptData },
                  professionalId,
                );
              })();

              const p2 = (async () => {
                // 2. Email Confirmation to Client
                await sendBookingConfirmedClientNotification(
                  { appointmentId },
                  PUBLIC_APP_URL,
                );
              })();
              
              await Promise.allSettled([p1, p2]);
            }
          } catch (err: any) {
            logger.error("NOTIFICATION", "Post-confirmation tasks failed", {
              appointmentId,
              error: err.message,
            });
          }
        })()
      ]);

      return res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      const message = err.message || "Erro interno do servidor";

      logger.error("BOOKING", "Confirm endpoint error", { error: err });

      return res.status(status).json({ error: message, code: status });
    }
  },
);

// --- NEW: COMPLETE APPOINTMENT ENDPOINT ---
router.post(
  "/appointments/:appointmentId/complete",
  requireFirebaseAuth,
  async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDb();
    const { appointmentId } = req.params;
    const uid = req.uid;

    try {
      const result = await db.runTransaction(async (transaction) => {
        const apptRef = db.collection("appointments").doc(appointmentId);
        const apptDoc = await transaction.get(apptRef);

        if (!apptDoc.exists) {
          throw { status: 404, message: "Agenda não encontrada." };
        }

        const data = apptDoc.data()!;

        if (data.professionalId !== uid) {
          throw { status: 403, message: "Você não tem permissão." };
        }

        // Idempotency: if already completed, just return success
        if (data.status === "completed") {
          return {
            success: true,
            appointmentId,
            status: "completed",
            alreadyCompleted: true,
            updatedData: data,
          };
        }

        if (data.status !== "confirmed" && data.status !== "accepted") {
          throw {
            status: 400,
            message: `Apenas atendimentos confirmados/aceitos podem ser concluídos. Status: ${data.status}`,
          };
        }

        const clientKey = getClientKey(
          data.clientWhatsapp,
          data.clientEmail,
          data.clientName,
        );
        const summaryId = `${data.professionalId}_${clientKey}`;
        const summaryRef = db.collection("client_summaries").doc(summaryId);
        const summarySnap = await transaction.get(summaryRef);

        const updatePayload: any = {
          status: "completed",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          timeline: admin.firestore.FieldValue.arrayUnion({
            type: "booking_completed",
            createdAt: new Date().toISOString(),
            actor: "professional",
            label: "Atendimento finalizado",
          }),
        };

        const safeUpdate = sanitizeAppointment(updatePayload, true);

        transaction.update(apptRef, safeUpdate);

        const updatedData = { ...data, ...safeUpdate };
        await updateClientSummaryInternal(
          transaction,
          updatedData,
          data.professionalId,
          false,
          data.status,
          summarySnap,
        );

        const reviewToken = randomBytes(24).toString("hex");
        const reviewRef = db.collection("review_requests").doc();
        transaction.set(reviewRef, {
          bookingId: appointmentId,
          professionalId: data.professionalId,
          clientDisplayName: data.clientName,
          clientNeighborhood: data.neighborhood || "",
          token: reviewToken,
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          success: true,
          appointmentId,
          status: "completed",
          updatedData,
          reviewToken,
        };
      });

      // -------------------------------------------------------------
      // Post-Transaction Async Tasks
      // -------------------------------------------------------------
      const updatedData = result.updatedData;

      try {
        if (updatedData && updatedData.clientEmail) {
          let slug = "";
          try {
            const userDoc = await db
              .collection("users")
              .doc(updatedData.professionalId)
              .get();
            if (userDoc.exists) {
              slug = userDoc.data()?.slug || "";
            }
          } catch (e) {
            logger.warn(
              "BOOKING",
              "Failed to fetch professional slug for digital receipt",
              { error: e },
            );
          }

          let reviewUrl = "";
          if (result.reviewToken) {
            reviewUrl = `${PUBLIC_APP_URL}/review/${result.reviewToken}`;
          }

          const eventKey = "digital_receipt";
          if (await shouldSendEmail(appointmentId, eventKey)) {
            sendDigitalReceiptEmail({
              clientEmail: updatedData.clientEmail,
              clientName: updatedData.clientName,
              professionalName:
                updatedData.professionalName || updatedData.serviceName, // fallback
              appointmentId: updatedData.id || appointmentId,
              serviceName: updatedData.serviceName,
              date: updatedData.date,
              time: updatedData.time,
              totalPrice: updatedData.totalPrice,
              price: updatedData.price,
              slug,
              reviewUrl,
            })
              .then(async (res) => {
                if (res.success) {
                  await markEmailSent(appointmentId, eventKey);
                  if (reviewUrl) {
                    await db
                      .collection("appointments")
                      .doc(appointmentId)
                      .update({
                        reviewRequestedAt:
                          admin.firestore.FieldValue.serverTimestamp(),
                      });
                  }
                }
              })
              .catch((e) => {
                logger.error(
                  "BOOKING",
                  "Failed to send digital receipt email after completion",
                  { error: e },
                );
              });
          }
        }
      } catch (postError) {
        logger.error("BOOKING", "Post-completion email error", {
          error: postError,
        });
      }

      return res.json({
        success: result.success,
        appointmentId: result.appointmentId,
        status: result.status,
        reviewToken: result.reviewToken,
      });
    } catch (err: any) {
      logger.error("BOOKING", "Complete endpoint error", { error: err });
      const status = err.status || 500;
      const message = err.message || "Erro ao concluir atendimento";
      res.status(status).json({ error: message, details: err });
    }
  },
);

// --- NEW: DECLINE APPOINTMENT BY PROFESSIONAL ENDPOINT ---
router.post(
  "/appointments/:appointmentId/decline",
  requireFirebaseAuth,
  async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDb();
    const { appointmentId } = req.params;
    const uid = req.uid;

    try {
      const result = await db.runTransaction(async (transaction) => {
        const apptRef = db.collection("appointments").doc(appointmentId);
        const apptDoc = await transaction.get(apptRef);

        if (!apptDoc.exists)
          throw { status: 404, message: "Reserva não encontrada." };
        const data: any = apptDoc.data();

        if (data.professionalId !== uid) {
          throw { status: 403, message: "Você não tem permissão." };
        }

        if (data.status !== "pending") {
          throw {
            status: 400,
            message: `Transição de ${data.status} para recusada não permitida.`,
          };
        }

        // IMPORTANTE: Firestore transactions exigem todos os reads antes dos writes.
        // 1. READS
        let shouldDeleteLock = false;
        let deleteLockRef: admin.firestore.DocumentReference | null = null;

        const lockId = getBookingLockId(data);
        if (lockId) {
          deleteLockRef = db.collection("booking_locks").doc(lockId);
          const lockSnap = await transaction.get(deleteLockRef);
          if (lockSnap.exists) {
            if (lockSnap.data()?.appointmentId === appointmentId) {
              shouldDeleteLock = true;
            } else {
            }
          }
        }

        // Read Client Summary
        const clientKey = getClientKey(
          data.clientWhatsapp,
          data.clientEmail,
          data.clientName,
        );
        const summaryId = `${data.professionalId}_${clientKey}`;
        const summaryRef = db.collection("client_summaries").doc(summaryId);
        const summarySnap = await transaction.get(summaryRef);

        // 2. WRITES
        if (shouldDeleteLock && deleteLockRef) {
          transaction.delete(deleteLockRef);
        }

        const updatePayload: any = {
          status: "cancelled_by_professional",
          declinedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastChangeBy: "professional",
          changeMessage: "Recusado pelo profissional",
          timeline: admin.firestore.FieldValue.arrayUnion({
            type: "booking_declined",
            createdAt: new Date().toISOString(),
            actor: "professional",
            label: "Profissional recusou o pedido",
          }),
        };

        const safeUpdate = sanitizeAppointment(updatePayload, true);

        transaction.update(apptRef, safeUpdate);

        const updatedData = { ...data, ...safeUpdate };
        await updateClientSummaryInternal(
          transaction,
          updatedData,
          data.professionalId,
          false,
          data.status,
          summarySnap,
        );

        return { success: true, appointmentId, updatedData };
      });

      // Trigger waitlist after successful decline
      if (result.success && result.updatedData) {
        logger.info("WAITLIST", "[WAITLIST_TRIGGER_AFTER_PRO_CANCEL] Triggering waitlist on pending decline", { appointmentId, date: result.updatedData.date, time: result.updatedData.time });
        triggerWaitlistCheckBackend(
          db,
          result.updatedData.professionalId,
          result.updatedData.date,
          result.updatedData.time
        ).catch(err => {
          logger.error("WAITLIST", "Error triggering waitlist check after decline", { error: err });
        });
      }

      // Notify client that professional declined
      if (
        result.success &&
        result.updatedData &&
        result.updatedData.clientEmail
      ) {
        // Find pro doc for their name and slug
        const proData = req.userData;

        const eventKey = "bookingDeclinedClient";
        if (await shouldSendEmail(appointmentId, eventKey)) {
          await sendBookingDeclinedClientEmail({
            clientEmail: result.updatedData.clientEmail,
            clientName: result.updatedData.clientName,
            professionalName: proData?.name || "Profissional",
            bookingId: result.appointmentId,
            date: result.updatedData.date,
            time: result.updatedData.time,
            serviceName: result.updatedData.serviceName,
            profileUrl: proData?.slug
              ? `${PUBLIC_APP_URL}/p/${proData.slug}`
              : PUBLIC_APP_URL,
            location:
              result.updatedData.locationType === "client"
                ? "Na sua casa"
                : result.updatedData.locationType === "remote"
                  ? "Online"
                  : "No local",
          });
          await markEmailSent(appointmentId, eventKey);
        }

        // WhatsApp: BOOKING_REJECTED
        if (result.updatedData.clientWhatsapp) {
          const profileUrl = proData?.slug
            ? `${PUBLIC_APP_URL}/p/${proData.slug}`
            : PUBLIC_APP_URL;
            
          const formattedDate = result.updatedData.date.split('-').reverse().join('/');
          const msg = buildBookingRejectedMessageForClient({
            clientName: result.updatedData.clientName,
            serviceName: result.updatedData.serviceName,
            date: formattedDate,
            time: result.updatedData.time,
            professionalPageUrl: profileUrl
          });
          
          await sendWhatsApp(db, result.updatedData.clientWhatsapp, msg, {
            appointmentId: result.appointmentId,
            userId: result.updatedData.professionalId,
            type: 'booking_rejected',
            clientName: result.updatedData.clientName,
            clientWhatsapp: result.updatedData.clientWhatsapp
          });
        }
      }

      return res.json({ success: true, appointmentId: result.appointmentId });
    } catch (err: any) {
      const status = err.status || 500;
      const message = err.message || "Erro interno do servidor";
      logger.error("BOOKING", "Decline endpoint error", { error: err });
      return res.status(status).json({ error: message });
    }
  },
);

// --- NEW: CANCEL CONFIRMED APPOINTMENT BY PROFESSIONAL ENDPOINT ---
router.post(
  "/appointments/:appointmentId/cancel-by-professional",
  requireFirebaseAuth,
  async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDb();
    const { appointmentId } = req.params;
    const uid = req.uid;

    try {
      const result = await db.runTransaction(async (transaction) => {
        const apptRef = db.collection("appointments").doc(appointmentId);
        const apptDoc = await transaction.get(apptRef);

        if (!apptDoc.exists)
          throw { status: 404, message: "Reserva não encontrada." };
        const data: any = apptDoc.data();

        if (data.professionalId !== uid) {
          throw { status: 403, message: "Você não tem permissão." };
        }

        if (data.status !== "confirmed" && data.status !== "accepted") {
          throw {
            status: 400,
            message: `Apenas confirmados podem ser cancelados. Status: ${data.status}`,
          };
        }

        // IMPORTANTE: Firestore transactions exigem todos os reads antes dos writes.
        // 1. READS
        let shouldDeleteLock = false;
        let deleteLockRef: admin.firestore.DocumentReference | null = null;

        const lockId = getBookingLockId(data);
        if (lockId) {
          deleteLockRef = db.collection("booking_locks").doc(lockId);
          const lockSnap = await transaction.get(deleteLockRef);
          if (lockSnap.exists) {
            if (lockSnap.data()?.appointmentId === appointmentId) {
              shouldDeleteLock = true;
            } else {
            }
          } else {
          }
        } else {
        }

        // Read Client Summary
        const clientKey = getClientKey(
          data.clientWhatsapp,
          data.clientEmail,
          data.clientName,
        );
        const summaryId = `${data.professionalId}_${clientKey}`;
        const summaryRef = db.collection("client_summaries").doc(summaryId);
        const summarySnap = await transaction.get(summaryRef);

        // 2. WRITES
        if (shouldDeleteLock && deleteLockRef) {
          transaction.delete(deleteLockRef);
        }

        const updatePayload: any = {
          status: "cancelled_by_professional",
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastChangeBy: "professional",
          changeMessage: "Cancelado pelo profissional",
          timeline: admin.firestore.FieldValue.arrayUnion({
            type: "booking_cancelled_professional",
            createdAt: new Date().toISOString(),
            actor: "professional",
            label: "Profissional cancelou o atendimento",
          }),
        };

        const safeUpdate = sanitizeAppointment(updatePayload, true);

        transaction.update(apptRef, safeUpdate);

        const updatedData = { ...data, ...safeUpdate, id: appointmentId };
        await updateClientSummaryInternal(
          transaction,
          updatedData,
          data.professionalId,
          false,
          data.status,
          summarySnap,
        );

        return { success: true, appointmentId, updatedData };
      });

      // Trigger waitlist after successful cancellation
      if (result.success && result.updatedData) {
        logger.info("WAITLIST", "[WAITLIST_TRIGGER_AFTER_PRO_CANCEL] Triggering waitlist on professional cancel", { appointmentId, date: result.updatedData.date, time: result.updatedData.time });
        triggerWaitlistCheckBackend(
          db,
          result.updatedData.professionalId,
          result.updatedData.date,
          result.updatedData.time
        ).catch(err => {
          logger.error("WAITLIST", "Error triggering waitlist check after professional cancel", { error: err });
        });
      }

      // Notify client that professional cancelled
      if (
        result.success &&
        result.updatedData &&
        result.updatedData.clientEmail
      ) {
        const proData = req.userData;

        const eventKey = "bookingCancelledClient";
        if (await shouldSendEmail(appointmentId, eventKey)) {
          await sendBookingCancelledClientEmail({
            clientEmail: result.updatedData.clientEmail,
            clientName: result.updatedData.clientName,
            professionalName: proData?.name || "Profissional",
            bookingId: result.appointmentId,
            date: result.updatedData.date,
            time: result.updatedData.time,
            serviceName: result.updatedData.serviceName,
          }).then(async (res) => {
            if (res.success) {
              await markEmailSent(appointmentId, eventKey);
            }
          });
        }

        // WhatsApp: BOOKING_CANCELLED (by pro)
        if (result.updatedData.clientWhatsapp) {
          const profileUrl = proData?.slug
            ? `${PUBLIC_APP_URL}/p/${proData.slug}`
            : PUBLIC_APP_URL;

          const formattedDate = result.updatedData.date.split('-').reverse().join('/');
          const waMsg = buildCancellationByProMessageForClient({
            clientName: result.updatedData.clientName,
            serviceName: result.updatedData.serviceName,
            date: formattedDate,
            time: result.updatedData.time,
            professionalPageUrl: profileUrl
          });

          await sendWhatsApp(db, result.updatedData.clientWhatsapp, waMsg, {
            appointmentId: result.appointmentId,
            userId: result.updatedData.professionalId,
            type: 'booking_cancelled_client',
            clientName: result.updatedData.clientName,
            clientWhatsapp: result.updatedData.clientWhatsapp
          });
        }

        // Attempt to delete calendar event
        if (result.updatedData.googleCalendarEventId) {
          deleteGoogleCalendarEvent(result.updatedData, uid);
        }
      }

      return res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      const message = err.message || "Erro interno do servidor";
      logger.error("BOOKING", "Cancel endpoint error", { error: err });
      return res.status(status).json({ error: message });
    }
  },
);

// --- NEW: DIAGNOSTIC ENDPOINT FOR CAN BOOK SLOT ---
router.get("/debug-can-book-slot", debugOnly, async (req, res) => {
  try {
    const db = getDb();
    const { professionalId, serviceId, date, time } = req.query;
    if (!professionalId || !date || !time)
      return res
        .status(400)
        .json({ error: "Missing professionalId, date or time" });

    const proDoc = await db
      .collection("users")
      .doc(professionalId as string)
      .get();
    if (!proDoc.exists)
      return res.status(404).json({ error: "Professional not found" });
    const pro: any = proDoc.data();

    let serviceDuration = 60;
    if (serviceId) {
      const svcDoc = await db
        .collection("services")
        .doc(serviceId as string)
        .get();
      if (svcDoc.exists) {
        serviceDuration = Number(svcDoc.data()?.duration) || 60;
      }
    }

    // Fetch appointments
    const apptsSnap = await db
      .collection("appointments")
      .where("professionalId", "==", professionalId)
      .where("date", "==", date)
      .where("status", "in", ["confirmed", "completed", "accepted"])
      .get();
    const appointments = apptsSnap.docs.map((d) => d.data());

    // Fetch blocks
    const blocksSnap = await db
      .collection("blocked_schedules")
      .where("professionalId", "==", professionalId)
      .get();
    const blocks = blocksSnap.docs.map((d) => d.data());

    // Check working hours
    const workingHours = pro.workingHours;
    const dObj = new Date((date as string) + "T12:00:00");
    const dayOfWeek = dObj.getDay();
    const isWorkingDay = workingHours?.workingDays?.includes(dayOfWeek);

    if (!isWorkingDay) {
      return res.json({
        canBook: false,
        reason: "Not a working day",
        debug: { dayOfWeek, workingDays: workingHours?.workingDays },
      });
    }

    // Simple overlap logic for debug
    const [h, m] = (time as string).split(":").map(Number);
    const slotStart = h * 60 + m;
    const slotEnd = slotStart + serviceDuration;

    // Check against work hours range
    const [whs, wms] = (workingHours.startTime || "09:00")
      .split(":")
      .map(Number);
    const [whe, wme] = (workingHours.endTime || "18:00").split(":").map(Number);
    const workStart = whs * 60 + wms;
    const workEnd = whe * 60 + wme;

    if (slotStart < workStart || slotEnd > workEnd) {
      return res.json({
        canBook: false,
        reason: "Outside working hours",
        debug: { slotStart, slotEnd, workStart, workEnd },
      });
    }

    if (workingHours.breakStart && workingHours.breakEnd) {
      const [bhs, bms] = workingHours.breakStart.split(":").map(Number);
      const [bhe, bme] = workingHours.breakEnd.split(":").map(Number);
      const breakStartMinutes = bhs * 60 + bms;
      const breakEndMinutes = bhe * 60 + bme;

      if (
        Math.max(slotStart, breakStartMinutes) <
        Math.min(slotEnd, breakEndMinutes)
      ) {
        return res.json({
          canBook: false,
          reason: "Slot overlaps with break time",
        });
      }
    }

    // Check against appointments
    const conflictingAppt = appointments.find((a: any) => {
      const [ah, am] = a.time.split(":").map(Number);
      const aStart = ah * 60 + am;
      const aEnd = aStart + (Number(a.duration) || 60);
      return Math.max(slotStart, aStart) < Math.min(slotEnd, aEnd);
    });

    if (conflictingAppt) {
      return res.json({
        canBook: false,
        reason: "Conflict with existing appointment",
        conflictingAppt,
      });
    }

    // Check against blocks
    const conflictingBlock = blocks.find((b: any) => {
      const isFixed = b.date === date;
      const isRecurring = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
      if (!isFixed && !isRecurring) return false;

      const [bh, bm] = b.startTime.split(":").map(Number);
      const [beh, bem] = b.endTime.split(":").map(Number);
      const bStart = bh * 60 + bm;
      const bEnd = beh * 60 + bem;
      return Math.max(slotStart, bStart) < Math.min(slotEnd, bEnd);
    });

    if (conflictingBlock) {
      return res.json({
        canBook: false,
        reason: "Conflict with professional block",
        conflictingBlock,
      });
    }

    res.json({ canBook: true, message: "Slot is available" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/debug-reservation-token", debugOnly, async (req, res) => {
  try {
    const db = getDb();
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Missing token" });

    const results: any = { tokenReceived: token };

    // Search by token
    const q1 = await db
      .collection("appointments")
      .where("token", "==", token)
      .limit(1)
      .get();
    results.foundByToken = !q1.empty;

    // Search by publicToken
    const q2 = await db
      .collection("appointments")
      .where("publicToken", "==", token)
      .limit(1)
      .get();
    results.foundByPublicToken = !q2.empty;

    // Search by manageToken
    const q3 = await db
      .collection("appointments")
      .where("manageToken", "==", token)
      .limit(1)
      .get();
    results.foundByManageToken = !q3.empty;

    // Search by docId
    const q4 = await db
      .collection("appointments")
      .doc(token as string)
      .get();
    results.foundByDocId = q4.exists;

    const mainDoc =
      q1.docs[0] || q2.docs[0] || q3.docs[0] || (q4.exists ? q4 : null);

    if (mainDoc) {
      results.appointmentId = mainDoc.id;
      results.appointmentData = mainDoc.data();
    }

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/debug-next-slot-full", debugOnly, async (req, res) => {
  try {
    const db = getDb();
    const { professionalId, serviceId } = req.query;
    if (!professionalId)
      return res.status(400).json({ error: "Missing professionalId" });

    const proDoc = await db
      .collection("users")
      .doc(professionalId as string)
      .get();
    if (!proDoc.exists)
      return res.status(404).json({ error: "Professional not found" });
    const pro: any = proDoc.data();

    let serviceDuration = 60;
    if (serviceId) {
      const svcDoc = await db
        .collection("services")
        .doc(serviceId as string)
        .get();
      if (svcDoc.exists)
        serviceDuration = Number(svcDoc.data()?.duration) || 60;
    }

    const daysToLook = 14;
    const daysChecked = [];
    const now = new Date();

    const appointmentsSnap = await db
      .collection("appointments")
      .where("professionalId", "==", professionalId)
      .where("status", "in", ["confirmed", "completed", "accepted"])
      .get();
    const allAppts = appointmentsSnap.docs.map((d) => d.data());

    const blocksSnap = await db
      .collection("blocked_schedules")
      .where("professionalId", "==", professionalId)
      .get();
    const allBlocks = blocksSnap.docs.map((d) => d.data());

    for (let i = 0; i < daysToLook; i++) {
      const d = new Date();
      d.setDate(now.getDate() + i);
      const dStr = d.toISOString().split("T")[0];

      const workingHours = pro.workingHours;
      const dayOfWeek = d.getDay();
      const isWorkingDay = workingHours?.workingDays?.includes(dayOfWeek);

      if (!isWorkingDay) {
        daysChecked.push({
          date: dStr,
          agendaSlotsCount: 0,
          reason: "Not a working day",
        });
        continue;
      }

      const slots = [];
      const [whs, wms] = (workingHours.startTime || "09:00")
        .split(":")
        .map(Number);
      const [whe, wme] = (workingHours.endTime || "18:00")
        .split(":")
        .map(Number);
      const workStart = whs * 60 + wms;
      const workEnd = whe * 60 + wme;

      for (let curr = workStart; curr < workEnd; curr += 30) {
        const pEnd = curr + serviceDuration;
        if (pEnd > workEnd) break;

        if (i === 0) {
          // Today
          const nowMin = now.getHours() * 60 + now.getMinutes();
          if (curr <= nowMin + 40) continue;
        }

        const hasAppt = allAppts.some((a: any) => {
          if (a.date !== dStr) return false;
          const [ah, am] = a.time.split(":").map(Number);
          const aS = ah * 60 + am;
          const aE = aS + (Number(a.duration) || 60);
          return Math.max(curr, aS) < Math.min(pEnd, aE);
        });

        const hasBlock = allBlocks.some((b: any) => {
          const isF = b.date === dStr;
          const isR = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
          if (!isF && !isR) return false;
          const [bh, bm] = b.startTime.split(":").map(Number);
          const [beh, bem] = b.endTime.split(":").map(Number);
          const bS = bh * 60 + bm;
          const bE = beh * 60 + bem;
          return Math.max(curr, bS) < Math.min(pEnd, bE);
        });

        const isBreak = (() => {
          if (!workingHours.breakStart || !workingHours.breakEnd) return false;
          const [bhs, bms] = workingHours.breakStart.split(":").map(Number);
          const [bhe, bme] = workingHours.breakEnd.split(":").map(Number);
          const bs = bhs * 60 + bms;
          const be = bhe * 60 + bme;
          return Math.max(curr, bs) < Math.min(pEnd, be);
        })();

        if (!hasAppt && !hasBlock && !isBreak) {
          const h = Math.floor(curr / 60);
          const m = curr % 60;
          slots.push(
            `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
          );
        }
      }

      daysChecked.push({
        date: dStr,
        agendaSlotsCount: slots.length,
        agendaSlots: slots,
        badgeWouldShow: slots.length > 0,
      });
    }

    res.json({
      professionalId,
      serviceDuration,
      daysChecked,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/debug-bookable-slots", debugOnly, async (req, res) => {
  try {
    const db = getDb();
    const { professionalId, serviceId, date } = req.query;
    if (!professionalId || !date)
      return res.status(400).json({ error: "Missing professionalId or date" });

    const proDoc = await db
      .collection("users")
      .doc(professionalId as string)
      .get();
    if (!proDoc.exists)
      return res.status(404).json({ error: "Professional not found" });
    const pro: any = proDoc.data();

    let serviceDuration = 60;
    if (serviceId) {
      const svcDoc = await db
        .collection("services")
        .doc(serviceId as string)
        .get();
      if (svcDoc.exists) {
        const svcData: any = svcDoc.data();
        serviceDuration = Number(svcData.duration) || 60;
      }
    }

    const apptsSnap = await db
      .collection("appointments")
      .where("professionalId", "==", professionalId)
      .where("date", "==", date)
      .where("status", "in", ["confirmed", "completed"])
      .get();

    const appointments = apptsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const blocksSnap = await db
      .collection("blocked_schedules")
      .where("professionalId", "==", professionalId)
      .get();
    const blockedSchedules = blocksSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    const d = new Date((date as string) + "T12:00:00");
    const dayOfWeek = d.getDay();
    const dayBlocks = blockedSchedules.filter((b: any) => {
      const isFixed = b.date === date;
      const isRecurring = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
      return isFixed || isRecurring;
    });

    res.json({
      professionalId,
      serviceId,
      serviceDuration,
      date,
      workingHours: pro.workingHours,
      isWorkingDay: pro.workingHours?.workingDays?.includes(dayOfWeek),
      appointmentsInDay: appointments.length,
      blocksInDay: dayBlocks.length,
      appointments: appointments.map((a: any) => ({
        time: a.time,
        duration: a.duration,
      })),
      blocks: dayBlocks.map((b: any) => ({
        start: b.startTime,
        end: b.endTime,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/public/manage/:manageSlug/confirm-presence", async (req, res) => {
  const db = getDb();
  const { manageSlug } = req.params;

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 1. Validate slug using only explicit token fields
      const linkRef = db.collection("reservation_links").doc(manageSlug);
      const linkDoc = await transaction.get(linkRef);

      let appointmentId = linkDoc.exists ? linkDoc.data()?.appointmentId : null;
      let apptRef = null;
      let apptDoc = null;

      if (!appointmentId) {
        const strategies = [
          "manageSlug",
          "token",
          "publicToken",
          "manageToken",
        ];
        for (const field of strategies) {
          const q = await transaction.get(
            db
              .collection("appointments")
              .where(field, "==", manageSlug)
              .limit(1),
          );
          if (!q.empty) {
            appointmentId = q.docs[0].id;
            apptRef = db.collection("appointments").doc(appointmentId);
            apptDoc = await transaction.get(apptRef);
            break;
          }
        }
        if (!appointmentId)
          throw { status: 404, message: "Link de gerenciamento inválido." };
      } else {
        apptRef = db.collection("appointments").doc(appointmentId);
        apptDoc = await transaction.get(apptRef);
      }

      if (!apptDoc || !apptDoc.exists)
        throw { status: 404, message: "Reserva não encontrada." };
      const data: any = apptDoc.data();

      // Read Client Summary
      const clientKey = getClientKey(
        data.clientWhatsapp,
        data.clientEmail,
        data.clientName,
      );
      const summaryId = `${data.professionalId}_${clientKey}`;
      const summaryRef = db.collection("client_summaries").doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);

      // Check for terminal or invalid statuses
      if (
        [
          "cancelled",
          "cancelled_by_client",
          "cancelled_by_professional",
          "declined",
          "completed",
          "concluido",
        ].includes(data.status)
      ) {
        throw { status: 409, message: "Esta reserva não pode ser confirmada." };
      }

      // WRITES
      const updatePayload: any = {
        clientConfirmed24h: true,
        clientAttendanceConfirmedAt:
          admin.firestore.FieldValue.serverTimestamp(),
        attendanceStatus: "confirmed",
        lastChangeBy: "client",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        timeline: admin.firestore.FieldValue.arrayUnion({
          type: "attendance_confirmed",
          createdAt: new Date().toISOString(),
          actor: "client",
          label: "Cliente confirmou presença",
        }),
      };

      // Só alterar status para confirmed se o status atual for pending/pending_confirmation
      if (["pending", "pending_confirmation"].includes(data.status)) {
        updatePayload.status = "confirmed";
      }

      const safeUpdate = sanitizeAppointment(updatePayload, true);
      transaction.update(apptRef, safeUpdate);

      const updatedData = { ...data, ...updatePayload };
      await updateClientSummaryInternal(
        transaction,
        updatedData,
        data.professionalId,
        false,
        data.status,
        summarySnap,
      );

      return { success: true, appointmentId };
    });

    res.json(result);
  } catch (err: any) {
    logger.error("BOOKING", "Manage Confirm Presence Error", { error: err });
    if (err.status) {
      res.status(err.status).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.post(
  "/public/manage/:manageSlug/reschedule-request",
  async (req, res) => {
    // Rota neutralizada intencionalmente (P0).
    // O fluxo foi alterado para apenas notificar a profissional
    // quando a cliente escolher e confirmar o novo horário no endpoint /reschedule.
    res.status(410).json({
      error:
        "Este fluxo foi substituído. Escolha uma nova data e horário para concluir a remarcação.",
      code: "GONE_RESCHEDULE_REQUEST",
    });
  },
);

// --- NEW: CANCEL BY CLIENT VIA MANAGE SLUG ---
router.post(
  "/public/manage/:manageSlug/cancel",
  async (req: express.Request, res: express.Response) => {
    const db = getDb();
    const { manageSlug } = req.params;
    const { reason } = req.body;

    try {
      const result = await db.runTransaction(async (transaction) => {
        // 1. Validate slug using only explicit token fields
        const linkRef = db.collection("reservation_links").doc(manageSlug);
        const linkDoc = await transaction.get(linkRef);

        let appointmentId = linkDoc.exists
          ? linkDoc.data()?.appointmentId
          : null;
        let apptRef = null;
        let apptDoc = null;

        if (!appointmentId) {
          const strategies = [
            "manageSlug",
            "token",
            "publicToken",
            "manageToken",
          ];
          for (const field of strategies) {
            const q = await transaction.get(
              db
                .collection("appointments")
                .where(field, "==", manageSlug)
                .limit(1),
            );
            if (!q.empty) {
              appointmentId = q.docs[0].id;
              apptRef = db.collection("appointments").doc(appointmentId);
              apptDoc = await transaction.get(apptRef);
              break;
            }
          }
          if (!appointmentId)
            throw { status: 404, message: "Link de gerenciamento inválido." };
        } else {
          apptRef = db.collection("appointments").doc(appointmentId);
          apptDoc = await transaction.get(apptRef);
        }

        if (!apptDoc || !apptDoc.exists)
          throw { status: 404, message: "Reserva não encontrada." };
        const data: any = apptDoc.data();

        if (
          [
            "cancelled",
            "cancelled_by_client",
            "cancelled_by_professional",
          ].includes(data.status)
        ) {
          throw { status: 400, message: "Reserva já está cancelada." };
        }

        // 1. READS for Lock
        let shouldDeleteLock = false;
        let deleteLockRef: admin.firestore.DocumentReference | null = null;

        const lockId = getBookingLockId(data);
        if (lockId) {
          deleteLockRef = db.collection("booking_locks").doc(lockId);
          const lockSnap = await transaction.get(deleteLockRef);
          if (lockSnap.exists) {
            if (lockSnap.data()?.appointmentId === appointmentId) {
              shouldDeleteLock = true;
            } else {
            }
          }
        }

        // Read Client Summary
        const clientKey = getClientKey(
          data.clientWhatsapp,
          data.clientEmail,
          data.clientName,
        );
        const summaryId = `${data.professionalId}_${clientKey}`;
        const summaryRef = db.collection("client_summaries").doc(summaryId);
        const summarySnap = await transaction.get(summaryRef);

        // 2. WRITES
        if (shouldDeleteLock && deleteLockRef) {
          transaction.delete(deleteLockRef);
        }

        const updatePayload: any = {
          status: "cancelled_by_client",
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          cancellationReason: reason || "Cancelado pelo cliente",
          lastChangeBy: "client",
          changeMessage: "Cliente cancelou a reserva",
          timeline: admin.firestore.FieldValue.arrayUnion({
            type: "booking_cancelled_client",
            createdAt: new Date().toISOString(),
            actor: "client",
            label: "Cliente cancelou a reserva",
          }),
        };

        const safeUpdate = sanitizeAppointment(updatePayload, true);

        transaction.update(apptRef, safeUpdate);

        const updatedData = { ...data, ...safeUpdate, id: appointmentId };
        await updateClientSummaryInternal(
          transaction,
          updatedData,
          data.professionalId,
          false,
          data.status,
          summarySnap,
        );

        return { success: true, appointmentId, appointmentData: updatedData };
      });

      // Trigger waitlist after successful cancellation
      if (result.success && result.appointmentData) {
        logger.info("WAITLIST", "[WAITLIST_TRIGGER_AFTER_CANCEL] Triggering waitlist on client cancel", { appointmentId: result.appointmentId, date: result.appointmentData.date, time: result.appointmentData.time });
        triggerWaitlistCheckBackend(
          db,
          result.appointmentData.professionalId,
          result.appointmentData.date,
          result.appointmentData.time
        ).catch(err => {
          logger.error("WAITLIST", "Error triggering waitlist check after client cancel", { error: err });
        });
      }

      return res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      const message = err.message || "Erro interno do servidor";
      logger.error("BOOKING", "Cancel by client error", { error: err });
      return res.status(status).json({ error: message });
    }
  },
);

router.post(
  "/public/manage/:manageSlug/reschedule",
  async (req: express.Request, res: express.Response) => {
    const db = getDb();
    const { manageSlug } = req.params;
    const { newDate, newTime } = req.body;

    const maskedSlug = manageSlug
      ? `${manageSlug.substring(0, 4)}***${manageSlug.substring(manageSlug.length - 4)}`
      : "NULL";
    logger.info(
      "DIAGNOSTIC",
      `Start reschedule flow: token ${maskedSlug}, to ${newDate} ${newTime}`,
    );

    if (
      !newDate ||
      !newTime ||
      typeof newDate !== "string" ||
      typeof newTime !== "string"
    ) {
      return res
        .status(400)
        .json({ error: "Nova data e horário são obrigatórios." });
    }

    const safeNewDate = newDate.trim();
    const safeNewTime = newTime.trim();

    const dateMatch = safeNewDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      return res
        .status(400)
        .json({ error: "Data em formato inválido. Use YYYY-MM-DD." });
    }
    const year = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    const day = parseInt(dateMatch[3], 10);
    const dateObj = new Date(year, month - 1, day);
    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getDate() !== day
    ) {
      return res.status(400).json({ error: "Data inexistente ou inválida." });
    }

    const timeMatch = safeNewTime.match(/^(\d{2}):(\d{2})$/);
    if (!timeMatch) {
      return res
        .status(400)
        .json({ error: "Horário em formato inválido. Use HH:mm." });
    }
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return res
        .status(400)
        .json({ error: "Horário inexistente ou inválido." });
    }

    let debugStep = "INIT";

    try {
      const result = await db.runTransaction(async (transaction) => {
        debugStep = "LINK_LOOKUP";
        // 1. Validate slug using only explicit token fields
        const linkRef = db.collection("reservation_links").doc(manageSlug);
        const linkDoc = await transaction.get(linkRef);

        let appointmentId = linkDoc.exists
          ? linkDoc.data()?.appointmentId
          : null;
        let apptRef = null;
        let apptDoc = null;

        if (!appointmentId) {
          debugStep = "APPT_LOOKUP_BY_TOKEN";
          // Fallback: check query for token fields only. NEVER use apptDoc.id === manageSlug here.
          const strategies = [
            "manageSlug",
            "token",
            "publicToken",
            "manageToken",
          ];
          for (const field of strategies) {
            const q = await transaction.get(
              db
                .collection("appointments")
                .where(field, "==", manageSlug)
                .limit(1),
            );
            if (!q.empty) {
              appointmentId = q.docs[0].id;
              apptRef = db.collection("appointments").doc(appointmentId);
              apptDoc = await transaction.get(apptRef);
              break;
            }
          }
          if (!appointmentId)
            throw {
              status: 404,
              message: "Link de gerenciamento ou reserva não encontrada.",
            };
        } else {
          debugStep = "APPT_LOOKUP_BY_ID";
          apptRef = db.collection("appointments").doc(appointmentId);
          apptDoc = await transaction.get(apptRef);
        }

        if (!apptDoc || !apptDoc.exists)
          throw { status: 404, message: "Reserva não encontrada." };
        const data: any = apptDoc.data();

        debugStep = "STATUS_VALIDATION";
        // Ensure valid status for rescheduling
        const blockRescheduleStatuses = [
          "cancelled",
          "cancelled_by_client",
          "cancelled_by_professional",
          "completed",
          "concluido",
          "no_show",
        ];
        if (blockRescheduleStatuses.includes(data.status)) {
          throw {
            status: 400,
            message:
              "Esta reserva possui um status que não permite remarcação.",
          };
        }

        debugStep = "PRO_LOOKUP";
        // Need professional and service to validate availability
        const proRef = db.collection("users").doc(data.professionalId);
        const proSnap = await transaction.get(proRef);
        if (!proSnap.exists)
          throw { status: 404, message: "Profissional não encontrado." };
        const proData = proSnap.data() as any;

        // Use frozen duration from current appointment
        const duration = Number(data.duration);
        if (isNaN(duration) || duration <= 0) {
          throw { status: 400, message: "Duração inválida na reserva." }; // Remarcação preserva a duração original congelada da reserva
        }

        const apptDayOfWeek = new Date(safeNewDate + "T12:00:00").getDay();
        const apptStartMin = timeToMinutes(safeNewTime);
        const apptEndMin = apptStartMin + duration;

        debugStep = "WORKING_HOURS";
        // Validate working hours / days
        if (proData.workingHours) {
          if (
            Array.isArray(proData.workingHours.workingDays) &&
            proData.workingHours.workingDays.length > 0
          ) {
            if (!proData.workingHours.workingDays.includes(apptDayOfWeek)) {
              throw {
                status: 400,
                message: "Horário indisponível. Escolha outro horário.",
              };
            }
          }

          if (proData.workingHours.startTime && proData.workingHours.endTime) {
            const whStart = timeToMinutes(proData.workingHours.startTime);
            const whEnd = timeToMinutes(proData.workingHours.endTime);
            if (apptStartMin < whStart || apptEndMin > whEnd) {
              throw {
                status: 400,
                message: "Horário indisponível. Escolha outro horário.",
              };
            }
          }
        }

        debugStep = "BLOCKED_SCHEDULES";
        // Check blocked schedules
        const blockedQ = db
          .collection("blocked_schedules")
          .where("professionalId", "==", data.professionalId);
        const blockedSnap = await transaction.get(blockedQ);

        for (const bDoc of blockedSnap.docs) {
          const b = bDoc.data();
          const isFixed = b.date === safeNewDate;
          const isRecurring =
            b.isRecurring &&
            Array.isArray(b.recurringDays) &&
            b.recurringDays.includes(apptDayOfWeek);

          if (isFixed || isRecurring) {
            if (b.type === "full_day" || b.allDay) {
              throw {
                status: 400,
                message: "Horário indisponível. Escolha outro horário.",
              };
            }
            if (b.startTime && b.endTime) {
              const bStart = timeToMinutes(b.startTime);
              const bEnd = timeToMinutes(b.endTime);
              if (intervalsOverlap(apptStartMin, apptEndMin, bStart, bEnd)) {
                throw {
                  status: 400,
                  message: "Horário indisponível. Escolha outro horário.",
                };
              }
            }
          }
        }

        debugStep = "OVERLAPPING_APPTS";
        // Check overlapping appointments
        const existingApptsSnap = await transaction.get(
          db
            .collection("appointments")
            .where("professionalId", "==", data.professionalId)
            .where("date", "==", safeNewDate),
        );

        const overlapBlockingStatuses = [
          "pending",
          "pending_confirmation",
          "pending_conflict",
          "confirmed",
          "accepted",
          "completed",
          "concluido",
        ];

        for (const doc of existingApptsSnap.docs) {
          if (doc.id === appointmentId) continue; // ignore self
          const existing = doc.data();
          if (overlapBlockingStatuses.includes(existing.status)) {
            const existingStart = timeToMinutes(existing.time);
            const existingDuration = Number(
              existing.duration || existing.serviceDuration || 60,
            );
            const existingEnd = existingStart + existingDuration;

            if (
              intervalsOverlap(
                apptStartMin,
                apptEndMin,
                existingStart,
                existingEnd,
              )
            ) {
              // Also check lock expiry logic for pending items to be fully safe, similar to creation
              if (
                ["pending", "pending_confirmation"].includes(existing.status)
              ) {
                const existingLockId = getBookingLockId(existing);
                if (existingLockId) {
                  const existingLockSnap = await transaction.get(
                    db.collection("booking_locks").doc(existingLockId),
                  );
                  if (existingLockSnap.exists) {
                    const eld = existingLockSnap.data();
                    if (
                      eld?.expiresAt &&
                      ((typeof eld.expiresAt.toMillis === "function" &&
                        eld.expiresAt.toMillis() <= Date.now()) ||
                        new Date(eld.expiresAt).getTime() <= Date.now())
                    ) {
                      continue; // expired lock, ignores overlap
                    }
                  } else {
                    continue; // pending without lock
                  }
                }
              }
              throw {
                status: 400,
                message:
                  "Este horário acabou de ser preenchido. Escolha outro.",
              };
            }
          }
        }

        debugStep = "SUMMARY_LOOKUP";
        // Client summary read
        const summaryRef = db
          .collection("client_summaries")
          .doc(
            `${data.professionalId}_${getClientKey(data.clientWhatsapp, data.clientEmail, data.clientName)}`,
          );
        const summarySnap = await transaction.get(summaryRef);

        debugStep = "OLD_LOCK";
        // Old lock
        let oldLockRef: admin.firestore.DocumentReference | null = null;
        let oldLockSnap: admin.firestore.DocumentSnapshot | null = null;
        const oldLockId = getBookingLockId(data);
        if (oldLockId) {
          oldLockRef = db.collection("booking_locks").doc(oldLockId);
          oldLockSnap = await transaction.get(oldLockRef);
        }

        debugStep = "NEW_LOCK";
        // New lock
        const simulatedNewData = {
          ...data,
          date: safeNewDate,
          time: safeNewTime,
        };
        const newLockId = getBookingLockId(simulatedNewData);

        let newLockRef: admin.firestore.DocumentReference | null = null;
        if (newLockId) {
          newLockRef = db.collection("booking_locks").doc(newLockId);
          const newLockSnap = await transaction.get(newLockRef);
          if (
            newLockSnap.exists &&
            overlapBlockingStatuses.includes(newLockSnap.data()?.status)
          ) {
            if (newLockSnap.data()?.appointmentId !== appointmentId) {
              throw {
                status: 400,
                message:
                  "Este horário acabou de ser preenchido. Escolha outro.",
              };
            }
          }
        }

        debugStep = "APPLY_WRITES";
        // Apply Writes (after all reads are done)
        if (oldLockRef && oldLockId !== newLockId) {
          // Only delete if the lock changed
          if (
            oldLockSnap &&
            oldLockSnap.exists &&
            oldLockSnap.data()?.appointmentId === appointmentId
          ) {
            transaction.delete(oldLockRef);
          }
        }

        if (newLockRef && overlapBlockingStatuses.includes(data.status)) {
          transaction.set(newLockRef, {
            professionalId: data.professionalId,
            date: safeNewDate,
            time: safeNewTime,
            appointmentId: appointmentId,
            serviceId: data.serviceId || "unknown",
            status: data.status, // preserve existing status
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        const updatePayload: any = {
          date: safeNewDate,
          time: safeNewTime,
          previousDate: data.date,
          previousTime: data.time,
          rescheduledAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastChangeBy: "client",
          changeMessage: `Cliente reagendou de ${data.date.split("-").reverse().join("/")} para ${safeNewDate.split("-").reverse().join("/")}`,
          timeline: admin.firestore.FieldValue.arrayUnion({
            type: "booking_rescheduled_client",
            createdAt: new Date().toISOString(),
            actor: "client",
            label: `Cliente reagendou de ${data.date.split("-").reverse().join("/")} para ${safeNewDate.split("-").reverse().join("/")}`,
          }),
        };

        const safeUpdate = sanitizeAppointment(updatePayload, true);
        transaction.update(apptRef, safeUpdate);

        debugStep = "CLIENT_SUMMARY_UPDATE";
        const updatedData = { ...data, ...safeUpdate, id: appointmentId };
        await updateClientSummaryInternal(
          transaction,
          updatedData,
          data.professionalId,
          false,
          data.status,
          summarySnap,
        );

        debugStep = "TRANSACTION_SUCCESS";
        return { success: true, updatedData };
      });

      // Notify asynchronously setup
      const { updatedData } = result;

      if (updatedData) {
        // 1. Send the email directly and await before returning success
        await sendClientRescheduleProfessionalEmailFailSoft(
          updatedData.id,
          updatedData.previousDate,
          updatedData.previousTime,
          updatedData,
        );

        // 2. Call the background actions (Waitlist, Calendar, Notification events) without awaiting for performance
        postRescheduleActions(
          updatedData.id,
          updatedData.previousDate,
          updatedData.previousTime,
          updatedData,
          "client",
        );
      }

      return res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      const message = err.message || "Erro interno do servidor";
      logger.error(
        "BOOKING",
        `Reschedule by client error. Step: ${debugStep}`,
        { error: err.message, stack: err.stack, code: err.code },
      );
      return res
        .status(status)
        .json({ error: message, code: err.code, step: debugStep });
    }
  },
);

// Helper that executes fail-soft for professional email when client reschedules
async function sendClientRescheduleProfessionalEmailFailSoft(
  appointmentId: string,
  previousDate: string,
  previousTime: string,
  updatedData: any,
): Promise<void> {
  const eventKey = `bookingRescheduledPro_${updatedData.date}_${updatedData.time}`;
  try {
    const db = getDb();
    logger.info(
      "EMAIL",
      `[RESCHEDULE_PRO_EMAIL_START] appointmentId: ${appointmentId}`,
    );

    const proDoc = await db
      .collection("users")
      .doc(updatedData.professionalId)
      .get();
    if (!proDoc.exists || !proDoc.data()?.email) {
      logger.info(
        "EMAIL",
        `[RESCHEDULE_PRO_EMAIL_FAILED] professional missing email. appointmentId: ${appointmentId}`,
      );
      return;
    }

    const proData = proDoc.data();

    if (!(await shouldSendEmail(appointmentId, eventKey))) {
      logger.info(
        "EMAIL",
        `[RESCHEDULE_PRO_EMAIL_SKIPPED_DUPLICATE] eventKey: ${eventKey}`,
      );
      return;
    }

    const formatToBRDate = (d: string) => {
      if (!d) return d;
      const [y, m, day] = d.split("-");
      if (y && m && day) return `${day}/${m}/${y}`;
      return d;
    };

    const emailResult = await sendProfessionalBookingRescheduledEmail({
      professionalEmail: proData!.email,
      professionalName: proData!.name || "Profissional",
      clientName: updatedData.clientName,
      serviceName: updatedData.serviceName,
      oldFormatDate: formatToBRDate(previousDate),
      oldTime: previousTime,
      newFormatDate: formatToBRDate(updatedData.date),
      newTime: updatedData.time,
      agendaUrl: `${PUBLIC_APP_URL}/dashboard`,
    });

    if (emailResult && emailResult.success) {
      await markEmailSent(appointmentId, eventKey);
      logger.info(
        "EMAIL",
        `[RESCHEDULE_PRO_EMAIL_SUCCESS] eventKey: ${eventKey}`,
      );
      return;
    } else {
      logger.error(
        "EMAIL",
        `[RESCHEDULE_PRO_EMAIL_FAILED] eventKey: ${eventKey}. Error: ${emailResult?.error || "Unknown error"}`,
      );
      return;
    }
  } catch (err: any) {
    logger.error(
      "EMAIL",
      `[RESCHEDULE_PRO_EMAIL_FAILED] Exception logic. appointmentId: ${appointmentId}, error: ${err.message}`,
    );
    return;
  }
}

// Helper for background notifications/waitlist after reschedule
async function postRescheduleActions(
  appointmentId: string,
  previousDate: string,
  previousTime: string,
  updatedData: any,
  actor: "client" | "professional",
) {
  const db = getDb();
  try {
    const notifyPayload = {
      id: appointmentId,
      appointmentId,
      ...updatedData,
      previousDate,
      previousTime,
      rescheduledBy: actor,
    };

    if (actor !== "client") {
      await fetch(`${PUBLIC_APP_URL}/api/notifications/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "BOOKING_RESCHEDULED_BY_PROFESSIONAL",
          payload: notifyPayload,
        }),
      }).catch((e) =>
        logger.error("BOOKING", "Failed to send notification via /notify", e),
      );
    }

    if (
      updatedData.status === "confirmed" ||
      updatedData.status === "completed"
    ) {
      try {
        if (updateGoogleCalendarEvent) {
          await updateGoogleCalendarEvent(
            updatedData,
            updatedData.professionalId,
          );
        }
      } catch (e: any) {
        logger.error(
          "CALENDAR",
          `Error evaluating calendar sync for rescheduled appt: ${e.message}`,
        );
      }
    }

    try {
      await triggerWaitlistCheckBackend(
        db,
        updatedData.professionalId,
        previousDate,
        previousTime,
      );
    } catch (e: any) {
      logger.error("WAITLIST", `Error triggering waitlist check: ${e.message}`);
    }
  } catch (err) {
    logger.error("BOOKING", "Error in postRescheduleActions", { error: err });
  }
}

async function triggerWaitlistCheckBackend(
  db: admin.firestore.Firestore,
  professionalId: string,
  date: string,
  time: string,
) {
  const proRef = db.collection("users").doc(professionalId);
  const proSnap = await proRef.get();
  if (!proSnap.exists) return;
  const proSettings = proSnap.data() as any;

  const hasWaitlistFeature =
    proSettings.plan === "pro" && proSettings.features?.waitlist !== false;
  if (!hasWaitlistFeature) {
    logger.info(
      "WAITLIST",
      `Profissional ${professionalId} sem recurso PRO ativo. Processamento da lista de espera ignorado.`,
    );
    return;
  }

  const waitlistSnap = await db
    .collection("waitlist")
    .where("professionalId", "==", professionalId)
    .where("requestedDate", "==", date)
    .where("status", "==", "waiting")
    .orderBy("createdAt", "asc")
    .limit(20)
    .get();

  if (waitlistSnap.empty) return;

  const hour = parseInt(time.split(":")[0]);
  const slotPeriod = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "night";

  const eligibleDoc = waitlistSnap.docs.find((doc) => {
    const d = doc.data();
    return (
      d.period === "any" || d.period === slotPeriod || d.preferredTime === time
    );
  });

  if (eligibleDoc) {
    const entryId = eligibleDoc.id;
    const entryData = eligibleDoc.data();

    if (proSettings.waitlistMode === "auto") {
      const expiresAt = new Date(Date.now() + 15 * 60000);

      const inviteSuccess = await db.runTransaction(async (t) => {
        const ref = db.collection("waitlist").doc(entryId);
        const snap = await t.get(ref);
        if (snap.data()?.status !== "waiting") return false;

        const cleanTime = time.replace(":", "");
        const lockId = `${professionalId}_${date}_${cleanTime}`;
        const lockRef = db.collection("booking_locks").doc(lockId);

        t.update(ref, {
          status: "invited",
          invitationSentAt: admin.firestore.FieldValue.serverTimestamp(),
          invitationExpiresAt: expiresAt.toISOString(),
          assignedTime: time,
        });

        t.set(lockRef, {
          professionalId,
          date,
          time,
          waitlistEntryId: entryId,
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          status: "waitlist_lock"
        });

        return true;
      });

      if (!inviteSuccess) return;

      await fetch(`${PUBLIC_APP_URL}/api/notifications/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "WAITLIST_INVITATION",
          payload: {
            id: entryId,
            ...entryData,
            assignedTime: time,
            expiresAt: expiresAt.toISOString(),
            professionalName: proSettings.name,
            professionalSlug: proSettings.slug || "",
          },
        }),
      }).catch((e) =>
        logger.error("WAITLIST", "Waitlist Invitation Error", { error: e }),
      );
    } else {
      const notifySuccess = await db.runTransaction(async (t) => {
        const ref = db.collection("waitlist").doc(entryId);
        const snap = await t.get(ref);
        const data = snap.data();
        if (data?.status !== "waiting") return false;

        const notifiedMap = data?.slotNotifiedAt || {};
        const slotKey = `${date}_${time}`;
        if (notifiedMap[slotKey]) return false;

        notifiedMap[slotKey] = new Date().toISOString();
        t.update(ref, { slotNotifiedAt: notifiedMap });
        return true;
      });

      if (!notifySuccess) return;

      await fetch(`${PUBLIC_APP_URL}/api/notifications/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "WAITLIST_SLOT_OPENED",
          payload: {
            professionalId,
            date,
            time,
            candidateName: entryData.clientName,
            candidateId: entryId,
          },
        }),
      }).catch((e) =>
        logger.error("WAITLIST", "Waitlist Notify Error", { error: e }),
      );
    }
  }
}

// --- NEW: REVIEW MODERATION ROUTES ---
router.get(
  "/reviews/pending",
  requireFirebaseAuth,
  async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDb();
    const uid = req.uid;

    try {
      const q = db
        .collection("reviews")
        .where("professionalId", "==", uid)
        .where("moderationStatus", "==", "pending");

      const snapshot = await q.get();

      const fetched = snapshot.docs.map((doc) => {
        const data = doc.data();
        const isPrivate = data.publicDisplayMode === "private";
        const isAnonymous = data.publicDisplayMode === "anonymous";

        let safeFirstName = data.firstName;
        if (isPrivate) safeFirstName = "Cliente Privada";
        else if (isAnonymous) safeFirstName = "Cliente Anônima";

        const payload: any = {
          id: doc.id,
          ...data,
          firstName: safeFirstName,
        };

        if (isPrivate || isAnonymous) {
          delete payload.clientName;
          delete payload.neighborhood;
          delete payload.locationLabel;
          delete payload.avatar;
          delete payload.photo;
          delete payload.email;
          delete payload.phone;
        }

        if (payload.createdAt && payload.createdAt.toDate) {
          payload.createdAt = payload.createdAt.toDate().toISOString();
        }

        return payload;
      });

      res.json(fetched);
    } catch (err: any) {
      console.error("Error fetching pending reviews:", err);
      res.status(500).json({ error: "Erro ao buscar avaliações pendentes." });
    }
  },
);

router.post(
  "/reviews/:reviewId/approve",
  requireFirebaseAuth,
  async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDb();
    const { reviewId } = req.params;
    const uid = req.uid;

    try {
      const result = await db.runTransaction(async (transaction) => {
        // 1. ALL READS
        const reviewRef = db.collection("reviews").doc(reviewId);
        const reviewSnap = await transaction.get(reviewRef);

        if (!reviewSnap.exists) {
          throw { status: 404, message: "Avaliação não encontrada." };
        }

        const reviewData = reviewSnap.data() as any;

        if (reviewData.professionalId !== uid) {
          throw {
            status: 403,
            message: "Sem permissão para aprovar esta avaliação.",
          };
        }

        if (
          reviewData.publicApproved ||
          reviewData.moderationStatus === "approved"
        ) {
          throw { status: 400, message: "Avaliação já foi aprovada." };
        }

        const statsRef = db.collection("review_stats").doc(uid as string);
        const statsSnap = await transaction.get(statsRef);

        // 2. CALCULATIONS
        const rating = Number(reviewData.rating) || 5;
        const tags = Array.isArray(reviewData.tags) ? reviewData.tags : [];

        let newAverageRating = rating;
        let newTotalReviews = 1;
        let newTagAnalytics: Record<string, number> = {};

        tags.forEach((t: string) => {
          newTagAnalytics[t] = 1;
        });

        if (statsSnap.exists) {
          const currentStats = statsSnap.data()!;
          newTotalReviews = (currentStats.totalReviews || 0) + 1;
          newAverageRating =
            ((currentStats.averageRating || 0) *
              (currentStats.totalReviews || 0) +
              rating) /
            newTotalReviews;

          const existingTagAnalytics = currentStats.tagAnalytics || {};
          newTagAnalytics = { ...existingTagAnalytics };

          tags.forEach((tag: string) => {
            newTagAnalytics[tag] = (newTagAnalytics[tag] || 0) + 1;
          });
        }

        const newTopTags = Object.keys(newTagAnalytics)
          .sort((a, b) => newTagAnalytics[b] - newTagAnalytics[a])
          .slice(0, 5);

        // 3. ALL WRITES

        // Update review
        transaction.update(reviewRef, {
          publicApproved: true,
          moderationStatus: "approved",
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update review_stats
        if (statsSnap.exists) {
          transaction.update(statsRef, {
            averageRating: Number(newAverageRating.toFixed(1)),
            totalReviews: newTotalReviews,
            topTags: newTopTags,
            tagAnalytics: newTagAnalytics,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          transaction.set(statsRef, {
            professionalId: uid,
            averageRating: rating,
            totalReviews: 1,
            totalCompletedBookings: 1,
            topTags: newTopTags,
            tagAnalytics: newTagAnalytics,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // Sync to user profile
        const userRef = db.collection("users").doc(uid as string);
        transaction.update(userRef, {
          averageRating: Number(newAverageRating.toFixed(1)),
          totalReviews: newTotalReviews,
          topTags: newTopTags,
        });

        // 4. Milestone Check
        let milestoneConfig: any = null;
        let oldAvg = statsSnap.exists ? statsSnap.data()!.averageRating : 0;
        if (
          newTotalReviews === 5 ||
          newTotalReviews === 10 ||
          newTotalReviews === 25 ||
          (newTotalReviews >= 5 && newAverageRating === 5.0 && oldAvg < 5.0)
        ) {
          let title = "";
          let message = "";
          if (newTotalReviews === 5) {
            title = "5 Avaliações Alcançadas";
            message =
              "Você conquistou suas primeiras 5 avaliações na vitrine Nera. Isso representa muita confiança do seu público!";
          } else if (newTotalReviews === 10) {
            title = "10 Avaliações! 🌟";
            message =
              "O selo de aprovação das suas clientes está cada vez mais forte.";
          } else if (newTotalReviews === 25) {
            title = "25 Avaliações! 🚀";
            message =
              "Um marco impressionante. Seu perfil agora é uma referência sólida de qualidade.";
          } else if (newAverageRating === 5.0) {
            title = "Média 5 Estrelas Perfeita";
            message =
              "Com mais de 5 avaliações, você atingiu a excelência máxima de nota das clientes.";
          }
          milestoneConfig = { title, message };
        }

        return { success: true, milestoneConfig };
      });

      res.json(result);

      // Async push notification for milestone
      if (
        result.success &&
        result.milestoneConfig &&
        result.milestoneConfig.title
      ) {
        db.collection("users")
          .doc(uid as string)
          .get()
          .then((proDoc) => {
            const proData = proDoc.data();
            if (proData && proData.email) {
              const { PUBLIC_APP_URL } = require("../utils.js");
              import("../emails/sendEmail.js")
                .then(({ sendReviewMilestoneEmail }) => {
                  sendReviewMilestoneEmail({
                    professionalEmail: proData.email,
                    professionalName: proData.name || "Profissional",
                    milestoneTitle: result.milestoneConfig.title,
                    milestoneMessage: result.milestoneConfig.message,
                    profileUrl: `${PUBLIC_APP_URL}/${proData.slug || ""}`,
                  });
                })
                .catch((e) =>
                  logger.error("REVIEW", "Error sending milestone email", {
                    error: e,
                  }),
                );
            }
          })
          .catch((e) =>
            logger.error("REVIEW", "Error fetching pro for milestone", {
              error: e,
            }),
          );
      }
    } catch (err: any) {
      logger.error("REVIEW", "Approve review error", { error: err });
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Erro interno" });
    }
  },
);

router.post(
  "/reviews/:reviewId/reject",
  requireFirebaseAuth,
  async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDb();
    const { reviewId } = req.params;
    const uid = req.uid;

    try {
      const result = await db.runTransaction(async (transaction) => {
        const reviewRef = db.collection("reviews").doc(reviewId);
        const reviewSnap = await transaction.get(reviewRef);

        if (!reviewSnap.exists) {
          throw { status: 404, message: "Avaliação não encontrada." };
        }

        const reviewData = reviewSnap.data() as any;

        if (reviewData.professionalId !== uid) {
          throw {
            status: 403,
            message: "Sem permissão para rejeitar esta avaliação.",
          };
        }

        transaction.update(reviewRef, {
          publicApproved: false,
          moderationStatus: "rejected",
          rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true };
      });

      res.json(result);
    } catch (err: any) {
      logger.error("REVIEW", "Reject review error", { error: err });
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Erro interno" });
    }
  },
);

router.get(
  "/cron/waitlist-sweeper",
  requireCronSecret,
  async (req: express.Request, res: express.Response) => {
    const db = getDb();
    try {
      logger.info("CRON", "Starting waitlist sweeper");
      const querySnap = await db
        .collection("waitlist")
        .where("status", "==", "invited")
        .where("invitationExpiresAt", "<", new Date().toISOString())
        .limit(50)
        .get();

      if (querySnap.empty) {
        logger.info("WAITLIST", "[WAITLIST_QUEUE_EMPTY] No expired invites found.");
        return res.json({ success: true, processed: 0 });
      }

      let processedCount = 0;

      for (const doc of querySnap.docs) {
        const entryId = doc.id;
        const data = doc.data() as any;

        const success = await db.runTransaction(async (t) => {
          const ref = db.collection("waitlist").doc(entryId);
          const snap = await t.get(ref);
          if (snap.data()?.status !== "invited") return false;

          // Mark as expired
          t.update(ref, {
            status: "expired"
          });

          // Look for lock
          if (data.assignedTime) {
            const cleanTime = data.assignedTime.replace(":", "");
            const lockId = `${data.professionalId}_${data.requestedDate}_${cleanTime}`;
            const lockRef = db.collection("booking_locks").doc(lockId);
            const lockSnap = await t.get(lockRef);
            if (lockSnap.exists && lockSnap.data()?.waitlistEntryId === entryId) {
              t.delete(lockRef);
              logger.info("WAITLIST", `[WAITLIST_LOCK_RELEASED] Lock released for expired waitlist invite ${entryId}`);
            }
          }
          return true;
        });

        if (success) {
          processedCount++;
          logger.info("WAITLIST", `[WAITLIST_INVITE_EXPIRED] Waitlist invite expired for entry ${entryId}`);
          logger.info("WAITLIST", "[WAITLIST_NEXT_INVITED] Triggering check for next person in line.");
          
          if (data.assignedTime) {
            triggerWaitlistCheckBackend(
              db,
              data.professionalId,
              data.requestedDate,
              data.assignedTime
            ).catch(e => logger.error("WAITLIST", "Error checking next person", { error: e }));
          }
        }
      }

      res.json({ success: true, processed: processedCount });
    } catch (err: any) {
      logger.error("CRON", "Waitlist sweeper error", { error: err });
      res.status(500).json({ error: String(err) });
    }
  }
);

export default router;
