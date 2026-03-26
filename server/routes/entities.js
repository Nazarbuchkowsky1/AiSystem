import { Router } from 'express';
import { db, getTable, serializeRow, deserializeRow } from '../db.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

function getColumns(table) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.map(c => c.name);
}

router.get('/:entity', (req, res) => {
  const table = getTable(req.params.entity);
  try {
    const { sort, limit, ...filters } = req.query;
    let orderClause = 'ORDER BY id DESC';
    if (sort) {
      const desc = sort.startsWith('-');
      const col = desc ? sort.slice(1) : sort;
      const cols = getColumns(table);
      if (cols.includes(col)) {
        orderClause = `ORDER BY ${col} ${desc ? 'DESC' : 'ASC'}`;
      }
    }

    const whereParts = [];
    const params = [];
    for (const [key, val] of Object.entries(filters)) {
      const cols = getColumns(table);
      if (cols.includes(key)) {
        whereParts.push(`${key} = ?`);
        params.push(val);
      }
    }
    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    const limitClause = limit ? `LIMIT ${parseInt(limit, 10)}` : '';

    const rows = db.prepare(`SELECT * FROM ${table} ${whereClause} ${orderClause} ${limitClause}`).all(...params);
    res.json(rows.map(r => deserializeRow(table, r)));
  } catch (e) {
    console.error(`Entity list error (${table}):`, e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:entity/:id', (req, res) => {
  const table = getTable(req.params.entity);
  try {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(deserializeRow(table, row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:entity', (req, res) => {
  const table = getTable(req.params.entity);
  try {
    const data = serializeRow(table, req.body);
    data.created_date = new Date().toISOString();
    data.updated_date = data.created_date;

    const cols = getColumns(table).filter(c => c !== 'id');
    const insertCols = Object.keys(data).filter(k => cols.includes(k));
    const placeholders = insertCols.map(() => '?').join(', ');
    const values = insertCols.map(c => data[c]);

    const result = db.prepare(`INSERT INTO ${table} (${insertCols.join(', ')}) VALUES (${placeholders})`).run(...values);
    const created = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json(deserializeRow(table, created));
  } catch (e) {
    console.error(`Entity create error (${table}):`, e.message);
    res.status(500).json({ error: e.message });
  }
});

router.put('/:entity/:id', (req, res) => {
  const table = getTable(req.params.entity);
  try {
    const data = serializeRow(table, req.body);
    const cols = getColumns(table).filter(c => c !== 'id' && c !== 'created_date');
    const updateCols = Object.keys(data).filter(k => cols.includes(k));
    if (updateCols.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    const setClause = updateCols.map(c => `${c} = ?`).join(', ');
    const values = updateCols.map(c => data[c]);
    values.push(req.params.id);

    db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...values);
    const updated = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(deserializeRow(table, updated));
  } catch (e) {
    console.error(`Entity update error (${table}):`, e.message);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:entity/:id', (req, res) => {
  const table = getTable(req.params.entity);
  try {
    const result = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:entity/filter', (req, res) => {
  const table = getTable(req.params.entity);
  try {
    const { sort, limit, ...filters } = req.body;
    const cols = getColumns(table);

    let orderClause = 'ORDER BY id DESC';
    if (sort) {
      const desc = sort.startsWith('-');
      const col = desc ? sort.slice(1) : sort;
      if (cols.includes(col)) {
        orderClause = `ORDER BY ${col} ${desc ? 'DESC' : 'ASC'}`;
      }
    }

    const whereParts = [];
    const params = [];
    for (const [key, val] of Object.entries(filters)) {
      if (cols.includes(key)) {
        whereParts.push(`${key} = ?`);
        params.push(val);
      }
    }
    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    const limitClause = limit ? `LIMIT ${parseInt(limit, 10)}` : '';

    const rows = db.prepare(`SELECT * FROM ${table} ${whereClause} ${orderClause} ${limitClause}`).all(...params);
    res.json(rows.map(r => deserializeRow(table, r)));
  } catch (e) {
    console.error(`Entity filter error (${table}):`, e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
