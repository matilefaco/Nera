import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, browserPopupRedirectResolver, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, updateDoc, collection, addDoc, serverTimestamp, runTransaction, getDoc, setDoc, deleteDoc, query, where, getDocs, arrayUnion, arrayRemove, orderBy, onSnapshot, limit, increment } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import { UserProfile, Appointment, PortfolioItem, WaitlistEntry } from './types';
import { removeEmptyFields, parseFirestoreDate } from './lib/utils';
import { toast } from 'sonner';

const requiredKeys = ['apiKey', 'authDomain', 'projectId'];
requiredKeys.forEach(key => {
  if (!firebaseConfig[key as keyof typeof firebaseConfig]) {
    throw new Error(`[FIREBASE CONFIG] CRITICAL: Missing ${key}. Check firebase-applet-config.json`);
  }
});

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

// Initialize Auth with browserLocalPersistence for maximum compatibility in iframes (Safari/iPhone)
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

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

/**
 * Centrally handles booking-related errors and shows clear feedback to the user.
 */
export function handleBookingError(error: any) {
  console.log('[DEBUG] error object:', JSON.stringify(error));
  console.error('[Booking Error Handler]:', error);

  let message = 'Não foi possível concluir agora. Tente novamente.';

  // 0. Handle JSON Errors (from handleFirestoreError)
  if (error.message && (error.message.startsWith('{') || error.message.includes('"error":'))) {
    try {
      const info = JSON.parse(error.message);
      if (info.error) {
         console.error('[BOOKING_DIAGNOSTIC] Parsed Firestore Error:', info);
         if (info.error.includes('permission-denied') || info.error.includes('insufficient permissions')) {
            message = 'Permissão negada. Verifique as configurações de acesso públicas.';
         } else if (info.error.includes('doc-after-write')) {
            message = 'Erro de transação: Leitura após escrita detectada e corrigida.';
         }
      }
    } catch (e) {
      // Fallback
    }
  }

  // If the error message is specific and from our API, use it
  if (error.message && error.message.length < 100 && !error.code) {
    toast.error(`Erro: ${error.message}`);
    return error.message;
  }

  // 1. Specific Business Logic Errors
  const businessErrors = [
    'Este horário acabou de ser ocupado.',
    'Horário indisponível',
    'Este horário já foi preenchido por outra confirmação.',
    'Este horário já está ocupado na agenda.',
    'Reserva não encontrada.',
    'Você não tem permissão para confirmar esta reserva.',
    'Esta reserva já está confirmada.',
    'Este horário acabou de ser ocupado por outra cliente.',
    'Dados de data ou hora ausentes na reserva.'
  ];

  if (error.message === 'slot-taken' || error.message === 'Este horário já foi preenchido por outra confirmação.') {
    message = 'Esse horário já possui uma reserva confirmada. Recuse este pedido ou escolha outro horário.';
  }
  else if (businessErrors.includes(error.message)) {
    message = error.message;
  } 
  else if (error.message === 'Dados incompletos' || error.message === 'Dados de agendamento incompletos' || error.message === 'missing-data') {
    message = 'Dados da reserva incompletos. Verifique as informações.';
  }
  // 2. Status Transition errors
  else if (error.message?.includes('não permitida')) {
    message = 'Esta reserva já foi finalizada e não pode mais ser alterada.';
  }
  // 3. Connection/Network Errors
  else if (error.code === 'unavailable' || error.message?.includes('network-error') || error.message?.includes('failed to fetch') || error.message?.includes('offline')) {
    message = 'Sua conexão parece instável. Tente novamente em instantes.';
  }
  // 4. Data/Permission Errors
  else if (error.code === 'permission-denied' || error.message?.includes('insufficient permissions')) {
    message = 'Permissão negada. Verifique as configurações de acesso.';
  }
  // 5. Auth Errors
  else if (error.message === 'auth-error' || error.message?.includes('estar logado')) {
    message = 'Sessão expirada. Entre novamente para confirmar reservas.';
  }
  // 6. Not Found
  else if (error.message === 'Agendamento não encontrado' || error.message === 'not-found') {
    message = 'A reserva solicitada não foi encontrada.';
  }
  else if (error.message === 'already-confirmed') {
    message = 'Esta reserva já está confirmada.';
  }
  else if (error.message === 'permission-denied') {
    message = 'Sem permissão para alterar esta reserva.';
  }

  toast.error(message);
  return message;
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
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Uploads a file to Firebase Storage and returns the download URL.
 * Uses uploadString (Base64) for maximum compatibility in iframe/mobile environments.
 */
export async function uploadImageToStorage(file: File | Blob, folder: string): Promise<string> {
  console.log(`[Storage] Starting upload to ${folder}... (Base64 Method)`);
  const timestamp = Date.now();
  const extension = file instanceof File ? file.name.split('.').pop() : 'jpg';
  const fileName = `${folder}/${timestamp}_image.${extension}`;
  const storageRef = ref(storage, fileName);
  
  try {
    // Convert Blob/File to Base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:image/xxx;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    console.log('[Storage] Calling uploadString (base64)...');
    const snapshot = await uploadString(storageRef, base64Data, 'base64', {
      contentType: file.type || 'image/jpeg'
    });
    
    console.log('[Storage] Upload successful, getting download URL...');
    const url = await getDownloadURL(snapshot.ref);
    console.log('[Storage] Download URL obtained:', url);
    return url;
  } catch (error) {
    console.error('[Storage] CRITICAL ERROR during upload:', error);
    throw error;
  }
}

/**
 * Updates a user profile with partial data.
 */
export async function saveProfilePartial(userId: string, payload: Partial<UserProfile>) {
  console.log(`[Firestore] Saving profile partial for ${userId}...`);
  
  // Clean data before saving
  const cleanedPayload = removeEmptyFields(payload);
  
  const userRef = doc(db, 'users', userId);
  try {
    // Use setDoc with merge: true to handle cases where the document might not exist yet
    await setDoc(userRef, {
      ...cleanedPayload,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log('[Firestore] Profile partial saved OK');
  } catch (error) {
    console.error('[Firestore] Profile partial save failed:', error);
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }
}

/**
 * Saves a portfolio item directly to the user's portfolio array in their document.
 */
export async function savePortfolioItem(userId: string, imageUrl: string, category: string = 'Geral') {
  console.log(`[Portfolio] saving to Firestore for ${userId}...`);
  const userRef = doc(db, 'users', userId);
  const newItem = {
    id: `item-${Date.now()}`,
    url: imageUrl,
    category,
    createdAt: new Date().toISOString()
  };

  try {
    await updateDoc(userRef, {
      portfolio: arrayUnion(newItem),
      updatedAt: new Date().toISOString()
    });
    console.log('[Portfolio] saved successfully to Firestore');
    return newItem.id;
  } catch (error) {
    console.error('[Portfolio] failed to save to Firestore:', error);
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    throw error;
  }
}

/**
 * Removes a portfolio item from the user's portfolio array.
 */
export async function deletePortfolioItem(userId: string, item: PortfolioItem) {
  console.log(`[Portfolio] removing item from Firestore for ${userId}...`);
  const userRef = doc(db, 'users', userId);
  try {
    await updateDoc(userRef, {
      portfolio: arrayRemove(item),
      updatedAt: new Date().toISOString()
    });
    console.log('[Portfolio] removed successfully from Firestore');
  } catch (error) {
    console.error('[Portfolio] failed to remove from Firestore:', error);
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    throw error;
  }
}

/**
 * Calls the backend notification service.
 */
export async function notify(type: string, payload: any) {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  
  // If we are in the browser and API URL is localhost but we are on a different host (proxy),
  // use relative path to ensure it hits the same server.
  if (typeof window !== 'undefined' && apiUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
    apiUrl = '';
  }

  try {
    console.log(`[Notify] Sending ${type} to ${apiUrl || 'relative'}/api/notify`);
    const response = await fetch(`${apiUrl}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload })
    });
    const result = await response.json();
    console.log('[Notify] Result:', result);
    return result;
  } catch (error) {
    console.warn('[Notify] Failed to send notification:', error);
    return { success: false, error };
  }
}

/**
 * Normalizes client key based on phone or email
 */
export function getClientKey(phone?: string, email?: string, name?: string): string {
  const cleanPhone = phone?.replace(/\D/g, '');
  if (cleanPhone && cleanPhone.length >= 8) return cleanPhone;
  if (email) return email.toLowerCase().trim();
  return `name-${(name || 'anon').toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Internal helper to update client summary within a transaction
 */
async function updateClientSummaryInternal(transaction: any, appointment: Appointment, professionalId: string, isNew: boolean, oldStatus?: string, preFetchedSnap?: any) {
  const clientKey = getClientKey(appointment.clientWhatsapp, appointment.clientEmail, appointment.clientName);
  const summaryId = `${professionalId}_${clientKey}`;
  const summaryRef = doc(db, 'client_summaries', summaryId);
  
  const summarySnap = preFetchedSnap || await transaction.get(summaryRef);
  let summary = summarySnap.exists() ? summarySnap.data() : {
    professionalId,
    clientKey,
    clientName: appointment.clientName,
    clientPhone: appointment.clientWhatsapp || '',
    clientEmail: appointment.clientEmail || '',
    totalAppointments: 0,
    confirmedAppointments: 0,
    cancelledAppointments: 0,
    noShowCount: 0,
    totalSpent: 0,
    lastAppointmentDate: appointment.date,
    lastServiceName: appointment.serviceName,
    firstAppointmentDate: appointment.date,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const status = appointment.status;
  const price = (appointment.price || 0) + (appointment.travelFee || 0);

  // 1. Basic Stats
  if (isNew) {
    summary.totalAppointments += 1;
    if (!summary.firstAppointmentDate || new Date(appointment.date) < new Date(summary.firstAppointmentDate)) {
      summary.firstAppointmentDate = appointment.date;
    }
  }

  // 2. Status specific updates
  const wasConfirmed = oldStatus === 'confirmed' || oldStatus === 'accepted' || oldStatus === 'completed';
  const isNowConfirmed = status === 'confirmed' || status === 'accepted' || status === 'completed';

  if (isNowConfirmed && !wasConfirmed) {
    summary.confirmedAppointments += 1;
    summary.totalSpent += price;
  } else if (!isNowConfirmed && wasConfirmed) {
    summary.confirmedAppointments = Math.max(0, summary.confirmedAppointments - 1);
    summary.totalSpent = Math.max(0, summary.totalSpent - price);
  }

  if (status === 'cancelled' || status === 'cancelled_by_client' || status === 'cancelled_by_professional') {
    if (oldStatus !== 'cancelled' && oldStatus !== 'cancelled_by_client' && oldStatus !== 'cancelled_by_professional') {
      summary.cancelledAppointments += 1;
    }
  }

  if (appointment.noShow && !wasConfirmed && status === 'completed') { // Simplified logic for no-show
     // If it's a no-show it usually comes from confirmed?
  }
  
  // Explicit no-show check (if marked by pro)
  if (appointment.noShow) {
    summary.noShowCount += 1;
  }

  // 3. Last appointment logic
  if (!summary.lastAppointmentDate || new Date(appointment.date) >= new Date(summary.lastAppointmentDate)) {
    summary.lastAppointmentDate = appointment.date;
    summary.lastServiceName = appointment.serviceName;
    summary.clientName = appointment.clientName || summary.clientName;
    summary.clientPhone = appointment.clientWhatsapp || summary.clientPhone;
    summary.clientEmail = appointment.clientEmail || summary.clientEmail;
  }

  summary.updatedAt = new Date().toISOString();
  transaction.set(summaryRef, summary, { merge: true });
}

/**
 * Public function to manually trigger a summary update (e.g. during migration)
 */
export async function updateClientSummaryFromAppointment(appointment: Appointment) {
  console.log(`[Summary] Manual update for client of appt ${appointment.id}`);
  await runTransaction(db, async (transaction) => {
    await updateClientSummaryInternal(transaction, appointment, appointment.professionalId, false);
  });
}

/**
 * Creates a booking request and notifies the professional via Backend API.
 * Regra Oficial: Pedido pendente NÃO bloqueia horário.
 */
export async function createBookingRequest(appointmentData: Partial<Appointment>) {
  console.log('[BOOKING_FLOW] calling backend create-booking...');
  
  if (!appointmentData.professionalId || !appointmentData.date || !appointmentData.time) {
    console.error('[BOOKING_FLOW] ERROR: Missing required fields');
    throw new Error('Dados de agendamento incompletos');
  }

  try {
    let apiUrl = import.meta.env.VITE_API_URL || '';
    
    // Force relative path if:
    // 1. Current URL contains localhost but we are NOT on localhost
    // 2. We are in production (NODE_ENV=production) and accessed via browser
    const isProduction = import.meta.env.PROD;
    const isOnDifferentHost = typeof window !== 'undefined' && apiUrl.includes('localhost') && !window.location.hostname.includes('localhost');
    
    if (isOnDifferentHost || (isProduction && typeof window !== 'undefined')) {
      console.log(`[BOOKING_FLOW] Forcing relative path (isProduction: ${isProduction}, isOnDifferentHost: ${isOnDifferentHost})`);
      apiUrl = '';
    }

    let sanitizedApiUrl = apiUrl.replace(/\/$/, '');
    const fullUrl = `${sanitizedApiUrl}/api/public/create-booking`;
    const windowInfo = typeof window !== 'undefined' ? {
      origin: window.location.origin,
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      href: window.location.href,
      userAgent: navigator.userAgent
    } : null;

    console.log(`[BOOKING_FLOW] --- DIAGNOSTIC START ---`);
    console.log(`[BOOKING_FLOW] API Endpoint: ${fullUrl}`);
    console.log(`[BOOKING_FLOW] Method: POST`);
    console.log(`[BOOKING_FLOW] Environment:`, { 
      PROD: import.meta.env.PROD, 
      isLocalhost: fullUrl.includes('localhost'),
      window: windowInfo 
    });
    
    // Payload sanitizado for logging (no PII if possible, but actually for debugging we might need it)
    console.log(`[BOOKING_FLOW] Payload Keys:`, Object.keys(appointmentData));

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Platform': 'Web'
      },
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'omit',
      body: JSON.stringify(appointmentData)
    }).catch(err => {
      console.error('[BOOKING_FLOW] --- fetch() CRASHED ---');
      console.error('[BOOKING_FLOW] Error Details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        url: fullUrl,
        origin: window.location.origin
      });
      
      const isTypeError = err.name === 'TypeError';
      const detail = isTypeError ? `Possível erro de CORS, Rede ou Protocolo (TypeError). Verifique se o backend em ${fullUrl} está acessível.` : err.message;
      
      throw new Error(`Falha de conexão com o servidor (Network Error). Detalhes: ${detail}`);
    });

    console.log(`[BOOKING_FLOW] Response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[BOOKING_FLOW] Backend error:`, errorData);
      throw new Error(errorData.error || 'Erro ao criar agendamento no servidor');
    }

    const result = await response.json();
    console.log(`[BOOKING_FLOW] Backend success:`, result);
    
    return { 
      bookingId: result.bookingId, 
      token: result.token,
      reservationCode: result.reservationCode
    };
  } catch (error: any) {
    console.error('[Booking] CRITICAL ERROR creating request via backend:', error);
    throw error;
  }
}

/**
 * Automaticaly cancels pending requests that conflict with a confirmed one.
 */
async function cancelConflictingRequests(confirmedId: string, professionalId: string, date: string, time: string) {
  console.log(`[Cleanup] Checking for conflicts with ${confirmedId} at ${date} ${time}...`);
  try {
    const q = query(
      collection(db, 'appointments'),
      where('professionalId', '==', professionalId),
      where('date', '==', date),
      where('time', '==', time),
      where('status', '==', 'pending')
    );

    const snap = await getDocs(q);
    const conflicts = snap.docs.filter(doc => doc.id !== confirmedId);

    if (conflicts.length === 0) return;

    console.log(`[Cleanup] Found ${conflicts.length} conflicting pending requests. Cancelling...`);
    
    for (const conflict of conflicts) {
      await updateDoc(conflict.ref, {
        status: 'expired', // or cancelled_by_professional
        cancellationReason: 'Horário preenchido por outra reserva',
        updatedAt: serverTimestamp(),
        lastChangeBy: 'system',
        changeMessage: 'Cancelado automaticamente devido a conflito de horário'
      });
    }
  } catch (e) {
    console.error('[Cleanup] Failed to cancel conflicts:', e);
  }
}

/**
 * Checks for expired bookings based on Nera Official Rules:
 * - Today's requests expire after 2 hours.
 * - Future requests expire after 24 hours.
 */
export async function checkAndExpireAppointments(professionalId: string) {
  console.log(`[GC] Checking for expired appointments for pro ${professionalId}...`);
  try {
    const q = query(
      collection(db, 'appointments'),
      where('professionalId', '==', professionalId),
      where('status', '==', 'pending')
    );

    const snap = await getDocs(q);
    const now = Date.now();

    for (const d of snap.docs) {
      const appt = d.data() as Appointment;
      const createdAt = parseFirestoreDate(appt.createdAt).getTime();
      const isToday = appt.date === new Date().toISOString().split('T')[0];
      
      const expireTime = isToday ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      
      if (now - createdAt > expireTime) {
        console.log(`[GC] Expiring appointment ${d.id}`);
        await updateDoc(d.ref, {
          status: 'expired',
          updatedAt: serverTimestamp(),
          changeMessage: 'Expirado por falta de confirmação no prazo'
        });
      }
    }
  } catch (e) {
    console.error('[GC] Error:', e);
  }
}

/**
 * Atomic confirmation using Firestore Transactions.
 * Guarantees that two appointments cannot occupy the same slot (professional + date + time).
 */
export async function confirmAppointmentAtomic(appointmentId: string, professionalId: string) {
  console.log(`[CONFIRM START] Starting atomic confirmation for ${appointmentId}...`);
  
  if (!professionalId) {
    const currentUid = auth.currentUser?.uid;
    console.warn("[CONFIRM PRECHECK] professionalId not provided, using current user:", currentUid);
    professionalId = currentUid || "";
  }

  console.log("[AUTH STATE BEFORE CONFIRM]", {
    currentUser: auth.currentUser?.uid,
    professionalIdInput: professionalId
  });

  if (!professionalId) {
    console.error("[CONFIRM ERROR] Auth missing: No professionalId available");
    throw new Error("auth-error");
  }

  // Ensure user is truly authenticated and matches the ID
  if (auth.currentUser?.uid !== professionalId) {
    console.error("[CONFIRM ERROR] UID mismatch or not logged in", { authUid: auth.currentUser?.uid, professionalId });
    throw new Error("auth-error");
  }

  try {
    return await runTransaction(db, async (transaction) => {
      console.log(`[CONFIRM TX START] Accessing Firestore for appt: ${appointmentId}`);
      const apptRef = doc(db, 'appointments', appointmentId);
      const apptDoc = await transaction.get(apptRef);

      if (!apptDoc.exists()) {
        console.error(`[CONFIRM ERROR] apptDoc not found: ${appointmentId}`);
        throw new Error("not-found");
      }

      const data = apptDoc.data() as Appointment;
      console.log(`[CONFIRM APPOINTMENT DOC] Current data:`, {
        status: data.status,
        date: data.date,
        time: data.time,
        proId: data.professionalId
      });
      
      // Permission check
      if (data.professionalId !== professionalId) {
        console.error(`[CONFIRM ERROR] Permission mismatch: Pro ${professionalId} vs Owner ${data.professionalId}`);
        throw new Error("permission-denied");
      }

      const currentStatus = data.status;
      if (currentStatus !== 'pending') {
        throw new Error("already-confirmed");
      }

      // Extract date and time with fallbacks
      const dAny = data as any;
      const dateVal = data.date || dAny.appointmentDate || dAny.selectedDate || dAny.scheduledDate;
      const timeVal = data.time || dAny.appointmentTime || dAny.selectedTime || dAny.startTime;

      if (!dateVal || !timeVal) {
        console.error(`[CONFIRM ERROR] Missing date/time in data:`, { dateVal, timeVal });
        throw new Error("missing-data");
      }

      const cleanTime = timeVal.replace(':', '');
      const lockId = `${data.professionalId}_${dateVal}_${cleanTime}`;
      const lockRef = doc(db, 'booking_locks', lockId);
      
      const clientKey = getClientKey(data.clientWhatsapp, data.clientEmail, data.clientName);
      const summaryId = `${data.professionalId}_${clientKey}`;
      const summaryRef = doc(db, 'client_summaries', summaryId);

      console.log(`[CONFIRM LOCK & SUMMARY CHECK] Looking for lock: ${lockId} and summary: ${summaryId}`);
      
      // RUN ALL READS
      const [lockDoc, summarySnap] = await Promise.all([
        transaction.get(lockRef),
        transaction.get(summaryRef)
      ]);

      const blockingStatuses = ['confirmed', 'accepted', 'completed'];
      if (lockDoc.exists()) {
        const lockData = lockDoc.data();
        if (lockData && lockData.appointmentId !== appointmentId && blockingStatuses.includes(lockData.status)) {
          console.error(`[CONFIRM ERROR] Slot already taken by appt: ${lockData.appointmentId}`);
          throw new Error("slot-taken");
        }
      }

      // Update Appointment
      console.log(`[CONFIRM TX] Updating appointment status to confirmed`);
      const updateData = {
        status: "confirmed" as const,
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastChangeBy: 'professional',
        changeMessage: 'Reserva confirmada atomicamente'
      };
      transaction.update(apptRef, updateData);

      // Create/Update Lock
      console.log(`[CONFIRM TX] Creating slot lock: ${lockId}`);
      transaction.set(lockRef, {
        professionalId: data.professionalId,
        appointmentId: appointmentId,
        date: dateVal,
        time: timeVal,
        status: "confirmed",
        serviceId: data.serviceId || 'unknown',
        serviceName: data.serviceName || 'Serviço',
        clientName: data.clientName || 'Cliente',
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Update Client Summary
      const updatedAppt = { ...data, ...updateData } as Appointment;
      await updateClientSummaryInternal(transaction, updatedAppt, data.professionalId, false, data.status, summarySnap);

      console.log(`[CONFIRM SUCCESS] Appointment ${appointmentId} confirmed atomicly`);
      
      // Trigger notification
      notify('BOOKING_CONFIRMED', {
        appointmentId,
        professionalId,
        ...updatedAppt
      });

      return { success: true };
    });
  } catch (error: any) {
    console.error('[CONFIRM ERROR RAW]', error);
    throw error;
  }
}

/**
 * Atomic decline for PENDING requests.
 * Ensures the status transition is safe and no locks are created.
 */
export async function declineAppointmentAtomic(appointmentId: string, professionalId: string) {
  console.log(`[DECLINE START] Starting atomic decline for ${appointmentId}...`);
  
  if (!professionalId) throw new Error("auth-error");

  try {
    await runTransaction(db, async (transaction) => {
      const apptRef = doc(db, 'appointments', appointmentId);
      const apptDoc = await transaction.get(apptRef);

      if (!apptDoc.exists()) throw new Error("not-found");
      const data = apptDoc.data() as Appointment;

      if (data.professionalId !== professionalId) throw new Error("permission-denied");
      
      const clientKey = getClientKey(data.clientWhatsapp, data.clientEmail, data.clientName);
      const summaryId = `${data.professionalId}_${clientKey}`;
      const summaryRef = doc(db, 'client_summaries', summaryId);
      
      const summarySnap = await transaction.get(summaryRef);
      
      // Only pending can be declined via this atomic flow
      if (data.status !== 'pending') {
        throw new Error(`Transição de ${data.status} para recusada não permitida.`);
      }

      const updateData = {
        status: "cancelled_by_professional" as const,
        declinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastChangeBy: 'professional',
        changeMessage: 'Pedido recusado pela profissional'
      };
      
      transaction.update(apptRef, updateData);
      
      // Update Client Summary
      const updatedAppt = { ...data, ...updateData } as Appointment;
      await updateClientSummaryInternal(transaction, updatedAppt, professionalId, false, data.status, summarySnap);
      
      // Trigger notification
      notify('BOOKING_REJECTED', {
        appointmentId,
        professionalId,
        ...updatedAppt,
        professionalSlug: null // Server will fetch if null
      });
    });
    console.log(`[DECLINE SUCCESS] Appointment ${appointmentId} declined.`);
    return { success: true };
  } catch (error: any) {
    console.error('[DECLINE ERROR RAW]', error);
    throw error;
  }
}

/**
 * Atomic cancellation for already CONFIRMED appointments.
 * Frees the slot lock and updates the appointment status.
 */
export async function cancelConfirmedAppointmentAtomic(appointmentId: string, professionalId: string) {
  console.log(`[CANCEL START] Starting atomic cancellation for confirmed ${appointmentId}...`);
  
  if (!professionalId) throw new Error("auth-error");

  try {
    await runTransaction(db, async (transaction) => {
      const apptRef = doc(db, 'appointments', appointmentId);
      const apptDoc = await transaction.get(apptRef);

      if (!apptDoc.exists()) throw new Error("not-found");
      const data = apptDoc.data() as Appointment;

      if (data.professionalId !== professionalId) throw new Error("permission-denied");
      
      if (data.status !== 'confirmed' && data.status !== 'accepted') {
        throw new Error(`Apenas agendamentos confirmados podem ser cancelados por este fluxo. Status atual: ${data.status}`);
      }

      // Identify the lock
      const dAny = data as any;
      const dateVal = data.date || dAny.appointmentDate || dAny.selectedDate || dAny.scheduledDate;
      const timeVal = data.time || dAny.appointmentTime || dAny.selectedTime || dAny.startTime;

      const clientKey = getClientKey(data.clientWhatsapp, data.clientEmail, data.clientName);
      const summaryId = `${professionalId}_${clientKey}`;
      const summaryRef = doc(db, 'client_summaries', summaryId);
      
      let lockRef = null;
      let lockSnapPromise = Promise.resolve(null as any);
      
      if (dateVal && timeVal) {
        const cleanTime = timeVal.replace(':', '');
        const lockId = `${professionalId}_${dateVal}_${cleanTime}`;
        lockRef = doc(db, 'booking_locks', lockId);
        lockSnapPromise = transaction.get(lockRef);
      }

      const [lockDoc, summarySnap] = await Promise.all([
        lockSnapPromise,
        transaction.get(summaryRef)
      ]);

      if (lockRef && lockDoc && lockDoc.exists() && lockDoc.data().appointmentId === appointmentId) {
        transaction.delete(lockRef);
        console.log(`[CANCEL TX] Slot lock points to this appt. Deleting.`);
      }

      const updateData = {
        status: "cancelled_by_professional" as const,
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastChangeBy: 'professional',
        changeMessage: 'Agendamento confirmado foi cancelado pela profissional'
      };

      transaction.update(apptRef, updateData);
      
      // Update Client Summary
      const updatedAppt = { ...data, ...updateData } as Appointment;
      await updateClientSummaryInternal(transaction, updatedAppt, professionalId, false, data.status, summarySnap);
      
      // Trigger notification
      notify('BOOKING_CANCELLED', {
        appointmentId,
        professionalId,
        ...updatedAppt
      });
    });
    
    console.log(`[CANCEL SUCCESS] Appointment ${appointmentId} cancelled and slot freed.`);
    return { success: true };
  } catch (error: any) {
    console.error('[CANCEL ERROR RAW]', error);
    throw error;
  }
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

  // ATOMIC FLOWS
  if (newStatus === 'confirmed') {
    return await confirmAppointmentAtomic(appointmentId, currentUid);
  }

  if (newStatus === 'cancelled_by_professional') {
    // Determine if it was pending or confirmed
    const apptSnap = await getDoc(doc(db, 'appointments', appointmentId));
    if (apptSnap.exists()) {
      const data = apptSnap.data() as Appointment;
      if (data.status === 'pending') {
        return await declineAppointmentAtomic(appointmentId, currentUid);
      } else if (data.status === 'confirmed' || data.status === 'accepted') {
        return await cancelConfirmedAppointmentAtomic(appointmentId, currentUid);
      }
    }
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

      transaction.update(apptRef, updatePayload);
      
      // Update Client Summary
      const updatedAppt = { ...data, ...updatePayload } as Appointment;
      await updateClientSummaryInternal(transaction, updatedAppt, data.professionalId, false, currentStatus);
      
      return data;
    });

    console.log(`[Status] Successfully updated to ${newStatus}`);

    // Trigger waitlist check if cancelled
    const freeingStatuses = ['cancelled', 'cancelled_by_client', 'cancelled_by_professional', 'expired', 'rejected'];
    if (freeingStatuses.includes(newStatus)) {
      triggerWaitlistCheck(result.professionalId, result.date, result.time);
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
export async function respondToBookingRequest(appointmentId: string, decision: 'confirmed' | 'declined') {
  const status = decision === 'confirmed' ? 'confirmed' : 'cancelled';
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
        status: 'confirmed' as const,
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        lastChangeBy: 'professional'
      };
      
      transaction.set(apptRef, updateData);

      // Create lock
      transaction.set(lockRef, {
        professionalId: data.professionalId,
        date: data.date,
        time: data.time,
        appointmentId: apptRef.id,
        serviceId: data.serviceId || 'manual',
        status: 'confirmed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update Client Summary
      const apptForSummary = { id: apptRef.id, ...updateData } as unknown as Appointment;
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

export async function confirmPresenceByClient(appointmentId: string) {
  console.log(`[Client] Confirming presence for ${appointmentId}`);
  const apptRef = doc(db, 'appointments', appointmentId);
  
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(apptRef);
    if (!snap.exists()) throw new Error('Agendamento não encontrado');
    const data = snap.data() as Appointment;
    const oldStatus = data.status;

    const updateData = {
      clientConfirmedAt: serverTimestamp(),
      clientConfirmed24h: true,
      status: 'confirmed' as const,
      updatedAt: serverTimestamp(),
      lastChangeBy: 'client' as const,
      changeMessage: 'Cliente confirmou presença 24h'
    };

    transaction.update(apptRef, updateData);

    // Update Client Summary
    const updatedAppt = { ...data, ...updateData } as Appointment;
    await updateClientSummaryInternal(transaction, updatedAppt, data.professionalId, false, oldStatus);
  });
}

export async function cancelBookingByClient(appointmentId: string, reason?: string) {
  console.log(`[Client] Cancelling booking ${appointmentId}`);
  try {
    const data = await runTransaction(db, async (transaction) => {
      const apptRef = doc(db, 'appointments', appointmentId);
      const apptDoc = await transaction.get(apptRef);
      if (!apptDoc.exists()) throw new Error('Agendamento não encontrado');
      
      const data = apptDoc.data() as Appointment;
      const cleanTime = data.time.replace(':', '');
      const lockId = `${data.professionalId}_${data.date}_${cleanTime}`;
      const lockRef = doc(db, 'booking_locks', lockId);

      // Free the lock if it belongs to this appointment
      const lockSnap = await transaction.get(lockRef);
      if (lockSnap.exists() && lockSnap.data().appointmentId === appointmentId) {
        console.log(`[BOOKING LOCK] released by client: ${lockId}`);
        transaction.delete(lockRef);
      }

      // Update appointment
      const updateData = {
        status: 'cancelled' as const,
        cancellationReason: reason || 'Cancelado pelo cliente',
        updatedAt: serverTimestamp(),
        cancelledAt: serverTimestamp(),
        lastChangeBy: 'client' as const,
        changeMessage: 'Cliente cancelou a reserva'
      };
      
      transaction.update(apptRef, updateData);

      // Update Client Summary
      const updatedAppt = { ...data, ...updateData } as Appointment;
      await updateClientSummaryInternal(transaction, updatedAppt, data.professionalId, false, data.status);

      return data;
    });

    // Notify pro about cancellation
    console.log(`[Client Cancel] Triggering notification for ${appointmentId}`);
    notify('BOOKING_CANCELLED_BY_CLIENT', { 
      appointmentId, // Use consistent naming
      id: appointmentId, 
      ...data 
    }).then(res => {
      console.log(`[Client Cancel] Notification sent for ${appointmentId}:`, res);
    }).catch(err => {
      console.warn(`[Client Cancel] Notification FAILED for ${appointmentId}:`, err);
    });

    // Trigger waitlist check
    triggerWaitlistCheck(data.professionalId, data.date, data.time);
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
      
      transaction.update(apptRef, updatePayload);

      // Update Client Summary
      const updatedAppt = { ...data, ...updatePayload } as Appointment;
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
    });
    
    // Trigger waitlist check for the OLD slot
    triggerWaitlistCheck(data.professionalId, data.date, data.time);
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
  const cleaned = removeEmptyFields(entry);
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
        });

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
        });
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
