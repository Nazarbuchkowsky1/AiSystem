import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db.js';
import { findAllowedTelegramUser } from '../airtableUsers.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'realone-local-secret-change-me';
const TOKEN_EXPIRY = '30d';

const TELEGRAM_AUTH_MAX_AGE_SEC = 86400;

function verifyTelegramLoginPayload(data) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;
  const { hash, ...rest } = data;
  if (!hash || typeof hash !== 'string') return false;
  const checkString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('\n');
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  return hmac === hash;
}

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  res.json({ token, user: { id: String(user.id), email: user.email, role: user.role } });
});

router.post('/telegram', async (req, res) => {
  try {
    const body = req.body || {};
    if (!verifyTelegramLoginPayload(body)) {
      return res.status(401).json({ error: 'Invalid Telegram auth' });
    }
    const authDate = Number(body.auth_date);
    if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > TELEGRAM_AUTH_MAX_AGE_SEC) {
      return res.status(401).json({ error: 'Telegram auth expired' });
    }
    const telegramId = body.id;
    const username = body.username != null ? String(body.username) : '';
    if (telegramId == null) {
      return res.status(400).json({ error: 'Missing Telegram id' });
    }

    let airtableRow;
    try {
      airtableRow = await findAllowedTelegramUser(username);
    } catch (e) {
      console.error('[Auth] Airtable:', e.message);
      return res.status(503).json({ error: 'User directory unavailable' });
    }
    if (!airtableRow) {
      return res.status(403).json({ error: 'not_registered', code: 'NOT_IN_AIRTABLE' });
    }

    const role = airtableRow.role === 'admin' ? 'admin' : 'user';
    const photoUrl = body.photo_url != null ? String(body.photo_url) : '';
    const displayName =
      [body.first_name, body.last_name].filter(Boolean).join(' ').trim() || username || `user_${telegramId}`;
    const email = `tg_${telegramId}@telegram.local`;
    const unusableHash = bcrypt.hashSync(`__telegram__${telegramId}__${JWT_SECRET}`, 10);

    const existing = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(String(telegramId));
    const now = new Date().toISOString();
    let userId;
    if (existing) {
      db.prepare(
        `UPDATE users SET role = ?, telegram_username = ?, photo_url = ?, display_name = ?, updated_date = ? WHERE id = ?`
      ).run(role, username, photoUrl, displayName, now, existing.id);
      userId = existing.id;
    } else {
      const ins = db
        .prepare(
          `INSERT INTO users (email, password_hash, role, telegram_id, telegram_username, photo_url, display_name, created_date, updated_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(email, unusableHash, role, String(telegramId), username, photoUrl, displayName, now, now);
      userId = ins.lastInsertRowid;
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, telegram_id: user.telegram_id },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    res.json({
      token,
      user: {
        id: String(user.id),
        email: user.email,
        role: user.role,
        telegram_username: user.telegram_username || '',
        photo_url: user.photo_url || '',
        display_name: user.display_name || '',
        created_date: user.created_date,
      },
    });
  } catch (e) {
    console.error('[Auth] Telegram:', e);
    res.status(500).json({ error: e.message || 'Telegram login failed' });
  }
});

router.get('/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db
      .prepare(
        `SELECT id, email, role, created_date, telegram_id, telegram_username, photo_url, display_name FROM users WHERE id = ?`
      )
      .get(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({
      id: String(user.id),
      email: user.email,
      role: user.role,
      created_date: user.created_date,
      telegram_id: user.telegram_id || null,
      telegram_username: user.telegram_username || '',
      photo_url: user.photo_url || '',
      display_name: user.display_name || '',
    });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/logout', (_req, res) => {
  res.json({ ok: true });
});

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export default router;
