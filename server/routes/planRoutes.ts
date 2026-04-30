import express from 'express';
export const planRouter = express.Router();

planRouter.post("/webhook", async (req, res) => {
  // Stripe webhook without verification as requested for now
  console.log("Stripe webhook received:", req.body);
  res.status(200).send("OK");
});
