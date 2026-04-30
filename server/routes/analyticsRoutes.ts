import express from 'express';
export const analyticsRouter = express.Router();
analyticsRouter.get("/", (req, res) => res.json({ msg: "Analytics Placeholder" }));
