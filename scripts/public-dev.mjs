/**
 * Піднімає npm run dev + публічний HTTPS через localtunnel (без власного домену).
 * Піддомен: TUNNEL_SUBDOMAIN у .env або автоматично з VITE_TELEGRAM_BOT_USERNAME.
 */
import { spawn, exec as execCb } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const localtunnel = require('localtunnel');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(root, '.env') });

const PORT = 5173;
const HOST = '127.0.0.1';

function sanitizeSubdomain(raw) {
  let s = String(raw || '')
    .replace(/[^a-z0-9-]/gi, '')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
  if (s.length < 4) s = `lumen${s}app`.replace(/[^a-z0-9]/g, '').slice(0, 20);
  return s.slice(0, 48);
}

function defaultSubdomain() {
  const fromEnv = process.env.TUNNEL_SUBDOMAIN?.trim();
  if (fromEnv) return sanitizeSubdomain(fromEnv);
  const bot = process.env.VITE_TELEGRAM_BOT_USERNAME?.trim() || 'lumen';
  return sanitizeSubdomain(`${bot.replace(/_/g, '')}-tg`);
}

function waitForPort(port, timeoutMs = 120000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = net.createConnection({ port, host: HOST }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Порт ${port} не відкрився за ${timeoutMs / 1000}s`));
          return;
        }
        setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

function openBrowserSync(url) {
  const u = url.replace(/"/g, '');
  if (process.platform === 'win32') {
    execCb(`start "" "${u}"`, { shell: true, windowsHide: true }, () => {});
  } else if (process.platform === 'darwin') {
    execCb(`open "${u}"`, () => {});
  } else {
    execCb(`xdg-open "${u}"`, () => {});
  }
}

let devProc = null;
let tunnelClient = null;

function shutdown() {
  if (tunnelClient) {
    try {
      tunnelClient.close();
    } catch {
      /* ignore */
    }
  }
  if (devProc && !devProc.killed) {
    devProc.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
devProc = spawn(npmCmd, ['run', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env },
  shell: false,
});

devProc.on('error', (err) => {
  console.error('[public-dev] npm run dev:', err);
  process.exit(1);
});

devProc.on('exit', (code) => {
  if (tunnelClient) tunnelClient.close();
  process.exit(code ?? 0);
});

try {
  await waitForPort(PORT);
} catch (e) {
  console.error(e.message);
  shutdown();
  process.exit(1);
}

const baseSub = defaultSubdomain();
const candidates = [baseSub, `${baseSub}-${Math.random().toString(36).slice(2, 6)}`, null];

let publicUrl = null;
let usedHost = null;
let usedFallback = false;

for (const sub of candidates) {
  try {
    const opts = { port: PORT, host: HOST };
    if (sub) opts.subdomain = sub;
    tunnelClient = await localtunnel(opts);
    publicUrl = tunnelClient.url;
    usedHost = new URL(publicUrl).hostname;
    usedFallback = sub !== baseSub;
    break;
  } catch {
    tunnelClient = null;
    if (sub == null) {
      console.error('[public-dev] localtunnel: не вдалося відкрити тунель (спробуй пізніше або npm run tunnel з cloudflared).');
      process.exit(1);
    }
  }
}

const loginUrl = `${publicUrl.replace(/\/$/, '')}/login`;

console.log('\n\x1b[33m╔════════════════════════════════════════════════════════════════╗\x1b[0m');
console.log('\x1b[33m║\x1b[0m  Публічний URL (відкрий у браузері, не localhost):');
console.log(`\x1b[33m║\x1b[0m  \x1b[32m${loginUrl}\x1b[0m`);
console.log('\x1b[33m╠════════════════════════════════════════════════════════════════╣\x1b[0m');
console.log('\x1b[33m║\x1b[0m  Telegram API не дає виставити домен автоматично. Один раз у @BotFather:');
console.log('\x1b[33m║\x1b[0m  /setdomain → твій бот → встав \x1b[36mлише хост\x1b[0m (без https):');
console.log(`\x1b[33m║\x1b[0m  \x1b[36m${usedHost}\x1b[0m`);
if (usedFallback) {
  console.log('\x1b[33m║\x1b[0m  Піддомен за зайнятості змінено — у BotFather вкажи хост з цього рядка.');
}
console.log('\x1b[33m╚════════════════════════════════════════════════════════════════╝\x1b[0m\n');

openBrowserSync(loginUrl);

tunnelClient.on('close', () => {
  console.log('[public-dev] Тунель закрито.');
});
