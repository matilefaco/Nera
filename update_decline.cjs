const fs = require('fs');
let c = fs.readFileSync('server/routes/bookingRoutes.ts', 'utf-8');

c = c.replace(/router\.post\("\/appointments\/:appointmentId\/decline", requireFirebaseAuth, async \(req: AuthenticatedRequest, res: express\.Response\) => \{[\s\S]*?\/\/ 2\. WRITES[\s\S]*?const updatePayload: any = \{/g, 
`router.post("/appointments/:appointmentId/decline", requireFirebaseAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  const db = getDb();
  const { appointmentId } = req.params;
  const uid = req.uid;

  console.log(\`[DECLINE ENDPOINT] Starting decline for \${appointmentId} by uid \${uid}\`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const apptRef = db.collection('appointments').doc(appointmentId);
      const apptDoc = await transaction.get(apptRef);

      if (!apptDoc.exists) throw { status: 404, message: "Reserva não encontrada." };
      const data: any = apptDoc.data();

      if (data.professionalId !== uid) {
        throw { status: 403, message: "Você não tem permissão." };
      }

      if (data.status !== 'pending') {
        throw { status: 400, message: \`Transição de \${data.status} para recusada não permitida.\` };
      }

      // IMPORTANTE: Firestore transactions exigem todos os reads antes dos writes.
      // 1. READS
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
             console.log(\`[LOCK CLEANUP] Lock \${lockId} belongs to another appointment; skipping delete\`);
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
        console.log(\`[LOCK CLEANUP] deleted lock \${lockId} for appointment \${appointmentId}\`);
      }

      const updatePayload: any = {`);

fs.writeFileSync('server/routes/bookingRoutes.ts', c);
console.log('updated decline');
