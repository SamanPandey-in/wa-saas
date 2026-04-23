import db from './index.js';

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
