import express from 'express';
import db from '../db/index.js';

const router = express.Router();

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

router.get('/:id', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM contacts WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

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

router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM contacts WHERE id = $1', [req.params.id]);
  res.json({ message: 'Deleted' });
});

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

export default router;