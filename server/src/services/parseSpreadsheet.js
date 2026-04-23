import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import csvParser from 'csv-parser';

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

export default parseFile;
