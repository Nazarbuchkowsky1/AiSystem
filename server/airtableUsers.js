/**
 * Look up allowed users in Airtable (table Users).
 * Field names are configurable via env (defaults suit a typical setup).
 */

const AIRTABLE_API = 'https://api.airtable.com/v0';

function escapeFormulaString(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function normalizeRole(raw) {
  if (raw == null) return 'user';
  if (typeof raw === 'object' && raw.name != null) {
    const n = String(raw.name).toLowerCase();
    if (n === 'admin' || n === 'адмін' || n === 'админ') return 'admin';
    return 'user';
  }
  const s = String(raw).toLowerCase().trim();
  if (s === 'admin' || s === 'адмін' || s === 'админ') return 'admin';
  return 'user';
}

/**
 * @param {string} username — telegram username without @
 * @returns {Promise<{ role: string, fields: Record<string, unknown> } | null>}
 */
export async function findAllowedTelegramUser(username) {
  const token = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_USERS || 'Users';
  const tgField = process.env.AIRTABLE_FIELD_TELEGRAM_NAME || 'Telegram Username';

  if (!token || !baseId) {
    throw new Error('Airtable is not configured (AIRTABLE_API_KEY / AIRTABLE_BASE_ID)');
  }

  if (!username) return null;

  const formula = `LOWER({${tgField}})='${escapeFormulaString(username.toLowerCase())}'`;
  const url = new URL(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(table)}`);
  url.searchParams.set('filterByFormula', formula);
  url.searchParams.set('maxRecords', '1');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[Airtable] List error', res.status, text);
    throw new Error(`Airtable request failed: ${res.status}`);
  }

  const json = await res.json();
  const records = json.records;
  if (!Array.isArray(records) || records.length === 0) return null;

  const fields = records[0].fields || {};
  const roleField = process.env.AIRTABLE_FIELD_ROLE || 'Role';
  const role = normalizeRole(fields[roleField]);
  return { role, fields };
}
