import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, browserPopupRedirectResolver, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, updateDoc, collection, addDoc, serverTimestamp, runTransaction, getDoc, setDoc, deleteDoc, query, where, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import { UserProfile, Appointment, PortfolioItem } from './types';
import { removeEmptyFields } from './lib/utils';

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
 */
export async function createBookingRequest(appointmentData: Partial<Appointment>) {
  console.log('[Booking] Creating request...');
  
  // Clean data before saving
  const cleanedData = removeEmptyFields(appointmentData);
  
  try {
    const docRef = await addDoc(collection(db, 'appointments'), {
      ...cleanedData,
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
    });
    
    console.log('[Booking] Request created:', docRef.id);
    
    // Trigger notification
    await notify('NEW_BOOKING_REQUEST', {
      appointmentId: docRef.id,
      ...cleanedData
    });
    
    return docRef.id;
  } catch (error) {
    console.error('[Booking] Failed to create request:', error);
    handleFirestoreError(error, OperationType.CREATE, 'appointments');
  }
}

/**
 * Responds to a booking request (Confirm/Decline) with transaction for consistency.
 */
export async function respondToBookingRequest(appointmentId: string, decision: 'confirmed' | 'declined') {
  console.log(`[Booking] Responding to ${appointmentId} with ${decision}...`);
  
  try {
    await runTransaction(db, async (transaction) => {
      const apptRef = doc(db, 'appointments', appointmentId);
      const apptDoc = await transaction.get(apptRef);
      
      if (!apptDoc.exists()) throw new Error('Agendamento não encontrado');
      
      const data = apptDoc.data();
      if (data.status !== 'pending') {
        throw new Error(`Este agendamento já foi ${data.status === 'confirmed' ? 'confirmado' : 'recusado'}`);
      }

      if (decision === 'confirmed') {
        // Check if slot is already blocked
        const slotId = `${data.date}_${data.time}`;
        const slotRef = doc(db, 'blocked_slots', `${data.professionalId}_${slotId}`);
        const slotDoc = await transaction.get(slotRef);
        
        if (slotDoc.exists()) {
          throw new Error('Este horário já foi preenchido por outro agendamento');
        }

        // Block slot
        transaction.set(slotRef, {
          professionalId: data.professionalId,
          date: data.date,
          time: data.time,
          appointmentId: appointmentId,
          createdAt: serverTimestamp()
        });

        // Update appointment
        transaction.update(apptRef, {
          status: 'confirmed',
          confirmedAt: serverTimestamp()
        });
      } else {
        // Update appointment to declined
        transaction.update(apptRef, {
          status: 'declined',
          declinedAt: serverTimestamp()
        });
      }
    });

    console.log('[Booking] Transaction successful');
    
    // Notify client (async, don't block)
    const apptDoc = await getDoc(doc(db, 'appointments', appointmentId));
    const data = apptDoc.data();
    notify(decision === 'confirmed' ? 'BOOKING_CONFIRMED' : 'BOOKING_DECLINED', data);
    
    return { success: true };
  } catch (error: any) {
    console.error('[Booking] Response failed:', error);
    throw error;
  }
}
