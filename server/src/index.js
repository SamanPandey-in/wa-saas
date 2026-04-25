import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { requireApiKey } from './middleware/auth.js';

import contactsRouter from './routes/contacts.js';
import importRouter from './routes/import.js';
import messagesRouter from './routes/messages.js';
import sendRouter from './routes/send.js';
import webhookRouter from './routes/webhook.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(morgan('dev'));
app.use(express.json());

// Webhook stays PUBLIC — Meta posts here without your key
app.use('/api/webhook', webhookRouter);

// Everything else requires the key
app.use('/api', requireApiKey);
app.use('/api/contacts', contactsRouter);
app.use('/api/import', importRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/send', sendRouter);

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});