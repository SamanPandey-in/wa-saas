import express from 'express';
import db from '../db/index.js';
import { sendTemplateMessage } from '../services/whatsapp.js';
import processQueue from '../services/queue.js';

const router = express.Router();

router.post('/bulk', async (req, res) => {
  const { templateId, templateVars = [], tagFilter } = req.body;

  if (!templateId) return res.status(400).json({ error: 'templateId is required' });

  try {
    const tmplRes = await db.query('SELECT * FROM message_templates WHERE id = $1', [templateId]);
    if (!tmplRes.rows[0]) return res.status(404).json({ error: 'Template not found' });
    const template = tmplRes.rows[0];

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

    const campaignRes = await db.query(
      `INSERT INTO bulk_campaigns (template_id, template_vars, total_contacts, status, started_at)
       VALUES ($1, $2, $3, 'running', NOW()) RETURNING *`,
      [templateId, JSON.stringify(templateVars), contacts.length]
    );
    const campaign = campaignRes.rows[0];

    for (const contact of contacts) {
      await db.query(
        `INSERT INTO message_logs (campaign_id, contact_id, phone, status)
         VALUES ($1, $2, $3, 'queued')`,
        [campaign.id, contact.id, contact.phone]
      );
    }

    res.json({
      message: 'Bulk send started',
      campaignId: campaign.id,
      totalContacts: contacts.length,
    });

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
      }, 250);

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

export default router;