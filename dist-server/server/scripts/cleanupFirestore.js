import { initFirebase, getDb } from '../firebaseAdmin.js';
import * as admin from 'firebase-admin';
// Configuration
const BATCH_SIZE = 500;
const APPLY = process.env.CLEANUP_APPLY === 'true';
async function main() {
    await initFirebase();
    const db = getDb();
    if (!db) {
        console.error('[CLEANUP] Firestore could not be initialized.');
        process.exit(1);
    }
    console.log(`[CLEANUP] Starting audit/cleanup script...`);
    console.log(`[CLEANUP] APPLY MODE: ${APPLY ? 'ON (DELETING)' : 'OFF (DRY RUN)'}`);
    const now = Date.now();
    let totalDeleted = 0;
    let totalUpdated = 0;
    // Helper method for batch deleting
    async function cleanupCollection(collectionName, queryDescriptor, queryFn) {
        console.log(`\n[CLEANUP] Auditing: ${collectionName} (${queryDescriptor})`);
        let deletedCount = 0;
        const ref = db.collection(collectionName);
        const query = queryFn(ref);
        const snapshot = await query.get();
        if (snapshot.empty) {
            console.log(`[CLEANUP] No matching documents found in ${collectionName}.`);
            return;
        }
        console.log(`[CLEANUP][DRY_RUN] Found ${snapshot.size} documents to delete in ${collectionName}.`);
        if (APPLY) {
            console.log(`[CLEANUP][APPLY] Deleting ${snapshot.size} documents...`);
            let batch = db.batch();
            let operations = 0;
            for (const doc of snapshot.docs) {
                batch.delete(doc.ref);
                operations++;
                deletedCount++;
                if (operations === BATCH_SIZE) {
                    await batch.commit();
                    batch = db.batch();
                    operations = 0;
                }
            }
            if (operations > 0) {
                await batch.commit();
            }
            console.log(`[CLEANUP][APPLY] Deleted ${deletedCount} documents from ${collectionName}.`);
        }
        else {
            deletedCount = snapshot.size;
        }
        totalDeleted += deletedCount;
    }
    async function updatePendingAppointments() {
        console.log(`\n[CLEANUP][PENDING] Auditing: appointments (pending and older than 24h)`);
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
        const ref = db.collection('appointments');
        const snapshot = await ref.where('status', '==', 'pending').get();
        let toExpire = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            let createdAtMs = 0;
            if (data.createdAt) {
                createdAtMs = data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
            }
            if (createdAtMs > 0 && createdAtMs < oneDayAgo.getTime()) {
                toExpire.push(doc);
            }
            else if (!data.createdAt) {
                // fallback if no createdAt, try to parse date+time and check if more than 24h past
                // This is a safety check.
            }
        });
        if (toExpire.length === 0) {
            console.log(`[CLEANUP] No pending appointments to expire.`);
            return;
        }
        console.log(`[CLEANUP][DRY_RUN] Found ${toExpire.length} pending appointments older than 24h.`);
        if (APPLY) {
            console.log(`[CLEANUP][APPLY] Expiring ${toExpire.length} appointments...`);
            let batch = db.batch();
            let operations = 0;
            for (const doc of toExpire) {
                batch.update(doc.ref, { status: 'expired', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                if (doc.data().lockId) {
                    const lockRef = db.collection('booking_locks').doc(doc.data().lockId);
                    batch.delete(lockRef);
                    operations++;
                }
                operations++;
                totalUpdated++;
                if (operations >= BATCH_SIZE - 1) {
                    await batch.commit();
                    batch = db.batch();
                    operations = 0;
                }
            }
            if (operations > 0) {
                await batch.commit();
            }
            console.log(`[CLEANUP][APPLY] Expired ${toExpire.length} appointments and released ${totalUpdated} locks.`);
        }
        else {
            totalUpdated += toExpire.length;
        }
    }
    // 1. analytics_events: older than 90 days
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
    await cleanupCollection('analytics_events', 'older than 90 days', (ref) => ref.where('createdAt', '<', ninetyDaysAgo));
    // 2. alerts/notifications: read === true AND older than 30 days
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    // Only filtering locally or if indexes permit.
    async function cleanupAlerts() {
        console.log(`\n[CLEANUP] Auditing: alerts (read and > 30 days)`);
        const ref = db.collection('alerts');
        const snap = await ref.where('read', '==', true).get();
        let toDelete = [];
        snap.docs.forEach(doc => {
            const data = doc.data();
            const created = data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime()) : 0;
            if (created > 0 && created < thirtyDaysAgo.getTime()) {
                toDelete.push(doc);
            }
        });
        if (toDelete.length > 0) {
            console.log(`[CLEANUP][DRY_RUN] Found ${toDelete.length} old read alerts.`);
            if (APPLY) {
                let batch = db.batch();
                let ops = 0;
                for (const d of toDelete) {
                    batch.delete(d.ref);
                    ops++;
                    totalDeleted++;
                    if (ops === BATCH_SIZE) {
                        await batch.commit();
                        batch = db.batch();
                        ops = 0;
                    }
                }
                if (ops > 0)
                    await batch.commit();
                console.log(`[CLEANUP][APPLY] Deleted ${toDelete.length} alerts.`);
            }
            else {
                totalDeleted += toDelete.length;
            }
        }
        else {
            console.log(`[CLEANUP] No old read alerts.`);
        }
    }
    await cleanupAlerts();
    async function cleanupNotifications() {
        console.log(`\n[CLEANUP] Auditing: notifications (read and > 30 days)`);
        const ref = db.collection('notifications');
        const snap = await ref.where('read', '==', true).get();
        let toDelete = [];
        snap.docs.forEach(doc => {
            const data = doc.data();
            const created = data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime()) : 0;
            if (created > 0 && created < thirtyDaysAgo.getTime()) {
                toDelete.push(doc);
            }
        });
        if (toDelete.length > 0) {
            console.log(`[CLEANUP][DRY_RUN] Found ${toDelete.length} old read notifications.`);
            if (APPLY) {
                let batch = db.batch();
                let ops = 0;
                for (const d of toDelete) {
                    batch.delete(d.ref);
                    ops++;
                    totalDeleted++;
                    if (ops === BATCH_SIZE) {
                        await batch.commit();
                        batch = db.batch();
                        ops = 0;
                    }
                }
                if (ops > 0)
                    await batch.commit();
                console.log(`[CLEANUP][APPLY] Deleted ${toDelete.length} notifications.`);
            }
            else {
                totalDeleted += toDelete.length;
            }
        }
        else {
            console.log(`[CLEANUP] No old read notifications.`);
        }
    }
    await cleanupNotifications();
    // 3. review_requests: pending ONLY AND older than 30 days
    async function cleanupReviewRequests() {
        console.log(`\n[CLEANUP] Auditing: review_requests (pending > 30 days)`);
        const ref = db.collection('review_requests');
        const snap = await ref.where('status', '==', 'pending').get();
        let toDelete = [];
        snap.docs.forEach(doc => {
            const data = doc.data();
            const created = data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime()) : 0;
            if (created > 0 && created < thirtyDaysAgo.getTime()) {
                toDelete.push(doc);
            }
        });
        if (toDelete.length === 0) {
            console.log(`[CLEANUP] No old pending review requests found.`);
            return;
        }
        console.log(`[CLEANUP][DRY_RUN] Found ${toDelete.length} old pending review requests.`);
        if (APPLY) {
            let batch = db.batch();
            let ops = 0;
            for (const d of toDelete) {
                batch.delete(d.ref);
                ops++;
                totalDeleted++;
                if (ops === BATCH_SIZE) {
                    await batch.commit();
                    batch = db.batch();
                    ops = 0;
                }
            }
            if (ops > 0)
                await batch.commit();
            console.log(`[CLEANUP][APPLY] Deleted ${toDelete.length} review requests.`);
        }
        else {
            totalDeleted += toDelete.length;
        }
    }
    await cleanupReviewRequests();
    // 4. booking_locks: pending > 24h
    async function cleanupBookingLocks() {
        console.log(`\n[CLEANUP][LOCKS] Auditing: booking_locks (orphans or pending > 24h)`);
        const ref = db.collection('booking_locks');
        const snap = await ref.get();
        let toDelete = [];
        const oneDayAgoMs = now - 24 * 60 * 60 * 1000;
        for (const doc of snap.docs) {
            const data = doc.data();
            const expiresAtMs = data.expiresAt ? (data.expiresAt.toMillis ? data.expiresAt.toMillis() : new Date(data.expiresAt).getTime()) : 0;
            let isOrphan = false;
            if (expiresAtMs > 0 && expiresAtMs < now && !data.appointmentId) {
                isOrphan = true;
            }
            if (data.status === 'pending') {
                const created = data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime()) : 0;
                if (created > 0 && created < oneDayAgoMs) {
                    isOrphan = true;
                }
            }
            if (isOrphan) {
                toDelete.push(doc);
            }
        }
        if (toDelete.length === 0) {
            console.log(`[CLEANUP] No orphaned booking locks found.`);
            return;
        }
        console.log(`[CLEANUP][DRY_RUN] Found ${toDelete.length} orphaned booking locks.`);
        if (APPLY) {
            let batch = db.batch();
            let ops = 0;
            for (const d of toDelete) {
                batch.delete(d.ref);
                ops++;
                totalDeleted++;
                if (ops === BATCH_SIZE) {
                    await batch.commit();
                    batch = db.batch();
                    ops = 0;
                }
            }
            if (ops > 0)
                await batch.commit();
            console.log(`[CLEANUP][APPLY] Deleted ${toDelete.length} booking locks.`);
        }
        else {
            totalDeleted += toDelete.length;
        }
    }
    await cleanupBookingLocks();
    // 5. Update Pending Appointments
    await updatePendingAppointments();
    console.log('\n=============================================');
    console.log(`[CLEANUP] Audit Summary:`);
    console.log(`- Documents ${APPLY ? 'Deleted' : 'Would Delete'}: ${totalDeleted}`);
    console.log(`- Appointments ${APPLY ? 'Expired' : 'Would Expire'}: ${totalUpdated}`);
    if (!APPLY) {
        console.log(`\nRun with CLEANUP_APPLY=true to apply these changes.`);
    }
    console.log('=============================================\n');
    process.exit(0);
}
main().catch(console.error);
