import { Request, Response, NextFunction } from "express";
import admin from "firebase-admin";
import { logger } from "../utils/logger.js";
import { getDb } from "../firebaseAdmin.js";

export interface AuthenticatedRequest extends Request {
  uid?: string;
  user?: admin.auth.DecodedIdToken;
  userData?: any; // To allow downstream handlers to reuse the fetched user doc
}

export const requireFirebaseAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Autenticação necessária." });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    
    // Controlled user read to validate operational status
    const db = getDb();
    const userDoc = await db.collection("users").doc(uid).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data() || {};
      const status = userData.accountStatus;
      
      // Bloquear accountStatus perigoso
      if (status === 'scheduled_for_deletion' || status === 'deleted' || status === 'disabled') {
        logger.warn("AUTH", "Acesso rejeitado: conta desativada ou em exclusão.", { uid, status });
        return res.status(403).json({ error: "Acesso negado. Sua conta está desativada ou em processo de exclusão." });
      }
      
      req.userData = userData;
    }

    req.uid = uid;
    req.user = decodedToken;
    next();
  } catch (error) {
    logger.error("AUTH", "Auth Middleware Error", { error });
    return res.status(401).json({ error: "Token de autenticação inválido ou expirado." });
  }
};
