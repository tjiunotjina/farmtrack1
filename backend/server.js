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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`FarmTrack API listening on :${PORT}`));
