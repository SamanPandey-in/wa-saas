import express from 'express';
import db from '../db/index.js';

const router = express.Router();

router.get('/templates', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM message_templates ORDER BY created_at DESC');
  res.json(rows);
});

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

router.delete('/templates/:id', async (req, res) => {
  await db.query('DELETE FROM message_templates WHERE id = $1', [req.params.id]);
  res.json({ message: 'Deleted' });
});

router.get('/campaigns', async (req, res) => {
  const { rows } = await db.query(`
    SELECT bc.*, mt.name as template_name, mt.wa_template_name
    FROM bulk_campaigns bc
    LEFT JOIN message_templates mt ON bc.template_id = mt.id
    ORDER BY bc.created_at DESC LIMIT 50
  `);
  res.json(rows);
});

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

export default router;