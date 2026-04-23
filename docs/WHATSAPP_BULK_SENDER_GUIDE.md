# 📱 WhatsApp Bulk Message Sender — Complete Implementation Guide

> **Stack**: Node.js + Express · React + Vite + TailwindCSS · PostgreSQL · Meta WhatsApp Business Cloud API  
> **No third-party integrations** — only Meta's official WhatsApp Business Cloud API  
> **Deployable**: Local or Render.com

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack & Why](#2-tech-stack--why)
3. [Meta WhatsApp Business API Setup](#3-meta-whatsapp-business-api-setup)
4. [Phase 1 — Project Scaffolding](#phase-1--project-scaffolding)
5. [Phase 2 — PostgreSQL Schema & Connection](#phase-2--postgresql-schema--connection)
6. [Phase 3 — Spreadsheet Import / Contact Seeding](#phase-3--spreadsheet-import--contact-seeding)
7. [Phase 4 — WhatsApp API Integration (Backend)](#phase-4--whatsapp-api-integration-backend)
8. [Phase 5 — REST API Endpoints](#phase-5--rest-api-endpoints)
9. [Phase 6 — React Dashboard (Frontend)](#phase-6--react-dashboard-frontend)
10. [Phase 7 — Bulk Send Feature](#phase-7--bulk-send-feature)
11. [Phase 8 — Deployment on Render](#phase-8--deployment-on-render)
12. [Full File Structure](#full-file-structure)
13. [Environment Variables Reference](#environment-variables-reference)
14. [Troubleshooting](#troubleshooting)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                            │
│                                                                  │
│   React Dashboard (Vite)                                         │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  📊 Contacts Table  │  📤 Bulk Send  │  📋 Message Logs  │   │
│   └────────────────────────────┬────────────────────────────┘   │
└────────────────────────────────│────────────────────────────────┘
                                 │ HTTP (REST)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Node.js / Express API                        │
│                                                                  │
│   /api/contacts   →  CRUD for contacts                           │
│   /api/import     →  Parse spreadsheet → seed DB                 │
│   /api/messages   →  Message templates + logs                    │
│   /api/send       →  Trigger bulk send                           │
│   /api/webhook    →  Receive delivery receipts from Meta         │
└───────────────┬────────────────────────────────┬────────────────┘
                │                                │
                ▼                                ▼
┌──────────────────────┐          ┌──────────────────────────────┐
│   PostgreSQL DB       │          │  Meta WhatsApp Cloud API     │
│                       │          │  graph.facebook.com/v19.0    │
│  contacts             │          │                              │
│  messages             │          │  POST /messages              │
│  message_logs         │          │  Webhooks → /api/webhook     │
└──────────────────────┘          └──────────────────────────────┘
```

### Data Flow

1. **Import**: User uploads `.xlsx` or `.csv` → backend parses → inserts into `contacts` table  
2. **Send**: User clicks "Bulk Send" on dashboard with a message → backend loops through contacts → calls Meta API per contact → logs each send in `message_logs`  
3. **Webhooks**: Meta sends delivery/read receipts → backend updates `message_logs`  
4. **Dashboard**: React polls/fetches contacts and logs, shows real-time send status

---

## 2. Tech Stack & Why

| Layer | Technology | Reason |
|---|---|---|
| Backend | **Node.js + Express** | Fastest iteration for REST APIs, excellent `node-postgres` support |
| Database | **PostgreSQL** | Relational, perfect for contacts + logs + status tracking |
| DB Client | **node-postgres (pg)** | Native, no ORM overhead, full control |
| File Parsing | **xlsx** (SheetJS) + **csv-parser** | Handles both Excel and CSV import natively |
| Frontend | **React + Vite** | Fast HMR, modern build tooling |
| Styling | **TailwindCSS** | Utility-first, fast to build dashboards |
| WhatsApp | **Meta WhatsApp Business Cloud API** | Official, free tier, no third-party needed |
| Deployment | **Render.com** | Free tier supports Node + PostgreSQL managed DB |

---

## 3. Meta WhatsApp Business API Setup

> This is the most important prerequisite. Complete this before writing any code.

### Step 3.1 — Create a Meta Developer Account

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **My Apps → Create App**
3. Choose **"Business"** app type
4. Fill in app name (e.g. `wa-saas`) and contact email

### Step 3.2 — Add WhatsApp Product

1. In your app dashboard, click **"Add Product"**
2. Find **"WhatsApp"** → click **"Set Up"**
3. You'll be taken to **WhatsApp → Getting Started**

### Step 3.3 — Get Your Credentials

From the **WhatsApp → Getting Started** panel, copy:

| Variable | Where to find it |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | "Phone number ID" (not the phone number itself) |
| `WHATSAPP_ACCESS_TOKEN` | "Temporary access token" (valid 24h) or generate permanent below |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | "WhatsApp Business Account ID" |

### Step 3.4 — Generate a Permanent Token

1. Go to [business.facebook.com/settings](https://business.facebook.com/settings)
2. **System Users → Add System User** (name it `wa-bulk-api`, role: Admin)
3. **Generate Token** → select your app → tick `whatsapp_business_messaging`, `whatsapp_business_management`
4. Copy the long-lived token — this is your `WHATSAPP_ACCESS_TOKEN`

### Step 3.5 — Add a Real Phone Number (Production)

> For testing, Meta gives you a free test number with 5 recipient limits.

1. **WhatsApp → Phone Numbers → Add Phone Number**
2. Verify via SMS or voice call
3. Submit for **"Display Name"** review (takes 1–3 days)

### Step 3.6 — Create a Message Template

WhatsApp Business API **requires pre-approved templates** for outbound messages to people who haven't messaged you first in 24h.

1. Go to **WhatsApp → Message Templates → Create Template**
2. Category: **Marketing** or **Utility**
3. Name: `bulk_promo` (lowercase, underscores only)
4. Language: **English**
5. Body example:
   ```
   Hello {{1}}, this is a message from {{2}}. {{3}}
   ```
6. Submit for review — usually approved in minutes for utility templates

> **Note**: For the bulk send, you'll reference this template by name. The variables `{{1}}`, `{{2}}`, `{{3}}` map to values you pass per contact.

### Step 3.7 — Configure Webhook

1. In your app, go to **WhatsApp → Configuration**
2. Set **Webhook URL**: `https://your-api.onrender.com/api/webhook`
3. Set **Verify Token**: any random string (save it as `WEBHOOK_VERIFY_TOKEN` in your env)
4. Subscribe to: `messages`

---

## Phase 1 — Project Scaffolding

### Step 1.1 — Initialize Monorepo Structure

```bash
mkdir wa-saas
cd wa-saas
git init
```

Create the following folder layout:

```
wa-saas/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   ├── routes/
│   │   ├── services/
│   │   └── index.js
│   ├── .env
│   ├── package.json
│   └── .gitignore
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

### Step 1.2 — Backend package.json

```bash
cd backend
npm init -y
npm install express pg dotenv multer xlsx csv-parser cors helmet morgan uuid
npm install --save-dev nodemon
```

Create `backend/package.json` scripts section:

```json
{
  "name": "wa-saas-backend",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "csv-parser": "^3.0.0",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "multer": "^1.4.5-lts.1",
    "pg": "^8.11.5",
    "uuid": "^9.0.1",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

### Step 1.3 — Frontend Setup

```bash
cd ../frontend
npm create vite@latest . -- --template react
npm install
npm install axios react-router-dom @tanstack/react-query
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

`frontend/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          900: '#14532d',
        }
      }
    },
  },
  plugins: [],
}
```

`frontend/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 1.4 — Backend Entry Point

`backend/src/index.js`:

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const contactsRouter = require('./routes/contacts');
const importRouter = require('./routes/import');
const messagesRouter = require('./routes/messages');
const sendRouter = require('./routes/send');
const webhookRouter = require('./routes/webhook');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/contacts', contactsRouter);
app.use('/api/import', importRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/send', sendRouter);
app.use('/api/webhook', webhookRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
```

### Step 1.5 — Root .gitignore

```
node_modules/
.env
*.env
dist/
.DS_Store
uploads/
```

---

## Phase 2 — PostgreSQL Schema & Connection

### Step 2.1 — Run PostgreSQL Locally

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
psql postgres
```

**Ubuntu/Linux:**
```bash
sudo apt update && sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres psql
```

**Windows:** Download from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)

### Step 2.2 — Create the Database

```sql
CREATE DATABASE wa_saas;
CREATE USER wa_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE wa_saas TO wa_user;
\c wa_saas
GRANT ALL ON SCHEMA public TO wa_user;
```

### Step 2.3 — DB Connection Module

`backend/src/db/index.js`:

```js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB error:', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
```

### Step 2.4 — Schema Migration

`backend/src/db/migrate.js`:

```js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('./index');

async function migrate() {
  console.log('Running migrations...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(255) NOT NULL,
      phone       VARCHAR(30)  NOT NULL UNIQUE,
      email       VARCHAR(255),
      tags        TEXT[],
      opted_in    BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS message_templates (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(255) NOT NULL,
      wa_template_name  VARCHAR(255) NOT NULL,
      language    VARCHAR(20)  NOT NULL DEFAULT 'en_US',
      body_text   TEXT NOT NULL,
      variables   JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS bulk_campaigns (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id   UUID REFERENCES message_templates(id),
      template_vars JSONB,
      total_contacts  INTEGER NOT NULL DEFAULT 0,
      sent_count      INTEGER NOT NULL DEFAULT 0,
      failed_count    INTEGER NOT NULL DEFAULT 0,
      status        VARCHAR(30) NOT NULL DEFAULT 'pending',
      started_at    TIMESTAMPTZ,
      completed_at  TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS message_logs (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id     UUID REFERENCES bulk_campaigns(id),
      contact_id      UUID REFERENCES contacts(id),
      phone           VARCHAR(30) NOT NULL,
      wa_message_id   VARCHAR(255),
      status          VARCHAR(30) NOT NULL DEFAULT 'queued',
      error_msg       TEXT,
      sent_at         TIMESTAMPTZ,
      delivered_at    TIMESTAMPTZ,
      read_at         TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
    CREATE INDEX IF NOT EXISTS idx_logs_campaign   ON message_logs(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_logs_wa_id      ON message_logs(wa_message_id);
  `);

  console.log('✅ Migrations complete');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

Add to `backend/package.json`:
```json
"scripts": {
  "migrate": "node src/db/migrate.js",
  "start": "node src/index.js",
  "dev": "nodemon src/index.js"
}
```

Run:
```bash
npm run migrate
```

### Step 2.5 — Environment File

`backend/.env`:

```env
# Database
DATABASE_URL=postgresql://wa_user:yourpassword@localhost:5432/wa_saas

# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_ACCESS_TOKEN=your_permanent_access_token_here
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id_here
WHATSAPP_API_VERSION=v19.0

# Webhook
WEBHOOK_VERIFY_TOKEN=any_random_secret_string

# App
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

---

## Phase 3 — Spreadsheet Import / Contact Seeding

### Step 3.1 — Multer Upload Config

`backend/src/services/upload.js`:

```js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `import_${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.xlsx', '.xls', '.csv'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only .xlsx, .xls, .csv files allowed'));
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
```

### Step 3.2 — Spreadsheet Parser Service

`backend/src/services/parseSpreadsheet.js`:

```js
const xlsx = require('xlsx');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');

/**
 * Normalize a header key: lowercase, strip spaces/special chars
 */
function normalizeKey(k) {
  return k.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/**
 * Extract a phone number and format it for WhatsApp (E.164)
 * Strips non-digits, ensures leading country code
 */
function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  // If starts with 0, assume local and prepend country code (edit as needed)
  // WhatsApp requires full E.164 without the '+': e.g. 14155552671
  return digits;
}

/**
 * Parse rows into contact objects
 * Expected columns (case-insensitive): name, phone, email, tags
 */
function rowsToContacts(rows) {
  return rows
    .map((row) => {
      const norm = {};
      Object.keys(row).forEach((k) => {
        norm[normalizeKey(k)] = row[k];
      });
      const phone = normalizePhone(norm.phone || norm.mobile || norm.number || norm.whatsapp);
      const name = norm.name || norm.full_name || norm.contact_name || 'Unknown';
      const email = norm.email || norm.email_address || null;
      const tags = norm.tags
        ? String(norm.tags).split(',').map((t) => t.trim()).filter(Boolean)
        : [];
      if (!phone || phone.length < 7) return null;
      return { name: String(name).trim(), phone, email, tags };
    })
    .filter(Boolean);
}

/**
 * Parse an uploaded file (xlsx or csv) and return contact objects
 */
async function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    return new Promise((resolve, reject) => {
      const rows = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve(rowsToContacts(rows)))
        .on('error', reject);
    });
  }

  // xlsx / xls
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  return rowsToContacts(rows);
}

module.exports = { parseFile };
```

### Step 3.3 — Import Route

`backend/src/routes/import.js`:

```js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const upload = require('../services/upload');
const { parseFile } = require('../services/parseSpreadsheet');
const db = require('../db');

// POST /api/import
// Accepts multipart/form-data with field "file"
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const contacts = await parseFile(req.file.path);

    if (contacts.length === 0) {
      return res.status(422).json({ error: 'No valid contacts found in file. Ensure columns: name, phone' });
    }

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (const c of contacts) {
      try {
        await db.query(
          `INSERT INTO contacts (name, phone, email, tags)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (phone) DO UPDATE SET
             name = EXCLUDED.name,
             email = EXCLUDED.email,
             tags = EXCLUDED.tags,
             updated_at = NOW()`,
          [c.name, c.phone, c.email, c.tags]
        );
        inserted++;
      } catch (err) {
        skipped++;
        errors.push({ phone: c.phone, error: err.message });
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'Import complete',
      total: contacts.length,
      inserted,
      skipped,
      errors: errors.slice(0, 20), // cap error list
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

module.exports = router;
```

### Step 3.4 — Sample Spreadsheet Format

Create a file `sample_contacts.xlsx` or `sample_contacts.csv` with this layout:

```csv
name,phone,email,tags
Alice Johnson,14155552671,alice@example.com,"vip,newsletter"
Bob Smith,447700900123,bob@example.com,newsletter
Carol White,919876543210,,
```

> **Phone format**: Full international digits without `+`. E.g. US: `14155552671`, UK: `447700900123`, India: `919876543210`

---

## Phase 4 — WhatsApp API Integration (Backend)

### Step 4.1 — WhatsApp Service

`backend/src/services/whatsapp.js`:

```js
const https = require('https');

const BASE_URL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}`;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

/**
 * Low-level POST to Meta Graph API
 */
async function graphPost(endpoint, body) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Graph API error: ${response.status}`);
  }
  return data;
}

/**
 * Send a template message to a single phone number
 *
 * @param {string} to - E.164 phone number without '+'
 * @param {string} templateName - Approved template name in Meta
 * @param {string} languageCode - e.g. 'en_US'
 * @param {Array<string>} components - variable values for template body
 * @returns {object} Meta API response
 */
async function sendTemplateMessage(to, templateName, languageCode = 'en_US', components = []) {
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components.length > 0
        ? [
            {
              type: 'body',
              parameters: components.map((val) => ({
                type: 'text',
                text: String(val),
              })),
            },
          ]
        : [],
    },
  };

  return graphPost(`/${PHONE_NUMBER_ID}/messages`, body);
}

/**
 * Send a free-form text message (only allowed in 24h customer service window)
 * Use this for quick dev testing only — production requires templates for outbound
 */
async function sendTextMessage(to, text) {
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  };
  return graphPost(`/${PHONE_NUMBER_ID}/messages`, body);
}

/**
 * Mark a message as read
 */
async function markRead(messageId) {
  const body = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  };
  return graphPost(`/${PHONE_NUMBER_ID}/messages`, body);
}

module.exports = { sendTemplateMessage, sendTextMessage, markRead };
```

### Step 4.2 — Rate Limiter / Queue Service

WhatsApp has rate limits (80 messages/sec for Cloud API Tier 1). Use a simple throttled loop:

`backend/src/services/queue.js`:

```js
/**
 * Simple async rate-limited queue
 * @param {Array} items - items to process
 * @param {Function} handler - async function(item) => result
 * @param {number} delayMs - delay between each call (default 200ms = ~5 msgs/sec, safe)
 */
async function processQueue(items, handler, delayMs = 200) {
  const results = [];
  for (const item of items) {
    try {
      const result = await handler(item);
      results.push({ item, result, success: true });
    } catch (err) {
      results.push({ item, error: err.message, success: false });
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}

module.exports = { processQueue };
```

---

## Phase 5 — REST API Endpoints

### Step 5.1 — Contacts CRUD

`backend/src/routes/contacts.js`:

```js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/contacts?page=1&limit=50&search=alice&tag=vip
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const tag = req.query.tag || '';

    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length})`;
    }
    if (tag) {
      params.push(tag);
      where += ` AND $${params.length} = ANY(tags)`;
    }

    const countRes = await db.query(`SELECT COUNT(*) FROM contacts ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(limit, offset);
    const dataRes = await db.query(
      `SELECT * FROM contacts ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      contacts: dataRes.rows,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/:id
router.get('/:id', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM contacts WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// POST /api/contacts
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, tags } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });
    const { rows } = await db.query(
      `INSERT INTO contacts (name, phone, email, tags) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, phone, email || null, tags || []]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/contacts/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, tags, opted_in } = req.body;
    const { rows } = await db.query(
      `UPDATE contacts SET name=$1, phone=$2, email=$3, tags=$4, opted_in=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [name, phone, email, tags, opted_in, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM contacts WHERE id = $1', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// GET /api/contacts/stats/overview
router.get('/stats/overview', async (req, res) => {
  try {
    const total = await db.query('SELECT COUNT(*) FROM contacts WHERE opted_in = true');
    const tags = await db.query(`
      SELECT unnest(tags) as tag, COUNT(*) as count
      FROM contacts GROUP BY tag ORDER BY count DESC LIMIT 10
    `);
    res.json({ total: parseInt(total.rows[0].count), tags: tags.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

### Step 5.2 — Message Templates CRUD

`backend/src/routes/messages.js`:

```js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/messages/templates
router.get('/templates', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM message_templates ORDER BY created_at DESC');
  res.json(rows);
});

// POST /api/messages/templates
router.post('/templates', async (req, res) => {
  try {
    const { name, wa_template_name, language, body_text, variables } = req.body;
    if (!name || !wa_template_name || !body_text)
      return res.status(400).json({ error: 'name, wa_template_name, body_text required' });

    const { rows } = await db.query(
      `INSERT INTO message_templates (name, wa_template_name, language, body_text, variables)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, wa_template_name, language || 'en_US', body_text, JSON.stringify(variables || [])]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/messages/templates/:id
router.delete('/templates/:id', async (req, res) => {
  await db.query('DELETE FROM message_templates WHERE id = $1', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// GET /api/messages/campaigns
router.get('/campaigns', async (req, res) => {
  const { rows } = await db.query(`
    SELECT bc.*, mt.name as template_name, mt.wa_template_name
    FROM bulk_campaigns bc
    LEFT JOIN message_templates mt ON bc.template_id = mt.id
    ORDER BY bc.created_at DESC LIMIT 50
  `);
  res.json(rows);
});

// GET /api/messages/campaigns/:id/logs
router.get('/campaigns/:id/logs', async (req, res) => {
  const { rows } = await db.query(`
    SELECT ml.*, c.name as contact_name
    FROM message_logs ml
    LEFT JOIN contacts c ON ml.contact_id = c.id
    WHERE ml.campaign_id = $1
    ORDER BY ml.created_at DESC
  `, [req.params.id]);
  res.json(rows);
});

module.exports = router;
```

### Step 5.3 — Bulk Send Route

`backend/src/routes/send.js`:

```js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendTemplateMessage } = require('../services/whatsapp');
const { processQueue } = require('../services/queue');

/**
 * POST /api/send/bulk
 * Body: {
 *   templateId: uuid,
 *   templateVars: ["value1", "value2"],  // positional vars for {{1}}, {{2}}
 *   tagFilter: "vip"  // optional: only send to contacts with this tag
 * }
 */
router.post('/bulk', async (req, res) => {
  const { templateId, templateVars = [], tagFilter } = req.body;

  if (!templateId) return res.status(400).json({ error: 'templateId is required' });

  try {
    // Fetch template
    const tmplRes = await db.query('SELECT * FROM message_templates WHERE id = $1', [templateId]);
    if (!tmplRes.rows[0]) return res.status(404).json({ error: 'Template not found' });
    const template = tmplRes.rows[0];

    // Fetch opted-in contacts
    let contactQuery = 'SELECT * FROM contacts WHERE opted_in = true';
    const queryParams = [];
    if (tagFilter) {
      queryParams.push(tagFilter);
      contactQuery += ` AND $${queryParams.length} = ANY(tags)`;
    }
    const contactsRes = await db.query(contactQuery, queryParams);
    const contacts = contactsRes.rows;

    if (contacts.length === 0) {
      return res.status(422).json({ error: 'No opted-in contacts found' });
    }

    // Create campaign record
    const campaignRes = await db.query(
      `INSERT INTO bulk_campaigns (template_id, template_vars, total_contacts, status, started_at)
       VALUES ($1, $2, $3, 'running', NOW()) RETURNING *`,
      [templateId, JSON.stringify(templateVars), contacts.length]
    );
    const campaign = campaignRes.rows[0];

    // Create log stubs
    for (const contact of contacts) {
      await db.query(
        `INSERT INTO message_logs (campaign_id, contact_id, phone, status)
         VALUES ($1, $2, $3, 'queued')`,
        [campaign.id, contact.id, contact.phone]
      );
    }

    // Return immediately — send in background
    res.json({
      message: 'Bulk send started',
      campaignId: campaign.id,
      totalContacts: contacts.length,
    });

    // --- Background send (non-blocking) ---
    (async () => {
      let sentCount = 0;
      let failedCount = 0;

      await processQueue(contacts, async (contact) => {
        try {
          const waRes = await sendTemplateMessage(
            contact.phone,
            template.wa_template_name,
            template.language,
            templateVars
          );

          const waMessageId = waRes.messages?.[0]?.id || null;
          await db.query(
            `UPDATE message_logs SET status='sent', wa_message_id=$1, sent_at=NOW()
             WHERE campaign_id=$2 AND contact_id=$3`,
            [waMessageId, campaign.id, contact.id]
          );
          sentCount++;
        } catch (err) {
          await db.query(
            `UPDATE message_logs SET status='failed', error_msg=$1
             WHERE campaign_id=$2 AND contact_id=$3`,
            [err.message, campaign.id, contact.id]
          );
          failedCount++;
        }
      }, 250); // 250ms delay = ~4 msgs/sec

      // Mark campaign complete
      await db.query(
        `UPDATE bulk_campaigns
         SET status='completed', sent_count=$1, failed_count=$2, completed_at=NOW()
         WHERE id=$3`,
        [sentCount, failedCount, campaign.id]
      );
    })();

  } catch (err) {
    console.error('Bulk send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/send/status/:campaignId
router.get('/status/:campaignId', async (req, res) => {
  const { rows } = await db.query(
    `SELECT bc.*, 
       COUNT(ml.id) FILTER (WHERE ml.status = 'sent') as sent,
       COUNT(ml.id) FILTER (WHERE ml.status = 'delivered') as delivered,
       COUNT(ml.id) FILTER (WHERE ml.status = 'read') as read_count,
       COUNT(ml.id) FILTER (WHERE ml.status = 'failed') as failed,
       COUNT(ml.id) FILTER (WHERE ml.status = 'queued') as queued
     FROM bulk_campaigns bc
     LEFT JOIN message_logs ml ON bc.id = ml.campaign_id
     WHERE bc.id = $1
     GROUP BY bc.id`,
    [req.params.campaignId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Campaign not found' });
  res.json(rows[0]);
});

module.exports = router;
```

### Step 5.4 — Webhook Route (Delivery Receipts)

`backend/src/routes/webhook.js`:

```js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/webhook — Meta webhook verification
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// POST /api/webhook — Incoming messages and status updates
router.post('/', express.json(), async (req, res) => {
  const body = req.body;

  if (body.object !== 'whatsapp_business_account') {
    return res.sendStatus(404);
  }

  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const val = change.value;

        // Handle status updates (sent, delivered, read, failed)
        for (const status of val.statuses || []) {
          const { id: waMessageId, status: newStatus, timestamp } = status;
          const ts = new Date(parseInt(timestamp) * 1000);

          let updateCol = null;
          if (newStatus === 'delivered') updateCol = 'delivered_at';
          if (newStatus === 'read') updateCol = 'read_at';

          if (updateCol) {
            await db.query(
              `UPDATE message_logs SET status=$1, ${updateCol}=$2 WHERE wa_message_id=$3`,
              [newStatus, ts, waMessageId]
            );
          } else if (newStatus === 'failed') {
            const errMsg = status.errors?.[0]?.message || 'Unknown error';
            await db.query(
              `UPDATE message_logs SET status='failed', error_msg=$1 WHERE wa_message_id=$2`,
              [errMsg, waMessageId]
            );
          } else {
            await db.query(
              `UPDATE message_logs SET status=$1 WHERE wa_message_id=$2`,
              [newStatus, waMessageId]
            );
          }
        }
      }
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }

  res.sendStatus(200);
});

module.exports = router;
```

---

## Phase 6 — React Dashboard (Frontend)

### Step 6.1 — Vite Config with Proxy

`frontend/vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
```

### Step 6.2 — API Client

`frontend/src/api.js`:

```js
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const contacts = {
  list: (params) => api.get('/contacts', { params }).then(r => r.data),
  create: (data) => api.post('/contacts', data).then(r => r.data),
  update: (id, data) => api.put(`/contacts/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/contacts/${id}`).then(r => r.data),
  stats: () => api.get('/contacts/stats/overview').then(r => r.data),
};

export const importer = {
  upload: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
};

export const messages = {
  templates: () => api.get('/messages/templates').then(r => r.data),
  addTemplate: (data) => api.post('/messages/templates', data).then(r => r.data),
  deleteTemplate: (id) => api.delete(`/messages/templates/${id}`).then(r => r.data),
  campaigns: () => api.get('/messages/campaigns').then(r => r.data),
  campaignLogs: (id) => api.get(`/messages/campaigns/${id}/logs`).then(r => r.data),
};

export const sender = {
  bulkSend: (data) => api.post('/send/bulk', data).then(r => r.data),
  status: (id) => api.get(`/send/status/${id}`).then(r => r.data),
};

export default api;
```

### Step 6.3 — App Entry + Router

`frontend/src/App.jsx`:

```jsx
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import ContactsPage from './pages/ContactsPage';
import SendPage from './pages/SendPage';
import CampaignsPage from './pages/CampaignsPage';

const navClass = ({ isActive }) =>
  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-green-600 text-white'
      : 'text-gray-400 hover:text-white hover:bg-gray-700'
  }`;

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Sidebar */}
        <div className="fixed left-0 top-0 h-full w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4">
          <div className="mb-8 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">
                W
              </div>
              <span className="font-semibold text-white">WA Sender</span>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            <NavLink to="/" className={navClass} end>📋 Contacts</NavLink>
            <NavLink to="/send" className={navClass}>📤 Bulk Send</NavLink>
            <NavLink to="/campaigns" className={navClass}>📊 Campaigns</NavLink>
          </nav>
        </div>

        {/* Main */}
        <div className="ml-56 p-8">
          <Routes>
            <Route path="/" element={<ContactsPage />} />
            <Route path="/send" element={<SendPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
```

`frontend/src/main.jsx`:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### Step 6.4 — Contacts Page

`frontend/src/pages/ContactsPage.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react';
import { contacts as contactsApi, importer } from '../api';

export default function ContactsPage() {
  const [data, setData] = useState({ contacts: [], total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', tags: '' });
  const fileRef = useRef();

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await contactsApi.list({ page, limit: 50, search });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, [page, search]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importer.upload(file);
      setImportResult(result);
      fetchContacts();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || err.message });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    try {
      await contactsApi.create({
        ...newContact,
        tags: newContact.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      setShowAddForm(false);
      setNewContact({ name: '', phone: '', email: '', tags: '' });
      fetchContacts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add contact');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this contact?')) return;
    await contactsApi.remove(id);
    fetchContacts();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Contacts</h1>
          <p className="text-gray-400 text-sm mt-1">{data.total} total contacts</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            + Add Contact
          </button>
          <button
            onClick={() => fileRef.current.click()}
            disabled={importing}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {importing ? '⏳ Importing...' : '📂 Import Spreadsheet'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`mb-4 p-4 rounded-lg text-sm ${importResult.error ? 'bg-red-900/30 border border-red-700 text-red-300' : 'bg-green-900/30 border border-green-700 text-green-300'}`}>
          {importResult.error
            ? `❌ ${importResult.error}`
            : `✅ Imported ${importResult.inserted} contacts (${importResult.skipped} skipped) from ${importResult.total} rows`}
        </div>
      )}

      {/* Add Contact Form */}
      {showAddForm && (
        <form onSubmit={handleAddContact} className="mb-6 p-4 bg-gray-800 rounded-xl border border-gray-700 grid grid-cols-4 gap-3">
          <input required placeholder="Name" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})}
            className="bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-green-500" />
          <input required placeholder="Phone (e.g. 14155552671)" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})}
            className="bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-green-500" />
          <input placeholder="Email" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})}
            className="bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-green-500" />
          <input placeholder="Tags (comma separated)" value={newContact.tags} onChange={e => setNewContact({...newContact, tags: e.target.value})}
            className="bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-green-500" />
          <button type="submit" className="col-span-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors">Add Contact</button>
        </form>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-xs bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Tags</th>
              <th className="text-left px-4 py-3">Opted In</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">Loading...</td></tr>
            ) : data.contacts.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No contacts yet. Import a spreadsheet to get started.</td></tr>
            ) : (
              data.contacts.map(c => (
                <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-400">{c.email || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-green-900/40 text-green-400 text-xs rounded-full border border-green-800">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${c.opted_in ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                      {c.opted_in ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-300 text-xs transition-colors">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.pages > 1 && (
        <div className="flex gap-2 mt-4 justify-end">
          {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded text-sm font-medium transition-colors ${p === page ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 6.5 — Send Page (Bulk Send Dashboard)

`frontend/src/pages/SendPage.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { messages as messagesApi, sender, contacts as contactsApi } from '../api';

export default function SendPage() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateVars, setTemplateVars] = useState(['', '', '']);
  const [tagFilter, setTagFilter] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [campaignStatus, setCampaignStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '', wa_template_name: '', language: 'en_US', body_text: '', variables: []
  });

  useEffect(() => {
    messagesApi.templates().then(setTemplates);
    contactsApi.stats().then(setStats);
  }, []);

  // Poll campaign status after send
  useEffect(() => {
    if (!result?.campaignId) return;
    const interval = setInterval(async () => {
      const status = await sender.status(result.campaignId);
      setCampaignStatus(status);
      if (status.status === 'completed') clearInterval(interval);
    }, 2000);
    return () => clearInterval(interval);
  }, [result]);

  const handleSend = async () => {
    if (!selectedTemplate) return alert('Please select a template');
    if (!confirm(`Send to all opted-in contacts${tagFilter ? ` tagged "${tagFilter}"` : ''}? This cannot be undone.`)) return;

    setSending(true);
    setResult(null);
    setCampaignStatus(null);
    try {
      const res = await sender.bulkSend({
        templateId: selectedTemplate,
        templateVars: templateVars.filter(Boolean),
        tagFilter: tagFilter || undefined,
      });
      setResult(res);
    } catch (err) {
      alert(err.response?.data?.error || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const handleAddTemplate = async (e) => {
    e.preventDefault();
    try {
      await messagesApi.addTemplate(newTemplate);
      const updated = await messagesApi.templates();
      setTemplates(updated);
      setShowAddTemplate(false);
      setNewTemplate({ name: '', wa_template_name: '', language: 'en_US', body_text: '', variables: [] });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add template');
    }
  };

  const selectedTmpl = templates.find(t => t.id === selectedTemplate);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Bulk Send</h1>
        <p className="text-gray-400 text-sm mt-1">
          {stats ? `${stats.total} opted-in contacts ready` : 'Loading...'}
        </p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">

        {/* Template Select */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">Message Template</label>
            <button onClick={() => setShowAddTemplate(!showAddTemplate)}
              className="text-xs text-green-400 hover:text-green-300 transition-colors">
              + Add Template
            </button>
          </div>
          <select
            value={selectedTemplate}
            onChange={e => setSelectedTemplate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
          >
            <option value="">Select a template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.wa_template_name})</option>
            ))}
          </select>
          {selectedTmpl && (
            <div className="mt-2 p-3 bg-gray-800 rounded-lg text-xs text-gray-400 font-mono">
              {selectedTmpl.body_text}
            </div>
          )}
        </div>

        {/* Add Template Form */}
        {showAddTemplate && (
          <form onSubmit={handleAddTemplate} className="p-4 bg-gray-800 rounded-xl border border-gray-700 space-y-3">
            <p className="text-sm font-medium text-white">Add Template</p>
            <input required placeholder="Display name" value={newTemplate.name}
              onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-green-500" />
            <input required placeholder="WhatsApp template name (e.g. bulk_promo)" value={newTemplate.wa_template_name}
              onChange={e => setNewTemplate({...newTemplate, wa_template_name: e.target.value})}
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-green-500" />
            <select value={newTemplate.language} onChange={e => setNewTemplate({...newTemplate, language: e.target.value})}
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white border border-gray-600 focus:outline-none focus:border-green-500">
              <option value="en_US">English (US)</option>
              <option value="en_GB">English (UK)</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="ar">Arabic</option>
              <option value="hi">Hindi</option>
            </select>
            <textarea required placeholder="Template body text (use {{1}}, {{2}} for variables)" value={newTemplate.body_text}
              onChange={e => setNewTemplate({...newTemplate, body_text: e.target.value})} rows={3}
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-green-500" />
            <button type="submit" className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors">Save Template</button>
          </form>
        )}

        {/* Template Variables */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">Template Variables</label>
          <p className="text-xs text-gray-500 mb-3">Fill values for {{`{{1}}`}}, {{`{{2}}`}}, {{`{{3}}`}} in your template</p>
          <div className="grid grid-cols-3 gap-3">
            {['{{1}}', '{{2}}', '{{3}}'].map((placeholder, i) => (
              <div key={i}>
                <label className="text-xs text-gray-500 mb-1 block">{placeholder}</label>
                <input
                  placeholder={`Variable ${i + 1}`}
                  value={templateVars[i]}
                  onChange={e => {
                    const updated = [...templateVars];
                    updated[i] = e.target.value;
                    setTemplateVars(updated);
                  }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Tag Filter */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">
            Tag Filter <span className="text-gray-500 font-normal">(optional — leave blank to send to all)</span>
          </label>
          <input
            placeholder="e.g. vip (sends only to contacts with this tag)"
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={sending || !selectedTemplate}
          className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {sending ? '⏳ Starting send...' : '📤 Send Bulk Message'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="mt-4 p-4 bg-green-900/30 border border-green-800 rounded-xl">
          <p className="text-green-300 font-medium text-sm">✅ Campaign started!</p>
          <p className="text-green-400 text-xs mt-1">Sending to {result.totalContacts} contacts. Campaign ID: {result.campaignId}</p>
        </div>
      )}

      {/* Live Status */}
      {campaignStatus && (
        <div className="mt-4 p-4 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-white">Campaign Progress</p>
            <span className={`text-xs px-2 py-1 rounded-full ${
              campaignStatus.status === 'completed' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'
            }`}>{campaignStatus.status}</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Sent', value: campaignStatus.sent, color: 'text-blue-400' },
              { label: 'Delivered', value: campaignStatus.delivered, color: 'text-green-400' },
              { label: 'Read', value: campaignStatus.read_count, color: 'text-purple-400' },
              { label: 'Failed', value: campaignStatus.failed, color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-800 rounded-lg p-3 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value || 0}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div className="mt-3 bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-green-500 h-2 transition-all duration-500"
              style={{ width: `${campaignStatus.total_contacts ? ((parseInt(campaignStatus.sent || 0) + parseInt(campaignStatus.failed || 0)) / campaignStatus.total_contacts) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 text-right">
            {parseInt(campaignStatus.sent || 0) + parseInt(campaignStatus.failed || 0)} / {campaignStatus.total_contacts} processed
          </p>
        </div>
      )}
    </div>
  );
}
```

### Step 6.6 — Campaigns Page

`frontend/src/pages/CampaignsPage.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { messages as messagesApi } from '../api';

const statusColors = {
  completed: 'bg-green-900/40 text-green-400',
  running: 'bg-yellow-900/40 text-yellow-400',
  pending: 'bg-gray-800 text-gray-400',
  failed: 'bg-red-900/40 text-red-400',
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    messagesApi.campaigns().then(c => { setCampaigns(c); setLoading(false); });
  }, []);

  const viewLogs = async (campaign) => {
    setSelectedCampaign(campaign);
    const l = await messagesApi.campaignLogs(campaign.id);
    setLogs(l);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Campaigns</h1>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : campaigns.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-gray-500">No campaigns yet. Go to Bulk Send to start your first campaign.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white text-sm">{c.template_name || 'Unknown Template'}</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{c.wa_template_name}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-xs text-gray-400">
                    <span className="text-green-400 font-medium">{c.sent_count}</span> sent ·{' '}
                    <span className="text-red-400">{c.failed_count}</span> failed ·{' '}
                    <span className="text-gray-400">{c.total_contacts}</span> total
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColors[c.status] || statusColors.pending}`}>
                    {c.status}
                  </span>
                  <button
                    onClick={() => viewLogs(c)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View Logs →
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {new Date(c.created_at).toLocaleString()}
                {c.completed_at && ` → ${new Date(c.completed_at).toLocaleString()}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Log Drawer */}
      {selectedCampaign && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={() => setSelectedCampaign(null)}>
          <div className="w-full max-w-lg bg-gray-950 h-full overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Message Logs</h2>
              <button onClick={() => setSelectedCampaign(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <p className="text-sm text-gray-400 mb-4">{selectedCampaign.template_name}</p>
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{log.contact_name}</p>
                      <p className="text-xs text-gray-500 font-mono">{log.phone}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      log.status === 'read' ? 'bg-purple-900/40 text-purple-400' :
                      log.status === 'delivered' ? 'bg-green-900/40 text-green-400' :
                      log.status === 'sent' ? 'bg-blue-900/40 text-blue-400' :
                      log.status === 'failed' ? 'bg-red-900/40 text-red-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>{log.status}</span>
                  </div>
                  {log.error_msg && (
                    <p className="text-xs text-red-400 mt-1">{log.error_msg}</p>
                  )}
                  {log.sent_at && (
                    <p className="text-xs text-gray-600 mt-1">Sent: {new Date(log.sent_at).toLocaleString()}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Phase 7 — Bulk Send Feature

The bulk send is already wired in Phase 5.3 (`/api/send/bulk`). Here's a summary of how it works end-to-end and how to test it:

### Step 7.1 — Test with Meta's Test Number

During development, Meta provides a test WhatsApp number with up to **5 test recipient numbers**.

1. In **WhatsApp → Getting Started**, add your personal WhatsApp number as a test recipient
2. Use the "Send message" button in Meta's UI to confirm opt-in
3. Your test recipient can now receive template messages from your API

### Step 7.2 — Test the Bulk Send API

```bash
# 1. Add a template to DB
curl -X POST http://localhost:4000/api/messages/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Promo Template",
    "wa_template_name": "bulk_promo",
    "language": "en_US",
    "body_text": "Hello {{1}}, check out our offer from {{2}}!"
  }'

# 2. Trigger bulk send (replace templateId with actual UUID from above)
curl -X POST http://localhost:4000/api/send/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "YOUR_TEMPLATE_UUID",
    "templateVars": ["Alice", "AcmeCorp"]
  }'

# 3. Check campaign status
curl http://localhost:4000/api/send/status/YOUR_CAMPAIGN_UUID
```

### Step 7.3 — Opt-Out Handling

Add a webhook listener for incoming messages. When a user replies "STOP" or "Unsubscribe", mark them as opted out:

In `backend/src/routes/webhook.js`, inside the POST handler, add after the status loop:

```js
// Handle incoming messages (opt-outs)
for (const message of val.messages || []) {
  const from = message.from; // sender's phone
  const text = (message.text?.body || '').toLowerCase().trim();

  if (['stop', 'unsubscribe', 'opt out', 'optout', 'remove me'].includes(text)) {
    await db.query(
      'UPDATE contacts SET opted_in = false WHERE phone = $1',
      [from]
    );
    console.log(`📵 Opted out: ${from}`);
  }
}
```

---

## Phase 8 — Deployment on Render

### Step 8.1 — Prepare for Production

`backend/.env.production` (set these as environment variables in Render, do NOT commit):

```
DATABASE_URL=<render managed postgres url>
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_API_VERSION=v19.0
WEBHOOK_VERIFY_TOKEN=...
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://your-frontend.onrender.com
```

### Step 8.2 — Deploy Backend on Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo → select the `backend` folder
4. Settings:
   - **Build Command**: `npm install && npm run migrate`
   - **Start Command**: `npm start`
   - **Node Version**: 20
5. Add all environment variables from above
6. Click **Deploy**

### Step 8.3 — Deploy PostgreSQL on Render

1. In Render → **New PostgreSQL**
2. Free tier is available
3. Copy the **Internal Database URL** → use as `DATABASE_URL` in your backend service

### Step 8.4 — Deploy Frontend on Render (Static Site)

`frontend/.env.production`:
```
VITE_API_URL=https://your-backend.onrender.com
```

Update `frontend/src/api.js` baseURL:
```js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});
```

`frontend/vite.config.js` (remove proxy for production):
```js
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' }
})
```

In Render → **New Static Site**:
- Root directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

### Step 8.5 — Update Meta Webhook URL

After deploying, go back to **Meta Developer Console → WhatsApp → Configuration** and update your webhook URL to:
```
https://your-backend.onrender.com/api/webhook
```

---

## Full File Structure

```
wa-saas/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── index.js          # DB pool
│   │   │   └── migrate.js        # Schema migrations
│   │   ├── routes/
│   │   │   ├── contacts.js       # CRUD contacts
│   │   │   ├── import.js         # Spreadsheet import
│   │   │   ├── messages.js       # Templates + campaigns
│   │   │   ├── send.js           # Bulk send logic
│   │   │   └── webhook.js        # Meta webhooks
│   │   ├── services/
│   │   │   ├── parseSpreadsheet.js  # xlsx/csv parser
│   │   │   ├── queue.js          # Rate-limited queue
│   │   │   ├── upload.js         # Multer config
│   │   │   └── whatsapp.js       # WhatsApp API client
│   │   └── index.js              # Express entry
│   ├── uploads/                  # Temp upload dir (gitignored)
│   ├── .env
│   ├── .gitignore
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ContactsPage.jsx  # Contacts table + import
│   │   │   ├── SendPage.jsx      # Bulk send + status
│   │   │   └── CampaignsPage.jsx # Campaign history + logs
│   │   ├── api.js                # Axios API client
│   │   ├── App.jsx               # Router + layout
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
├── sample_contacts.csv           # Sample import file
├── .gitignore
└── README.md
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ | From Meta Business Manager |
| `WHATSAPP_ACCESS_TOKEN` | ✅ | Permanent system user token |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ✅ | Your WABA ID |
| `WHATSAPP_API_VERSION` | ✅ | e.g. `v19.0` |
| `WEBHOOK_VERIFY_TOKEN` | ✅ | Any secret string for webhook verification |
| `PORT` | ✅ | Backend port (default 4000) |
| `NODE_ENV` | ✅ | `development` or `production` |
| `FRONTEND_URL` | ✅ | Used for CORS whitelist |

---

## Troubleshooting

### "Template not found" on send
- Your template must be **approved** in Meta Business Manager
- Template name must match exactly (case-sensitive, underscores)

### "Phone number not in allowed list" error
- In Meta test mode, only pre-approved numbers can receive messages
- Add your test phone number in **WhatsApp → Getting Started → Test numbers**

### Webhook verification fails
- Ensure `WEBHOOK_VERIFY_TOKEN` matches what you entered in Meta's console
- Your backend must be publicly reachable (deploy to Render, or use `ngrok` locally)

### Locally expose backend for Meta webhook (dev):
```bash
npx ngrok http 4000
# Copy the https URL → paste into Meta webhook config
```

### Import fails on phone format
- Ensure phones are **full international digits without `+`**
- US: `14155552671`, UK: `447700900123`, India: `919876543210`

### Rate limit errors from Meta
- Slow down queue: increase `delayMs` in `processQueue()` call
- Tier 1 allows ~1000 conversations/day. Upgrade tier as your business grows.

### CORS errors in development
- Ensure `FRONTEND_URL=http://localhost:5173` in backend `.env`
- Vite proxy only works in dev; check production env vars for deploy

---

## Quick Start Summary

```bash
# 1. Clone and set up
git clone <your-repo>
cd wa-saas

# 2. Backend
cd backend && npm install
cp .env.example .env   # fill in your values
npm run migrate
npm run dev

# 3. Frontend (new terminal)
cd frontend && npm install
npm run dev

# 4. Open dashboard
open http://localhost:5173
```

**→ Import your contacts spreadsheet → Add your approved WhatsApp template → Hit "Send Bulk Message"**

---

*Built with ❤️ using Meta WhatsApp Business Cloud API — no third-party integrations required.*
```
