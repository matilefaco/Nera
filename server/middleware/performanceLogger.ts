import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

export function performanceLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (duration > 1500) {
      logger.warn("SERVER", "Slow request detected", {
        meta: {
          method: req.method,
          route: req.originalUrl,
          status: res.statusCode,
          durationMs: duration,
        },
        requestId: req.requestId
      });
    }
  });

  next();
}
