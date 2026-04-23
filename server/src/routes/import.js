import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { parseFile } from '../utils/parser.js';
import db from '../db/index.js';


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

export default router;