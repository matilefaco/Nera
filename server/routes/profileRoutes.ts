import express from 'express';
export const profileRouter = express.Router();
profileRouter.get("/", (req, res) => res.json({ msg: "Profile Placeholder" }));
