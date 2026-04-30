import express from 'express';
import { getDb } from '../firebaseAdmin.js';

export const slugRouter = express.Router();

slugRouter.get("/check", async (req, res) => {
  const { slug } = req.query;
  
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: "Slug inválido" });
  }

  const db = getDb();
  try {
    const slugRef = db.collection('appointment_slugs').doc(slug.toLowerCase());
    const snap = await slugRef.get();
    
    if (!snap.exists) {
      return res.status(404).json({ error: "Reserva não encontrada" });
    }

    return res.status(200).json(snap.data());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
