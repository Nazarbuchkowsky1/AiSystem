import { db, deserializeRow } from '../db.js';

function toDateKey(d) {
  return d.toISOString().slice(0, 10);
}

export default async function getAnalytics(req, res) {
  try {
    const now = new Date();
    const todayKey = toDateKey(now);
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayKey = toDateKey(yesterday);

    let promptsToday = 0;
    let promptsYesterday = 0;
    let spendToday = 0;
    let spendYesterday = 0;

    try {
      const rows = db.prepare('SELECT * FROM messages ORDER BY created_date DESC LIMIT 5000').all();
      for (const m of rows) {
        const row = deserializeRow('messages', m);
        const created = row.created_date;
        if (!created) continue;
        const dateStr = typeof created === 'string' ? created.slice(0, 10) : new Date(created).toISOString().slice(0, 10);

        if (dateStr === todayKey) {
          if (row.role === 'user') promptsToday += 1;
          if (row.role === 'assistant' && row.cost) spendToday += Number(row.cost) || 0;
        } else if (dateStr === yesterdayKey) {
          if (row.role === 'user') promptsYesterday += 1;
          if (row.role === 'assistant' && row.cost) spendYesterday += Number(row.cost) || 0;
        } else if (dateStr < yesterdayKey) {
          break;
        }
      }
    } catch (e) {
      console.error('Message count error:', e);
    }

    res.json({ promptsToday, promptsYesterday, spendToday, spendYesterday });
  } catch (error) {
    console.error('getAnalytics error:', error);
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
}
