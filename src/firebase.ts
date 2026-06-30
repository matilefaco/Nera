import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore, doc, updateDoc, collection, addDoc, serverTimestamp, runTransaction, getDoc, setDoc, deleteDoc, query, where, getDocs, arrayUnion, arrayRemove, orderBy, onSnapshot, limit, increment } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString } from 'firebase/storage';
import { UserProfile, Appointment, PortfolioItem, WaitlistEntry } from './types';
import { removeUndefinedDeep, parseFirestoreDate, isDataUriImage } from './lib/utils';
import { notify as appNotify } from './lib/notify';
import { APPOINTMENT_STATUS, normalizeAppointmentStatus, AppointmentStatus } from './constants/appointmentStatus';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDO2OcFecgXEfATajxcY0piPP8VfCoQGWU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ai-studio-applet-webapp-bb725.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-applet-webapp-bb725",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ai-studio-applet-webapp-bb725.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "768951224787",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:768951224787:web:9165a57c367a649f1e8726",
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth BEFORE anything else
export const auth = (() => {
  try {
    return getAuth(app);
  } catch {
    return initializeAuth(app, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  }
})();

export const db = getFirestore(app);
export const storage = getStorage(app);

const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname.includes('ais-'));
const devLog = (...args: any[]) => isDev && console.log(...args);

export async function notify(type: string, payload: any) {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (tokenError) {
      if (isDev) console.warn('[notify] Falha ao obter Firebase ID token', tokenError);
    }

    const res = await fetch('/api/notify', {
      method: 'POST',
      headers,
      body: JSON.stringify({ type, payload })
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[notify] API failed with status ${res.status}:`, errText);
        throw new Error(`Notification failed with status: ${res.status}. Body: ${errText}`);
    }
    const jsonRes = await res.json();
    console.log(`[notify] Success for type ${type}:`, jsonRes);
    return jsonRes;
  } catch (error) {
    if (isDev) console.error(`[NOTIFY ERROR] Failed to send ${type}:`, error);
    throw error;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL,
      })) || []
    },
    operationType,
    path
  };
  if (isDev) console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const sanitizeAppointment = (data: any, isUpdate = false): any => {
  if (!data) return {};
  const sanitized = { ...data };

  // 1. Trim strings if present
  Object.keys(sanitized).forEach((key) => {
    if (typeof sanitized[key] === "string") {
      sanitized[key] = sanitized[key].trim();
    }
  });

  // 2. Validate/Normalize Client Name
  if (!isUpdate || sanitized.clientName !== undefined) {
    sanitized.clientName =
      typeof sanitized.clientName === "string" && sanitized.clientName !== ""
        ? sanitized.clientName
        : "Cliente";
  }

  // 3. Normalize Price
  if (!isUpdate || sanitized.price !== undefined) {
    sanitized.price = sanitized.price !== undefined && sanitized.price !== null ? Number(sanitized.price) : 0;
    if (isNaN(sanitized.price)) sanitized.price = 0;
  }

  // 4. Normalize Status
  if (!isUpdate || sanitized.status !== undefined) {
    sanitized.status = normalizeAppointmentStatus(sanitized.status);
  }

  // 5. Require professionalId on create
  if (!isUpdate && !sanitized.professionalId) {
    throw new Error("professionalId é obrigatório");
  }

  // 6. Set timestamp if missing on create
  if (!isUpdate && !sanitized.createdAt) {
    sanitized.createdAt = serverTimestamp();
  }

  // 7. Define mandatory keys that should not be deleted on create
  const mandatoryFields = [
    "professionalId",
    "date",
    "time",
    "serviceId",
    "serviceName",
    "clientName",
    "status",
    "createdAt"
  ];

  // 8. Clean null, undefined and empty fields properly
  Object.keys(sanitized).forEach((key) => {
    const value = sanitized[key];

    // Always remove undefined
    if (value === undefined) {
      delete sanitized[key];
      return;
    }

    const isMandatory = mandatoryFields.includes(key);

    if (!isMandatory) {
      // Remove null and empty optional fields (but preserve false and 0)
      if (value === null || value === "") {
        delete sanitized[key];
        return;
      }
    } else {
      // For mandatory fields on creation, ensure they are not null or empty
      if (!isUpdate) {
        if (value === null || value === "") {
          throw new Error(`O campo obrigatório '${key}' não pode ser nulo ou vazio.`);
        }
      }
    }
  });

  return sanitized;
};

export async function uploadImageToStorage(file: File, path: string): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('Usuário não autenticado');
  }

  // 1. Validate MIME Type
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error(`Tipo de arquivo não permitido (${file.type || 'desconhecido'}). Apenas JPEG, PNG e WebP são aceitos.`);
  }

  // 2. Validate Size based on destination path/type
  let maxSize = 5 * 1024 * 1024; // Default 5 MB for portfolio and others
  let typeLabel = 'portfólio';
  if (path.startsWith('avatars/') || path.includes('avatar')) {
    maxSize = 2 * 1024 * 1024; // 2 MB for avatar
    typeLabel = 'avatar';
  }

  if (file.size > maxSize) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    const limitInMB = maxSize === 2 * 1024 * 1024 ? '2' : '5';
    throw new Error(`O arquivo de ${typeLabel} é muito grande (${sizeInMB} MB). O limite máximo permitido é de ${limitInMB} MB.`);
  }

  // Convert File to Base64 to bypass iOS Safari File/Blob issues in iFrames
  const base64DataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });

  const { uploadString, getDownloadURL, ref } = await import('firebase/storage');
  const storageRef = ref(storage, path);
  
  await uploadString(storageRef, base64DataUrl, 'data_url');
  const publicUrl = await getDownloadURL(storageRef);
  
  return publicUrl;
}

export async function saveProfilePartial(uid: string, data: Partial<UserProfile>) {
  const userRef = doc(db, 'users', uid);
  const sanitized = removeUndefinedDeep(data);
  
  // SANITIZE images
  if (sanitized.avatar && isDataUriImage(sanitized.avatar)) delete sanitized.avatar;
  if (sanitized.photoUrl && isDataUriImage(sanitized.photoUrl)) delete sanitized.photoUrl;
  if (sanitized.coverImage && isDataUriImage(sanitized.coverImage)) delete sanitized.coverImage;
  if (sanitized.portfolio && Array.isArray(sanitized.portfolio)) {
    sanitized.portfolio = sanitized.portfolio.filter((item: any) => item && item.url && !isDataUriImage(item.url));
  }

  await updateDoc(userRef, {
    ...sanitized,
    updatedAt: serverTimestamp()
  });
}

export async function savePortfolioItem(uid: string, itemData: any): Promise<string> {
  const colRef = collection(db, `users/${uid}/portfolio`);
  const safePayload = removeUndefinedDeep(itemData);
  const docRef = await addDoc(colRef, {
    ...safePayload,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function deletePortfolioItem(uid: string, item: PortfolioItem): Promise<void> {
  const docRef = doc(db, `users/${uid}/portfolio`, item.id);
  await deleteDoc(docRef);
  // Also optionally delete from storage if needed, but not required if it's external or we just leave it.
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data() as UserProfile : null;
}

export async function updateBusinessHours(uid: string, businessHours: any) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { businessHours });
}

export function getClientKey(whatsapp: string, email: string, name: string) {
  // Simplistic key gen
  if (whatsapp) return whatsapp.replace(/\D/g, '');
  if (email) return email.toLowerCase().trim();
  return name.toLowerCase().trim().replace(/\s+/g, '_');
}

export async function updateClientSummaryInternal(transaction: any, appointment: Appointment, professionalId: string, isCreate: boolean = false, oldStatus: string = '', existingSnap?: any) {
  const clientKey = getClientKey(
    appointment.clientWhatsapp || '',
    appointment.clientEmail || '',
    appointment.clientName || 'Cliente'
  );
  
  if (!clientKey) return;
  
  const summaryId = `${professionalId}_${clientKey}`;
  const summaryRef = doc(db, 'client_summaries', summaryId);
  const summarySnap = existingSnap || await transaction.get(summaryRef);
  
  let summaryData;
  if (!summarySnap.exists()) {
    summaryData = {
      professionalId,
      clientKey,
      clientName: appointment.clientName || 'Cliente',
      clientPhone: appointment.clientWhatsapp || '',
      clientEmail: appointment.clientEmail || '',
      appointmentsCount: 0,
      totalSpent: 0,
      lastAppointmentDate: appointment.date,
      lastAppointmentId: appointment.id,
      lifetimeValue: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
  } else {
    summaryData = summarySnap.data();
    summaryData.professionalId = professionalId; // Fix: ensure professionalId is always present for Firestore rules
    if (appointment.clientName && summaryData.clientName === 'Cliente') {
      summaryData.clientName = appointment.clientName;
    }
  }

  // Update logic for new confirmed/accepted appointments
  if (isCreate || (oldStatus !== 'confirmed' && oldStatus !== 'accepted' && (appointment.status === 'confirmed' || appointment.status === 'accepted'))) {
      summaryData.appointmentsCount = (summaryData.appointmentsCount || 0) + 1;
      const amount = appointment.totalPrice ?? appointment.price ?? 0;
      summaryData.totalSpent = (summaryData.totalSpent || 0) + Number(amount);
      summaryData.lifetimeValue = summaryData.totalSpent;
      
      const newDateStr = appointment.date;
      if (!summaryData.lastAppointmentDate || newDateStr > summaryData.lastAppointmentDate) {
        summaryData.lastAppointmentDate = newDateStr;
        summaryData.lastAppointmentId = appointment.id;
      }
  }
  
  summaryData.updatedAt = serverTimestamp();
  
  if (summaryData.clientName && typeof summaryData.clientName === 'string') {
    summaryData.searchTokens = generateSearchTokens(summaryData.clientName);
  }
  
  // Clean undefined values shallowly to preserve FieldValue like serverTimestamp()
  Object.keys(summaryData).forEach(key => {
    if (summaryData[key] === undefined) {
      delete summaryData[key];
    }
  });

  if (summarySnap.exists()) {
    transaction.update(summaryRef, summaryData);
  } else {
    transaction.set(summaryRef, summaryData);
  }
}

// Add this helper function somewhere above or outside
function generateSearchTokens(name: string): string[] {
  const tokens: string[] = [];
  if (!name) return tokens;
  
  const cleanName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = cleanName.split(/\s+/).filter(w => w.length > 0);
  
  for (const word of words) {
    if (word.length >= 2) {
      tokens.push(word.substring(0, 2));
      if (word.length >= 3) tokens.push(word.substring(0, 3));
      tokens.push(word);
    }
  }
  
  return Array.from(new Set(tokens));
}

export async function updateClientSummaryFromAppointment(appointment: Appointment) {
  // devLog stub called
}

export async function createBookingRequest(appointmentData: Partial<Appointment>) {
  if (!appointmentData.professionalId || !appointmentData.date || !appointmentData.time) {
    throw new Error('Dados de agendamento incompletos');
  }

  // Force local API call
  const response = await fetch(`/api/public/create-booking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(appointmentData)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || 'Erro ao criar pedido.');
    (error as any).code = data.code;
    throw error;
  }
  
  const result = await response.json();
  return result;
}

export async function updateUserProfile(uid: string, profileData: Partial<UserProfile>) {
  const userRef = doc(db, 'users', uid);
  const sanitized = removeUndefinedDeep(profileData);

  // SANITIZE images
  if (sanitized.avatar && isDataUriImage(sanitized.avatar)) delete sanitized.avatar;
  if (sanitized.photoUrl && isDataUriImage(sanitized.photoUrl)) delete sanitized.photoUrl;
  if (sanitized.coverImage && isDataUriImage(sanitized.coverImage)) delete sanitized.coverImage;
  if (sanitized.portfolio && Array.isArray(sanitized.portfolio)) {
    sanitized.portfolio = sanitized.portfolio.filter((item: any) => item && item.url && !isDataUriImage(item.url));
  }

  await updateDoc(userRef, { ...sanitized, updatedAt: serverTimestamp() });
}

export async function createUserProfile(uid: string, profileData: Partial<UserProfile>) {
  const userRef = doc(db, 'users', uid);
  const sanitized = removeUndefinedDeep(profileData);
  await setDoc(userRef, { ...sanitized, uid, createdAt: serverTimestamp() });
}

export async function updateBlockedSchedules(uid: string, date: string, time: string, isBlocked: boolean) {
  // Stub or actual implementation depending on if we need it
}

export async function createBlockedSchedule(professionalId: string, date: string, time: string, reason: string) {
  // Stub
}

export async function deleteBlockedScheduleAtomic(professionalId: string, blockId: string) {
  // Stub
}

export async function checkAndExpireAppointments(professionalId: string) {
  // Stub or actual implementation. Used for checking expired stuff.
  // The backend cron could be doing this, but if the client still calls it:
}

export function handleBookingError(error: unknown) {
  let message = 'Ocorreu um erro ao processar o agendamento.';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }
  appNotify.error(message);
  if (isDev) console.error('[Booking Error]', error);
}

/**
 * Standardized function to update appointment status with transition validation.
 * Manages the logic for freeing slots and notifications.
 */
export async function updateAppointmentStatus(appointmentId: string, newStatus: Appointment['status']) {
  devLog(`[Status] Transitioning ${appointmentId} to ${newStatus}...`);
  
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Você precisa estar logado para realizar esta ação.');
  }

  // ATOMIC FLOWS (now moved to backend)
  if (newStatus === 'confirmed' || newStatus === 'cancelled_by_professional') {
    throw new Error("Estas ações devem ser feitas chamando o backend diretamente.");
  }

  try {
    const result = await runTransaction(db, async (transaction) => {
      const apptRef = doc(db, 'appointments', appointmentId);
      const apptDoc = await transaction.get(apptRef);
      
      if (!apptDoc.exists()) throw new Error('Agendamento não encontrado');
      
      const data = apptDoc.data() as Appointment;
      const currentStatus = data.status;

      // 1. Validate Transitions
      const allowedTransitions: Record<string, string[]> = {
        'pending': ['confirmed', 'cancelled', 'cancelled_by_professional', 'expired'],
        'confirmed': ['completed', 'cancelled', 'cancelled_by_professional'],
        'completed': [],
        'cancelled': [],
        'cancelled_by_client': [],
        'cancelled_by_professional': [],
        'expired': []
      };

      if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
        throw new Error(`Transição de ${currentStatus} para ${newStatus} não permitida`);
      }

      // 2. Logic for Atomic Locks
      const dAny = data as any;
      const dateVal = data.date || dAny.appointmentDate || dAny.selectedDate || dAny.scheduledDate;
      const timeVal = data.time || dAny.appointmentTime || dAny.selectedTime || dAny.startTime;

      if (dateVal && timeVal) {
        const cleanTime = timeVal.replace(':', '');
        const lockId = `${data.professionalId}_${dateVal}_${cleanTime}`;
        const lockRef = doc(db, 'booking_locks', lockId);

        const blockingStatuses = ['confirmed', 'accepted', 'completed'];
        const freeingStatuses = ['cancelled', 'cancelled_by_client', 'cancelled_by_professional', 'expired', 'rejected'];

        if (blockingStatuses.includes(newStatus)) {
          // Handle completed/accepted etc (confirmed uses confirmAppointmentAtomic)
          const lockSnap = await transaction.get(lockRef);
          if (lockSnap.exists() && lockSnap.data().appointmentId !== appointmentId && blockingStatuses.includes(lockSnap.data().status)) {
            throw new Error('Este horário já está ocupado.');
          }

          transaction.set(lockRef, {
            professionalId: data.professionalId,
            date: dateVal,
            time: timeVal,
            appointmentId: appointmentId,
            status: newStatus,
            updatedAt: serverTimestamp()
          }, { merge: true });

        } else if (freeingStatuses.includes(newStatus) && blockingStatuses.includes(currentStatus)) {
          // Release the lock if it belongs to this appointment
          const lockSnap = await transaction.get(lockRef);
          if (lockSnap.exists() && lockSnap.data().appointmentId === appointmentId) {
            transaction.delete(lockRef);
          }
        }
      }

      // 3. Perform the update
      const updatePayload: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      if (['cancelled', 'cancelled_by_professional'].includes(newStatus)) updatePayload.cancelledAt = serverTimestamp();
      if (newStatus === 'completed') updatePayload.completedAt = serverTimestamp();
      
      const safeUpdate = sanitizeAppointment(updatePayload, true);

      transaction.update(apptRef, safeUpdate);
      
      // Update Client Summary
      const updatedAppt = { ...data, ...safeUpdate } as Appointment;
      await updateClientSummaryInternal(transaction, updatedAppt, data.professionalId, false, currentStatus);
      
      return data;
    });

    devLog(`[Status] Successfully updated to ${newStatus}`);

    // Trigger waitlist check if cancelled
    const freeingStatuses = ['cancelled', 'cancelled_by_client', 'cancelled_by_professional', 'expired', 'rejected'];
    if (freeingStatuses.includes(newStatus)) {
      triggerWaitlistCheck(result.professionalId, result.date, result.time).catch(e => { if (isDev) console.error("[Waitlist Check Error]", e); });
    }
    
    return { success: true };
  } catch (error: any) {
    if (isDev) console.error(`[Status] Update failed for ${appointmentId}:`, error);
    throw error;
  }
}

/**
 * DEPRECATED: Use updateAppointmentStatus instead.
 * Maintained as a wrapper for backward compatibility during transition.
 */
export async function respondToBookingRequest(appointmentId: string, decision: typeof APPOINTMENT_STATUS.CONFIRMED | 'declined') {
  const status = decision === APPOINTMENT_STATUS.CONFIRMED ? APPOINTMENT_STATUS.CONFIRMED : APPOINTMENT_STATUS.CANCELLED;
  return updateAppointmentStatus(appointmentId, status as Appointment['status']);
}

/**
 * Creates a manual appointment with atomic lock.
 */
export async function createManualAppointment(data: Partial<Appointment>) {
  devLog(`[Manual Booking] Creating via backend for ${data.date} ${data.time}`);
  
  if (!data.professionalId || !data.date || !data.time) {
    throw new Error('Dados incompletos');
  }

  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      throw new Error("Sessão expirada. Por favor, acesse novamente.");
    }

    const response = await fetch('/api/manual', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(data),
    });

    const bodyText = await response.text();
    let result;
    try {
        result = JSON.parse(bodyText);
    } catch {
        throw new Error(`[Parse Error] HTTP ${response.status} - Body: ${bodyText.substring(0, 200)}`);
    }

    if (!response.ok) {
        throw new Error(JSON.stringify(result));
    }

    devLog('[Manual Booking] Created successfully', result);
    return true;
  } catch (error: any) {
    if (isDev) console.error('[Manual Booking] Failed:', error);
    throw error;
  }
}

/**
 * High-precision management functions for CLIENTS
 */

export async function confirmPresenceByClient(manageSlug: string) {
  devLog(`[Client] Confirming presence via slug ${manageSlug}`);
  try {
    const response = await fetch(`/api/public/manage/${manageSlug}/confirm-presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao confirmar presença.');
    }

    const result = await response.json();
    return result;
  } catch (err: any) {
    if (isDev) console.error('[confirmPresenceByClient]', err);
    throw err;
  }
}


export async function cancelBookingByClient(manageSlug: string, reason?: string) {
  devLog(`[Client] Cancelling booking via slug ${manageSlug}`);
  try {
    const response = await fetch(`/api/public/manage/${manageSlug}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao cancelar o agendamento.');
    }

    const result = await response.json();
    const data = result.appointmentData;

    if (data) {
      // Notify pro about cancellation
      devLog(`[Client Cancel] Triggering notification format ${data.id}`);
      notify('BOOKING_CANCELLED_BY_CLIENT', { 
        appointmentId: data.id, 
        id: data.id, 
        ...data 
      }).then(res => {
        devLog(`[Client Cancel] Notification sent for ${data.id}:`, res);
      }).catch(err => {
        if (isDev) console.warn(`[Client Cancel] Notification FAILED for ${data.id}:`, err);
      });

      triggerWaitlistCheck(data.professionalId, data.date, data.time).catch(e => { if (isDev) console.error("[Waitlist Check Error]", e); });
    }
    
    return data;
  } catch (error) {
    if (isDev) console.error('[Client Cancel] Failed:', error);
    throw error;
  }
}

export async function getAppointmentByToken(token: string): Promise<Appointment | null> {
  devLog(`[BOOKING_MANAGEMENT] Multi-Strategy Search for: ${token}`);
  
  if (token.toUpperCase().startsWith("NR-")) {
    if (isDev) console.warn(`[BOOKING_MANAGEMENT] Blocked lookup by reservationCode format: ${token}`);
    return null;
  }
  
  const strategies = [
    { field: 'manageSlug', value: token },
    { field: 'token', value: token },
    { field: 'publicToken', value: token },
    { field: 'manageToken', value: token }
  ];

  for (const strategy of strategies) {
    const q = query(collection(db, 'appointments'), where(strategy.field, '==', strategy.value), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const appt = { id: snap.docs[0].id, ...snap.docs[0].data() } as Appointment;
      devLog(`[BOOKING_MANAGEMENT] Found by ${strategy.field}: ${appt.id}`);
      return appt;
    }
  }
  
  if (isDev) console.warn(`[BOOKING_MANAGEMENT] No appointment found for: ${token}`);
  return null;
}

export async function rescheduleBookingByClient(token: string, newDate: string, newTime: string) {
  const targetUrl = `/api/public/manage/${encodeURIComponent(token)}/reschedule`;
  devLog(`[Client] Rescheduling via token ${token} to ${newDate} ${newTime}`);
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newDate, newTime }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.message === "Este horário acabou de ser preenchido. Escolha outro.") {
        throw new Error('Horário indisponível');
      }
      if (errorData.error === "Este horário acabou de ser preenchido. Escolha outro.") {
         throw new Error('Horário indisponível');
      }
      throw new Error(errorData.error || errorData.message || 'Erro ao remarcar a reserva');
    }

    const responseData = await response.json();
    return responseData;
  } catch (error: any) {
    // Repassar o erro
    throw error;
  }
}

export async function rescheduleBookingByProfessional(appointmentId: string, professionalId: string, newDate: string, newTime: string) {
  console.log(`[Professional] Rescheduling ${appointmentId} to ${newDate} ${newTime}`);
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error("Sessão expirada.");

    const response = await fetch(`/api/appointments/${appointmentId}/reschedule-by-professional`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({ newDate, newTime })
    });

    const result = await response.json();
    if (!response.ok) {
       throw new Error(result.error || "Erro ao reagendar");
    }
    return result.updatedData;
  } catch (error) {
    if (isDev) console.error('[Professional Reschedule] Failed:', error);
    throw error;
  }
}

/**
 * SMART WAITLIST FUNCTIONS
 */

export async function addToWaitlist(entry: Partial<WaitlistEntry>) {
  devLog('[Waitlist] Adding entry via API...');
  if (!entry.professionalId || !entry.clientWhatsapp) {
    throw new Error('Telefone e profissional são necessários.');
  }

  try {
    const response = await fetch(`/api/public/waitlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(entry)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error || `Erro do servidor: ${response.status}`;
      throw new Error(message);
    }

    devLog('[Waitlist] Entry added successfully via API');
  } catch (error: any) {
    devLog('[Waitlist] Error adding waitlist entry:', error);
    throw error;
  }
}

/**
 * Triggered when a slot is freed. Finds the best candidate in the waitlist.
 */
export async function triggerWaitlistCheck(professionalId: string, date: string, time: string) {
  devLog(`[Waitlist] Checking availability for ${date} at ${time}...`);
  
  try {
    const proRef = doc(db, 'users', professionalId);
    const proSnap = await getDoc(proRef);
    if (!proSnap.exists()) return;
    const proSettings = proSnap.data() as UserProfile;

    // 1. Find eligible candidates
    const waitlistQ = query(
      collection(db, 'waitlist'),
      where('professionalId', '==', professionalId),
      where('requestedDate', '==', date),
      where('status', '==', 'waiting'),
      orderBy('createdAt', 'asc')
    );
    
    const snap = await getDocs(waitlistQ);
    if (snap.empty) {
      devLog('[Waitlist] No one waiting for this date.');
      return;
    }

    const hour = parseInt(time.split(':')[0]);
    const slotPeriod = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'night';

    // 2. Find first candidate matching the period or 'any'
    const eligible = snap.docs.find(doc => {
      const d = doc.data();
      return d.period === 'any' || d.period === slotPeriod || d.preferredTime === time;
    });

    if (eligible) {
      const entryId = eligible.id;
      const entryData = eligible.data();

      // If pro mode is auto, send invitation
      if (proSettings.waitlistMode === 'auto') {
        const expiresAt = new Date(Date.now() + 15 * 60000); // 15 mins

        await updateDoc(doc(db, 'waitlist', entryId), {
          status: 'invited',
          invitationSentAt: serverTimestamp(),
          invitationExpiresAt: expiresAt.toISOString(),
          assignedTime: time
        });

        // Send Notification
        notify('WAITLIST_INVITATION', {
          waitlistEntryId: entryId
        }).catch(e => { if (isDev) console.error("[Waitlist Invitation Error]", e); });

        // Set a cleanup task would be ideal, but for now we'll handle expiration during booking attempt
        devLog(`[Waitlist] Invitation sent to ${entryData.clientName}`);
      } else {
        // Manual mode: Alert the professional
        notify('WAITLIST_SLOT_OPENED', {
          professionalId,
          date,
          time,
          candidateName: entryData.clientName,
          candidateId: entryId
        }).catch(e => { if (isDev) console.error("[Waitlist Notify Error]", e); });
        devLog('[Waitlist] Professional notified of opened slot (manual mode)');
      }
    }
  } catch (e) {
    if (isDev) console.error('[Waitlist] Trigger check failed:', e);
  }
}

/**
 * Manually invites a person from the waitlist
 */
export async function inviteFromWaitlist(entryId: string, time: string, professionalId: string, date: string) {
  const expiresAt = new Date(Date.now() + 15 * 60000); // 15 mins
  
  // Create lock document ID consistent with backend
  const cleanTime = time.replace(":", "");
  const lockId = `${professionalId}_${date}_${cleanTime}`;
  
  // Set the lock first
  await setDoc(doc(db, 'booking_locks', lockId), {
    professionalId,
    date,
    time,
    waitlistEntryId: entryId,
    expiresAt: expiresAt,
    status: 'waitlist_lock'
  });

  // Then update waitlist
  await updateDoc(doc(db, 'waitlist', entryId), {
    status: 'invited',
    invitationSentAt: serverTimestamp(),
    invitationExpiresAt: expiresAt.toISOString(),
    assignedTime: time
  });
}

/**
 * Marks a waitlist entry as booked
 */
export async function markWaitlistAsBooked(entryId: string) {
  await updateDoc(doc(db, 'waitlist', entryId), {
    status: 'booked',
    bookedAt: serverTimestamp()
  });
}

/**
 * Logs a growth analytics event (visit or click)
 */
export async function logAnalyticsEvent(professionalId: string, type: 'visit' | 'click_book' | 'click_book_sticky' | 'click_book_final' | 'week_calendar_click') {
  try {
    const sessionKey = `analytics_${professionalId}_${type}`;
    const lastLogged = sessionStorage.getItem(sessionKey);
    const now = Date.now();
    
    // Cooldown of 30 minutes for the same event type on the same professional
    if (lastLogged && (now - parseInt(lastLogged, 10) < 30 * 60 * 1000)) {
      return; 
    }

    sessionStorage.setItem(sessionKey, now.toString());

    const referrer = document.referrer;
    let origin: 'instagram' | 'direct' | 'other' = 'other';
    
    if (referrer.includes('instagram.com')) {
      origin = 'instagram';
    } else if (!referrer || referrer === window.location.origin) {
      origin = 'direct';
    }

    fetch('/api/public/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ professionalId, type, referrer, origin })
    }).catch(err => {
        if (isDev) console.error('[Analytics] Network fail:', err);
    });
  } catch (err) {
    if (isDev) console.error('[Analytics] Failed to log event:', err);
  }
}
