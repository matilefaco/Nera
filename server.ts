import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { sendNewBookingEmail } from "./src/services/emailService.ts";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  /**
   * Notification Endpoint
   * Handles sending real emails via Resend.
   */
  app.post("/api/notify", async (req, res) => {
    const { type, payload } = req.body;
    
    console.log(`[Notification Service] Processing ${type}...`);
    
    try {
      if (type === 'NEW_BOOKING_REQUEST') {
        const { professionalId, clientName, serviceName, date, time, locationType, neighborhood, totalPrice, appointmentId } = payload;
        
        console.log(`[Booking] New request detected for professional: ${professionalId}`);

        // 1. Fetch professional email from Firestore
        const userDoc = await db.collection('users').doc(professionalId).get();
        if (!userDoc.exists) {
          throw new Error(`Professional ${professionalId} not found`);
        }
        
        const professionalData = userDoc.data();
        const professionalEmail = professionalData?.email;

        if (!professionalEmail) {
          throw new Error(`Professional ${professionalId} has no email configured`);
        }

        // 2. Format location
        const location = locationType === 'home' ? `Domicílio (${neighborhood})` : 'Estúdio / Local Fixo';

        // 3. Send real email
        console.log(`[Email] Sending real notification to ${professionalEmail}`);
        await sendNewBookingEmail({
          clientName,
          serviceName,
          date,
          time,
          location,
          totalPrice: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPrice || 0),
          professionalEmail,
          bookingId: appointmentId
        });

        console.log(`[Email] Send success for booking ${appointmentId}`);
        
        return res.json({ 
          success: true, 
          message: "Email notification sent successfully via Resend."
        });
      }

      // Fallback for other types (can be implemented later)
      console.log(`[Notification Service] Type ${type} not explicitly handled yet, but acknowledged.`);
      res.json({ success: true, message: "Notification acknowledged." });

    } catch (error: any) {
      console.error(`[Notification Service] ERROR:`, error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
