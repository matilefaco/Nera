import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, browserPopupRedirectResolver, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, updateDoc, collection, addDoc, serverTimestamp, runTransaction, getDoc, setDoc, deleteDoc, query, where, getDocs, arrayUnion, arrayRemove, orderBy, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import { UserProfile, Appointment, PortfolioItem, WaitlistEntry } from './types';
import { removeEmptyFields } from './lib/utils';
import { toast } from 'sonner';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
console.log('[Firebase] Storage initialized with bucket:', storage.app.options.storageBucket);

// Initialize Auth with explicit persistence to handle Safari/ITP issues in iframes
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
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
  console.error('[Booking Error Handler]:', error);

  let message = 'Não foi possível concluir agora. Tente novamente.';

  // 1. Specific Business Logic Errors
  if (error.message === 'Esse horário acabou de ser reservado' || error.message === 'Horário indisponível') {
    message = 'Este horário acaba de ficar indisponível. Por favor, escolha outro momento.';
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
    message = 'Ops! Verifique as informações e tente novamente.';
  }
  // 5. Not Found
  else if (error.message === 'Agendamento não encontrado') {
    message = 'A reserva solicitada não foi encontrada.';
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
 * Creates a booking request and notifies the professional.
 * Uses a transaction to ensure no two appointments can be created for the same slot.
 */
export async function createBookingRequest(appointmentData: Partial<Appointment>) {
  console.log('[Booking] Creating request...');
  
  if (!appointmentData.professionalId || !appointmentData.date || !appointmentData.time) {
    throw new Error('Dados de agendamento incompletos');
  }

  const slotId = `${appointmentData.date}_${appointmentData.time}`;
  const lockId = `${appointmentData.professionalId}_${slotId}`;
  const lockRef = doc(db, 'blocked_slots', lockId);

  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. Verificar conflito DENTRO da transação (atômico)
      const slotSnap = await transaction.get(lockRef);
      if (slotSnap.exists()) {
        throw new Error('Esse horário acabou de ser reservado');
      }

      const cleanedData = removeEmptyFields(appointmentData);
      const apptRef = doc(collection(db, 'appointments'));
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      transaction.set(apptRef, {
        ...cleanedData,
        status: 'pending',
        token,
        createdAt: serverTimestamp(),
      });

      // 2. Criar trava técnica para evitar overbooking atômico
      transaction.set(lockRef, {
        professionalId: appointmentData.professionalId,
        date: appointmentData.date,
        time: appointmentData.time,
        appointmentId: apptRef.id,
        createdAt: serverTimestamp()
      });

      return { bookingId: apptRef.id, token };
    });

    console.log('[Booking] Request created:', result.bookingId);
    
    // Trigger notification
    await notify('NEW_BOOKING_REQUEST', {
      appointmentId: result.bookingId,
      token: result.token,
      ...appointmentData
    });
    
    return { bookingId: result.bookingId, token: result.token };
  } catch (error: any) {
    if (error.message === 'Horário indisponível') {
      throw error;
    }
    console.error('[Booking] Failed to create request:', error);
    handleFirestoreError(error, OperationType.CREATE, 'appointments');
    throw error;
  }
}

/**
 * Standardized function to update appointment status with transition validation.
 * Manages the logic for freeing slots and notifications.
 */
export async function updateAppointmentStatus(appointmentId: string, newStatus: Appointment['status']) {
  console.log(`[Status] Transitioning ${appointmentId} to ${newStatus}...`);
  
  try {
    const result = await runTransaction(db, async (transaction) => {
      const apptRef = doc(db, 'appointments', appointmentId);
      const apptDoc = await transaction.get(apptRef);
      
      if (!apptDoc.exists()) throw new Error('Agendamento não encontrado');
      
      const data = apptDoc.data() as Appointment;
      const currentStatus = data.status;

      // 1. Validate Transitions
      const allowedTransitions: Record<string, string[]> = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['completed', 'cancelled'],
        'completed': [],
        'cancelled': []
      };

      if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
        throw new Error(`Transição de ${currentStatus} para ${newStatus} não permitida`);
      }

      // 2. Logic for Blocked Slots
      const slotId = `${data.date}_${data.time}`;
      const slotRef = doc(db, 'blocked_slots', `${data.professionalId}_${slotId}`);

      if (newStatus === 'confirmed') {
        // Before confirming, check if the slot was already blocked by another confirmed appointment
        const slotSnap = await transaction.get(slotRef);
        if (slotSnap.exists()) {
          throw new Error('Este horário já foi preenchido por outra confirmação.');
        }

        // Create permanent lock
        transaction.set(slotRef, {
          professionalId: data.professionalId,
          date: data.date,
          time: data.time,
          appointmentId: appointmentId,
          isPending: false,
          updatedAt: serverTimestamp()
        });
      } else if (newStatus === 'cancelled') {
        // Free the slot
        transaction.delete(slotRef);
      } else if (newStatus === 'completed') {
        // Ensure the slot remains blocked even after completion 
        // to maintain its "occupied" state for that specific date/time.
        transaction.set(slotRef, { 
          isPending: false,
          status: 'completed',
          updatedAt: serverTimestamp() 
        }, { merge: true });
      }

      // 3. Update Appointment
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      if (newStatus === 'confirmed') updateData.confirmedAt = serverTimestamp();
      if (newStatus === 'cancelled') updateData.cancelledAt = serverTimestamp();
      if (newStatus === 'completed') updateData.completedAt = serverTimestamp();

      transaction.update(apptRef, updateData);
      
      return data; // Return original data for notifications
    });

    console.log(`[Status] Successfully updated to ${newStatus}`);
    
    // 4. Notifications
    const notificationMap: Record<string, string> = {
      'confirmed': 'BOOKING_CONFIRMED',
      'cancelled': 'BOOKING_CANCELLED',
      'completed': 'BOOKING_COMPLETED'
    };

    if (notificationMap[newStatus]) {
      notify(notificationMap[newStatus], result);
    }

    // Trigger waitlist check if cancelled
    if (newStatus === 'cancelled') {
      triggerWaitlistCheck(result.professionalId, result.date, result.time);
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('[Status] Update failed:', error);
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
 * DEPRECATED: Use updateAppointmentStatus instead.
 */
export async function cancelBooking(appointmentId: string) {
  return updateAppointmentStatus(appointmentId, 'cancelled');
}

/**
 * High-precision management functions for CLIENTS
 */

export async function confirmPresenceByClient(appointmentId: string) {
  console.log(`[Client] Confirming presence for ${appointmentId}`);
  const apptRef = doc(db, 'appointments', appointmentId);
  await updateDoc(apptRef, {
    clientConfirmedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastChangeBy: 'client',
    changeMessage: 'Cliente confirmou presença'
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
      const slotId = `${data.date}_${data.time}`;
      const slotRef = doc(db, 'blocked_slots', `${data.professionalId}_${slotId}`);

      // Free the slot
      transaction.delete(slotRef);

      // Update appointment
      transaction.update(apptRef, {
        status: 'cancelled',
        cancellationReason: reason || 'Cancelado pelo cliente',
        updatedAt: serverTimestamp(),
        cancelledAt: serverTimestamp(),
        lastChangeBy: 'client',
        changeMessage: 'Cliente cancelou a reserva'
      });

      return data;
    });

    // Notify pro about cancellation
    notify('BOOKING_CANCELLED_BY_CLIENT', { id: appointmentId, ...data });

    // Trigger waitlist check
    triggerWaitlistCheck(data.professionalId, data.date, data.time);
  } catch (error) {
    console.error('[Client Cancel] Failed:', error);
    throw error;
  }
}

export async function getAppointmentByToken(token: string): Promise<Appointment | null> {
  console.log(`[Firestore] Fetching appointment by token...`);
  const q = query(collection(db, 'appointments'), where('token', '==', token));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Appointment;
}

export async function rescheduleBookingByClient(appointmentId: string, newDate: string, newTime: string) {
  console.log(`[Client] Rescheduling ${appointmentId} to ${newDate} ${newTime}`);
  try {
    const data = await runTransaction(db, async (transaction) => {
      const apptRef = doc(db, 'appointments', appointmentId);
      const apptDoc = await transaction.get(apptRef);
      if (!apptDoc.exists()) throw new Error('Agendamento não encontrado');
      
      const data = apptDoc.data() as Appointment;
      
      // 1. Verify new slot
      const newSlotId = `${newDate}_${newTime}`;
      const newSlotRef = doc(db, 'blocked_slots', `${data.professionalId}_${newSlotId}`);
      const newSlotSnap = await transaction.get(newSlotRef);
      
      if (newSlotSnap.exists()) {
        throw new Error('Horário indisponível');
      }

      // 2. Free old slot
      const oldSlotId = `${data.date}_${data.time}`;
      const oldSlotRef = doc(db, 'blocked_slots', `${data.professionalId}_${oldSlotId}`);
      transaction.delete(oldSlotRef);

      // 3. Block new slot
      transaction.set(newSlotRef, {
        professionalId: data.professionalId,
        date: newDate,
        time: newTime,
        appointmentId: appointmentId,
        isPending: data.status === 'pending',
        updatedAt: serverTimestamp()
      });

      // 4. Update appointment
      transaction.update(apptRef, {
        date: newDate,
        time: newTime,
        previousDate: data.date,
        previousTime: data.time,
        rescheduledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastChangeBy: 'client',
        changeMessage: `Cliente reagendou de ${data.date.split('-').reverse().join('/')} para ${newDate.split('-').reverse().join('/')}`
      });

      return data;
    });

    // Notify pro about reschedule
    notify('BOOKING_RESCHEDULED_BY_CLIENT', { id: appointmentId, ...data });
    
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
