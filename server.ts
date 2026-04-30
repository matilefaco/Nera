import express from 'express';
import cors from 'cors';
import { bookingRouter } from './server/routes/bookingRoutes.js';
import { planRouter } from './server/routes/planRoutes.js';
import * as firebaseAdmin from './server/firebaseAdmin.js';

const app = express();
const port = 3000;

// 1. SIMPLEST BODY PARSER - As requested by user
app.use(express.json());

// 2. CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// Initialize Firebase
firebaseAdmin.initFirebase();

// Routes
app.use('/api/public', bookingRouter);
app.use('/api/plans', planRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export default app;
