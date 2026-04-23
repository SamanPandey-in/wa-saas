import express from 'express';
import db from '../db/index.js';

const router = express.Router();

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

router.post('/', express.json(), async (req, res) => {
  const body = req.body;

  if (body.object !== 'whatsapp_business_account') {
    return res.sendStatus(404);
  }

  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const val = change.value;

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

        for (const message of val.messages || []) {
          const from = message.from;
          const text = (message.text?.body || '').toLowerCase().trim();

          if (['stop', 'unsubscribe', 'opt out', 'optout', 'remove me'].includes(text)) {
            await db.query(
              'UPDATE contacts SET opted_in = false WHERE phone = $1',
              [from]
            );
            console.log(`📵 Opted out: ${from}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }

  res.sendStatus(200);
});

export default router;