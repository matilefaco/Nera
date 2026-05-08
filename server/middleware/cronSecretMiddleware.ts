import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

export const requireCronSecret = (req: Request, res: Response, next: NextFunction) => {
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers['x-cron-secret'];

  if (!cronSecret || !providedSecret || providedSecret !== cronSecret) {
    logger.warn("CRON", "Unauthorized cron execution attempt missing or invalid secret");
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};
