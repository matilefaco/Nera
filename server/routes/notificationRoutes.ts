import express from 'express';
export const notificationRouter = express.Router();
notificationRouter.get("/", (req, res) => res.json({ msg: "Notification Placeholder" }));
