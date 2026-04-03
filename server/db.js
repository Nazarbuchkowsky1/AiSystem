import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data.sqlite');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_date TEXT DEFAULT (datetime('now')),
    updated_date TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon_url TEXT DEFAULT '',
    icon_name TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    system_instructions TEXT DEFAULT '',
    style_prompt TEXT DEFAULT '',
    style_samples TEXT DEFAULT '[]',
    knowledge_base_ids TEXT DEFAULT '[]',
    tools TEXT DEFAULT '[]',
    model TEXT DEFAULT 'gemini',
    message_count INTEGER DEFAULT 0,
    created_date TEXT DEFAULT (datetime('now')),
    updated_date TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS knowledge_bases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    files TEXT DEFAULT '[]',
    processing INTEGER DEFAULT 0,
    index_status TEXT DEFAULT 'idle',
    index_progress INTEGER DEFAULT 0,
    last_error TEXT DEFAULT '',
    debug_logs TEXT DEFAULT '[]',
    created_date TEXT DEFAULT (datetime('now')),
    updated_date TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    agent_name TEXT DEFAULT '',
    title TEXT DEFAULT '',
    mode TEXT DEFAULT 'instant',
    message_count INTEGER DEFAULT 0,
    last_message_preview TEXT DEFAULT '',
    created_date TEXT DEFAULT (datetime('now')),
    updated_date TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT DEFAULT '',
    file_urls TEXT DEFAULT '[]',
    cost REAL DEFAULT 0,
    citations TEXT DEFAULT '',
    activity TEXT DEFAULT '',
    created_date TEXT DEFAULT (datetime('now')),
    updated_date TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT DEFAULT '',
    end_time TEXT DEFAULT '',
    description TEXT DEFAULT '',
    event_type TEXT DEFAULT 'task',
    color TEXT DEFAULT '#f97316',
    created_date TEXT DEFAULT (datetime('now')),
    updated_date TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS analytics_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    prompts_count INTEGER DEFAULT 0,
    spend_dollars REAL DEFAULT 0,
    created_date TEXT DEFAULT (datetime('now')),
    updated_date TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon_name TEXT DEFAULT '',
    tool_type TEXT DEFAULT 'custom',
    status TEXT DEFAULT 'active',
    code TEXT DEFAULT '',
    config TEXT DEFAULT '{}',
    created_date TEXT DEFAULT (datetime('now')),
    updated_date TEXT DEFAULT (datetime('now'))
  );
`);

const JSON_COLUMNS = {
  agents: ['knowledge_base_ids', 'tools', 'style_samples'],
  knowledge_bases: ['files', 'debug_logs'],
  messages: ['file_urls'],
};

const BOOL_COLUMNS = {
  knowledge_bases: ['processing'],
};

const TABLE_MAP = {
  Agent: 'agents',
  KnowledgeBase: 'knowledge_bases',
  Conversation: 'conversations',
  Message: 'messages',
  CalendarEvent: 'calendar_events',
  AnalyticsDaily: 'analytics_daily',
  User: 'users',
  Tool: 'tools',
};

function getTable(entityName) {
  return TABLE_MAP[entityName] || entityName.toLowerCase() + 's';
}

function serializeRow(table, data) {
  const row = { ...data };
  delete row.id;
  delete row.created_date;
  row.updated_date = new Date().toISOString();

  const jsonCols = JSON_COLUMNS[table] || [];
  for (const col of jsonCols) {
    if (col in row && typeof row[col] !== 'string') {
      row[col] = JSON.stringify(row[col]);
    }
  }

  const boolCols = BOOL_COLUMNS[table] || [];
  for (const col of boolCols) {
    if (col in row) {
      row[col] = row[col] ? 1 : 0;
    }
  }

  return row;
}

function deserializeRow(table, row) {
  if (!row) return row;
  const out = { ...row };
  out.id = String(out.id);

  const jsonCols = JSON_COLUMNS[table] || [];
  for (const col of jsonCols) {
    if (col in out && typeof out[col] === 'string') {
      try { out[col] = JSON.parse(out[col]); } catch { out[col] = []; }
    }
  }

  const boolCols = BOOL_COLUMNS[table] || [];
  for (const col of boolCols) {
    if (col in out) {
      out[col] = !!out[col];
    }
  }

  return out;
}

function seedAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@realone.local');
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run('admin@realone.local', hash, 'admin');
    console.log('[DB] Seeded admin user: admin@realone.local / admin123');
  }
}

seedAdmin();

function seedDefaultAgentsIfEmpty() {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM agents').get();
  if (c > 0) return;
  const now = new Date().toISOString();
  const defaults = [
    {
      name: 'Універсальний помічник',
      description: 'Відповіді на запитання, короткі тексти та ідеї для щоденних задач.',
      icon_name: 'Bot',
    },
    {
      name: 'Дослідник',
      description: 'Структурований аналіз теми, план дій і підсумки з джерел.',
      icon_name: 'Brain',
    },
    {
      name: 'Копірайтер',
      description: 'Пости, листи та оголошення у заданому тоні.',
      icon_name: 'Sparkles',
    },
  ];
  const stmt = db.prepare(
    `INSERT INTO agents (name, description, icon_name, icon_url, status, system_instructions, model, created_date, updated_date)
     VALUES (?, ?, ?, '', 'active', '', 'gemini', ?, ?)`
  );
  for (const a of defaults) {
    stmt.run(a.name, a.description, a.icon_name, now, now);
  }
  console.log('[DB] Seeded default agents (gemini)');
}

seedDefaultAgentsIfEmpty();

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const has = cols.some(c => c.name === column);
  if (!has) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    console.log(`[DB] Added missing column ${table}.${column}`);
  }
}

// Lightweight migration for existing local databases.
ensureColumn('agents', 'style_prompt', "TEXT DEFAULT ''");
ensureColumn('agents', 'style_samples', "TEXT DEFAULT '[]'");

ensureColumn('users', 'telegram_id', 'TEXT');
ensureColumn('users', 'telegram_username', "TEXT DEFAULT ''");
ensureColumn('users', 'photo_url', "TEXT DEFAULT ''");
ensureColumn('users', 'display_name', "TEXT DEFAULT ''");

try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id) WHERE telegram_id IS NOT NULL AND telegram_id != \'\'');
} catch (e) {
  console.warn('[DB] telegram_id unique index:', e.message);
}

export { db, getTable, serializeRow, deserializeRow, TABLE_MAP };
export default db;
