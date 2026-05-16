import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore, doc, updateDoc, collection, addDoc, serverTimestamp, runTransaction, getDoc, setDoc, deleteDoc, query, where, getDocs, arrayUnion, arrayRemove, orderBy, onSnapshot, limit, increment } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString } from 'firebase/storage';
import { UserProfile, Appointment, PortfolioItem, WaitlistEntry } from './types';
import { removeUndefinedDeep, parseFirestoreDate } from './lib/utils';
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

export const storageBucket = storage.app.options.storageBucket;
export const projectId = app.options.projectId;
export const timestamp = new Date().toISOString();

async function ensureAuthenticatedUserForStorageUpload() {
  if (auth.currentUser) return auth.currentUser;

  await new Promise<void>((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(() => {
      unsubscribe();
      resolve();
    });
    setTimeout(() => {
      unsubscribe();
      resolve();
    }, 3000);
  });

  if (!auth.currentUser) {
    throw new Error('Auth token ausente antes do upload');
  }

  return auth.currentUser;
}

export async function notify(type: string, payload: any) {
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload })
    });
    if (!res.ok) {
        throw new Error(`Notification failed with status: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error(`[NOTIFY ERROR] Failed to send ${type}:`, error);
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const sanitizeAppointment = (data: any, isUpdate = false): any => {
  const sanitized = { ...data };

  if (!isUpdate || sanitized.clientName !== undefined) {
    sanitized.clientName = typeof sanitized.clientName === 'string' && sanitized.clientName.trim() !== '' 
      ? sanitized.clientName.trim() 
      : 'Cliente';
  }

  if (!isUpdate || sanitized.price !== undefined) {
    sanitized.price = Number(sanitized.price) || 0;
  }

  if (!isUpdate || sanitized.status !== undefined) {
    sanitized.status = normalizeAppointmentStatus(sanitized.status);
  }

  if (!isUpdate && !sanitized.professionalId) {
    throw new Error('professionalId é obrigatório');
  }

  if (!isUpdate && !sanitized.createdAt) {
    sanitized.createdAt = serverTimestamp();
  }

  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined) {
      delete sanitized[key];
    }
  });

  return sanitized;
};

export async function uploadImageToStorage(file: File, path: string): Promise<string> {
  const currentUser = await ensureAuthenticatedUserForStorageUpload();
  await currentUser.reload();
  const token = await currentUser.getIdToken(true);
  if (!token) {
    throw new Error('Auth token ausente antes do upload');
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
  await updateDoc(userRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function savePortfolioItem(uid: string, url: string, category: string): Promise<string> {
  const colRef = collection(db, `users/${uid}/portfolio`);
  const docRef = await addDoc(colRef, {
    url,
    category,
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
  // Stub implementation as the UI component still calls it during manual sync, but it doesn't need to do anything since the backend handles it now.
  console.log('[updateClientSummaryInternal] Stub called. The backend manages client summaries now.');
}

export async function updateClientSummaryFromAppointment(appointment: Appointment) {
  console.log('[updateClientSummaryFromAppointment] Stub called.');
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
  await updateDoc(userRef, { ...profileData, updatedAt: serverTimestamp() });
}

export async function createUserProfile(uid: string, profileData: Partial<UserProfile>) {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { ...profileData, uid, createdAt: serverTimestamp() });
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
  console.log('[checkAndExpireAppointments] called. Ignoring if backend handles it.');
}

export function handleBookingError(error: unknown) {
  let message = 'Ocorreu um erro ao processar o agendamento.';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }
  appNotify.error(message);
  console.error('[Booking Error]', error);
}

/**
 * Standardized function to update appointment status with transition validation.
 * Manages the logic for freeing slots and notifications.
 */
export async function updateAppointmentStatus(appointmentId: string, newStatus: Appointment['status']) {
  console.log(`[Status] Transitioning ${appointmentId} to ${newStatus}...`);
  
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

    console.log(`[Status] Successfully updated to ${newStatus}`);

    // Trigger waitlist check if cancelled
    const freeingStatuses = ['cancelled', 'cancelled_by_client', 'cancelled_by_professional', 'expired', 'rejected'];
    if (freeingStatuses.includes(newStatus)) {
      triggerWaitlistCheck(result.professionalId, result.date, result.time).catch(e => console.error(e));
    }
    
    return { success: true };
  } catch (error: any) {
    console.error(`[Status] Update failed for ${appointmentId}:`, error);
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
  console.log(`[Manual Booking] Creating for ${data.date} ${data.time}`);
  
  if (!data.professionalId || !data.date || !data.time) {
    throw new Error('Dados incompletos');
  }

  try {
    await runTransaction(db, async (transaction) => {
      const apptRef = doc(collection(db, 'appointments'));
      const cleanTime = data.time.replace(':', '');
      const lockId = `${data.professionalId}_${data.date}_${cleanTime}`;
      const lockRef = doc(db, 'booking_locks', lockId);

      // Verify lock
      const lockSnap = await transaction.get(lockRef);
      const blockingStatuses = ['confirmed', 'accepted', 'completed'];

      if (lockSnap.exists() && blockingStatuses.includes(lockSnap.data().status)) {
        throw new Error('Este horário já está ocupado na agenda.');
      }

      // Create appointment
      const updateData = {
        ...data,
        status: APPOINTMENT_STATUS.CONFIRMED,
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        lastChangeBy: 'professional'
      };
      
      const safeData = sanitizeAppointment(updateData, false);
      
      transaction.set(apptRef, safeData);

      // Create lock
      transaction.set(lockRef, {
        professionalId: data.professionalId,
        date: data.date,
        time: data.time,
        appointmentId: apptRef.id,
        serviceId: data.serviceId || 'manual',
        status: APPOINTMENT_STATUS.CONFIRMED,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update Client Summary
      const apptForSummary = { id: apptRef.id, ...safeData } as unknown as Appointment;
      await updateClientSummaryInternal(transaction, apptForSummary, data.professionalId, true);
    });

    console.log('[Manual Booking] Created successfully');
    return true;
  } catch (error: any) {
    console.error('[Manual Booking] Failed:', error);
    throw error;
  }
}

/**
 * High-precision management functions for CLIENTS
 */

export async function confirmPresenceByClient(manageSlug: string) {
  console.log(`[Client] Confirming presence via slug ${manageSlug}`);
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
    console.error('[confirmPresenceByClient]', err);
    throw err;
  }
}

export async function cancelBookingByClient(manageSlug: string, reason?: string) {
  console.log(`[Client] Cancelling booking via slug ${manageSlug}`);
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
      console.log(`[Client Cancel] Triggering notification format ${data.id}`);
      notify('BOOKING_CANCELLED_BY_CLIENT', { 
        appointmentId: data.id, 
        id: data.id, 
        ...data 
      }).then(res => {
        console.log(`[Client Cancel] Notification sent for ${data.id}:`, res);
      }).catch(err => {
        console.warn(`[Client Cancel] Notification FAILED for ${data.id}:`, err);
      });

      triggerWaitlistCheck(data.professionalId, data.date, data.time).catch(e => console.error(e));
    }
    
    return data;
  } catch (error) {
    console.error('[Client Cancel] Failed:', error);
    throw error;
  }
}

export async function getAppointmentByToken(token: string): Promise<Appointment | null> {
  console.log(`[BOOKING_MANAGEMENT] Multi-Strategy Search for: ${token}`);
  
  const strategies = [
    { field: 'manageSlug', value: token },
    { field: 'reservationCode', value: token.toUpperCase() },
    { field: 'token', value: token },
    { field: 'publicToken', value: token },
    { field: 'manageToken', value: token }
  ];

  for (const strategy of strategies) {
    const q = query(collection(db, 'appointments'), where(strategy.field, '==', strategy.value), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const appt = { id: snap.docs[0].id, ...snap.docs[0].data() } as Appointment;
      console.log(`[BOOKING_MANAGEMENT] Found by ${strategy.field}: ${appt.id}`);
      return appt;
    }
  }
  
  // Fallback: ID
  if (token.length >= 20) {
    const docRef = doc(db, 'appointments', token);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      console.log(`[BOOKING_MANAGEMENT] Found by Document ID: ${docSnap.id}`);
      return { id: docSnap.id, ...docSnap.data() } as Appointment;
    }
  }

  console.warn(`[BOOKING_MANAGEMENT] No appointment found for: ${token}`);
  return null;
}

export async function rescheduleBookingByClient(appointmentId: string, newDate: string, newTime: string) {
  console.log(`[Client] Rescheduling ${appointmentId} to ${newDate} ${newTime}`);
  try {
    const data = await runTransaction(db, async (transaction) => {
      const apptRef = doc(db, 'appointments', appointmentId);
      const apptDoc = await transaction.get(apptRef);
      if (!apptDoc.exists()) throw new Error('Agendamento não encontrado');
      
      const data = apptDoc.data() as Appointment;
      
      // 1. Verify new slot lock
      const cleanNewTime = newTime.replace(':', '');
      const lockId = `${data.professionalId}_${newDate}_${cleanNewTime}`;
      const lockRef = doc(db, 'booking_locks', lockId);
      const lockSnap = await transaction.get(lockRef);
      
      const blockingStatuses = ['confirmed', 'accepted', 'completed'];

      if (lockSnap.exists() && blockingStatuses.includes(lockSnap.data().status)) {
        if (lockSnap.data().appointmentId !== appointmentId) {
          console.error(`[BOOKING LOCK] reschedule conflict at ${lockId}`);
          throw new Error('Horário indisponível');
        }
      }

      // 2. Free old lock
      const cleanOldTime = data.time.replace(':', '');
      const oldLockId = `${data.professionalId}_${data.date}_${cleanOldTime}`;
      const oldLockRef = doc(db, 'booking_locks', oldLockId);
      const oldLockSnap = await transaction.get(oldLockRef);
      if (oldLockSnap.exists() && oldLockSnap.data().appointmentId === appointmentId) {
        console.log(`[BOOKING LOCK] releasing old lock: ${oldLockId}`);
        transaction.delete(oldLockRef);
      }

      // 3. Block new lock if already confirmed
      if (blockingStatuses.includes(data.status)) {
        console.log(`[BOOKING LOCK] creating new lock (rescheduled): ${lockId}`);
        transaction.set(lockRef, {
          professionalId: data.professionalId,
          date: newDate,
          time: newTime,
          appointmentId: appointmentId,
          serviceId: data.serviceId || 'unknown',
          status: data.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // 4. Update appointment
      const updatePayload = {
        date: newDate,
        time: newTime,
        previousDate: data.date,
        previousTime: data.time,
        rescheduledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastChangeBy: 'client' as const,
        changeMessage: `Cliente reagendou de ${data.date.split('-').reverse().join('/')} para ${newDate.split('-').reverse().join('/')}`
      };
      
      const safeUpdate = sanitizeAppointment(updatePayload, true);

      transaction.update(apptRef, safeUpdate);

      // Update Client Summary
      const updatedAppt = { ...data, ...safeUpdate } as Appointment;
      await updateClientSummaryInternal(transaction, updatedAppt, data.professionalId, false, data.status);

      return data;
    });

    // Notify pro about reschedule
    notify('BOOKING_RESCHEDULED_BY_CLIENT', { 
      id: appointmentId, 
      appointmentId,
      ...data, 
      previousDate: data.date, 
      previousTime: data.time, 
      date: newDate, 
      time: newTime,
      rescheduledBy: 'client'
    }).catch(e => console.error(e));
    
    // Trigger waitlist check for the OLD slot
    triggerWaitlistCheck(data.professionalId, data.date, data.time).catch(e => console.error(e));
  } catch (error) {
    console.error('[Client Reschedule] Failed:', error);
    throw error;
  }
}

/**
 * SMART WAITLIST FUNCTIONS
 */

export async function addToWaitlist(entry: Partial<WaitlistEntry>) {
  console.log('[Waitlist] Adding entry...');
  const cleaned = removeUndefinedDeep(entry);
  const waitlistRef = collection(db, 'waitlist');
  try {
    await addDoc(waitlistRef, {
      ...cleaned,
      status: 'waiting',
      createdAt: serverTimestamp()
    });
    console.log('[Waitlist] Entry added');
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'waitlist');
  }
}

/**
 * Triggered when a slot is freed. Finds the best candidate in the waitlist.
 */
export async function triggerWaitlistCheck(professionalId: string, date: string, time: string) {
  console.log(`[Waitlist] Checking availability for ${date} at ${time}...`);
  
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
      console.log('[Waitlist] No one waiting for this date.');
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
          id: entryId,
          ...entryData,
          assignedTime: time,
          expiresAt: expiresAt.toISOString(),
          professionalName: proSettings.name
        }).catch(e => console.error(e));

        // Set a cleanup task would be ideal, but for now we'll handle expiration during booking attempt
        console.log(`[Waitlist] Invitation sent to ${entryData.clientName}`);
      } else {
        // Manual mode: Alert the professional
        notify('WAITLIST_SLOT_OPENED', {
          professionalId,
          date,
          time,
          candidateName: entryData.clientName,
          candidateId: entryId
        }).catch(e => console.error(e));
        console.log('[Waitlist] Professional notified of opened slot (manual mode)');
      }
    }
  } catch (e) {
    console.error('[Waitlist] Trigger check failed:', e);
  }
}

/**
 * Manually invites a person from the waitlist
 */
export async function inviteFromWaitlist(entryId: string, time: string) {
  const expiresAt = new Date(Date.now() + 15 * 60000); // 15 mins
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
    const referrer = document.referrer;
    let origin: 'instagram' | 'direct' | 'other' = 'other';
    
    if (referrer.includes('instagram.com')) {
      origin = 'instagram';
    } else if (!referrer || referrer === window.location.origin) {
      origin = 'direct';
    }

    await addDoc(collection(db, 'analytics_events'), {
      professionalId,
      type,
      referrer,
      origin,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error('[Analytics] Failed to log event:', err);
  }
}
