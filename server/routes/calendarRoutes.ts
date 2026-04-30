import express from 'express';
export const calendarRouter = express.Router();
calendarRouter.get("/", (req, res) => res.json({ msg: "Calendar Placeholder" }));
