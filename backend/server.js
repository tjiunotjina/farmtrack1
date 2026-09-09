import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import syncRoutes from './routes/sync.js';
import registerResourceRoutes from './routes/resources.js';

const app = express();
app.use(cors());
app.use(express.json());

await initDb();

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
registerResourceRoutes(app);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Routes call next(err) on failure (see routes/*.js) instead of letting a
// rejected promise crash the process — this is what actually turns those
// into a clean JSON response.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Orutumbo API listening on :${PORT}`));
