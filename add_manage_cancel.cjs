const fs = require('fs');
let c = fs.readFileSync('server/routes/bookingRoutes.ts', 'utf-8');

if (!c.includes('/public/manage/:manageSlug/cancel')) {
  const code = `
// --- NEW: CANCEL BY CLIENT VIA MANAGE SLUG ---
router.post("/public/manage/:manageSlug/cancel", async (req: express.Request, res: express.Response) => {
  const db = getDb();
  const { manageSlug } = req.params;
  const { reason } = req.body;

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 1. Validate slug
      const linkRef = db.collection('reservation_links').doc(manageSlug);
      const linkDoc = await transaction.get(linkRef);
      
      if (!linkDoc.exists) {
        throw { status: 404, message: "Link de gerenciamento inválido." };
      }
      
      const appointmentId = linkDoc.data()?.appointmentId;
      if (!appointmentId) throw { status: 404, message: "Reserva não encontrada no link." };

      const apptRef = db.collection('appointments').doc(appointmentId);
      const apptDoc = await transaction.get(apptRef);

      if (!apptDoc.exists) throw { status: 404, message: "Reserva não encontrada." };
      const data: any = apptDoc.data();

      if (['cancelled', 'cancelled_by_client', 'cancelled_by_professional'].includes(data.status)) {
        throw { status: 400, message: "Reserva já está cancelada." };
      }

      // 1. READS for Lock
      let shouldDeleteLock = false;
      let deleteLockRef: admin.firestore.DocumentReference | null = null;
      
      const lockId = getBookingLockId(data);
      if (lockId) {
        deleteLockRef = db.collection('booking_locks').doc(lockId);
        const lockSnap = await transaction.get(deleteLockRef);
        if (lockSnap.exists) {
           if (lockSnap.data()?.appointmentId === appointmentId) {
             shouldDeleteLock = true;
           } else {
             console.log(\`[LOCK CLEANUP] Lock \${lockId} belongs to another appt; skipping delete\`);
           }
        }
      }

      // Read Client Summary
      const clientKey = getClientKey(data.clientWhatsapp, data.clientEmail, data.clientName);
      const summaryId = \`\${data.professionalId}_\${clientKey}\`;
      const summaryRef = db.collection('client_summaries').doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);

      // 2. WRITES
      if (shouldDeleteLock && deleteLockRef) {
        transaction.delete(deleteLockRef);
        console.log(\`[LOCK CLEANUP] deleted lock \${lockId} for appt \${appointmentId}\`);
      }

      const updatePayload: any = {
        status: "cancelled_by_client",
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        cancellationReason: reason || 'Cancelado pelo cliente',
        lastChangeBy: 'client',
        changeMessage: 'Cliente cancelou a reserva'
      };
      
      const safeUpdate = sanitizeAppointment(updatePayload, true);

      transaction.update(apptRef, safeUpdate);
      
      const updatedData = { ...data, ...safeUpdate };
      await updateClientSummaryInternal(transaction, updatedData, data.professionalId, false, data.status, summarySnap);

      return { success: true, appointmentId };
    });

    console.log(\`[CANCEL BY CLIENT] SUCCESS via slug \${manageSlug}\`);
    return res.json(result);
  } catch (err: any) {
    const status = err.status || 500;
    const message = err.message || "Erro interno do servidor";
    console.error(\`[CANCEL BY CLIENT ERROR]\`, err);
    return res.status(status).json({ error: message });
  }
});
`;
  c = c.replace('export default router;', code + '\nexport default router;');
  fs.writeFileSync('server/routes/bookingRoutes.ts', c);
  console.log('Added manageSlug cancel route');
}
