/**
 * Піднімає npm run dev + публічний HTTPS (cloudflared якщо є, інакше localtunnel у дочірньому процесі з таймаутом).
 */
import { spawn, execSync, exec as execCb } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(root, '.env') });

const PORT = 5173;
const HOST = '127.0.0.1';
const LT_TIMEOUT_MS = 55000;
const CF_TIMEOUT_MS = 60000;

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

function commandExists(cmd) {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${cmd}`, { stdio: 'ignore' });
    } else {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

function tryCloudflaredTunnel() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn('cloudflared', ['tunnel', '--url', `http://${HOST}:${PORT}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error('cloudflared timeout'));
    }, CF_TIMEOUT_MS);

    const onChunk = (buf) => {
      if (settled) return;
      const s = buf.toString();
      const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\/?/i);
      if (m) {
        settled = true;
        clearTimeout(timer);
        const url = m[0].replace(/\/$/, '');
        child.stderr?.off('data', onChunk);
        child.stdout?.off('data', onChunk);
        resolve({ url, child, host: new URL(url).hostname, kind: 'cloudflared' });
      }
    };
    child.stderr.on('data', onChunk);
    child.stdout.on('data', onChunk);
    child.on('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('cloudflared not runnable'));
    });
    child.on('exit', (code) => {
      if (settled) return;
      if (code && code !== 0) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`cloudflared exit ${code}`));
      }
    });
  });
}

function tryLocaltunnelWorker(subArg) {
  const worker = path.join(__dirname, 'lt-worker.cjs');
  return new Promise((resolve, reject) => {
    const args = [worker, String(PORT), subArg || 'none'];
    const child = spawn(process.execPath, args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env },
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('localtunnel timeout'));
    }, LT_TIMEOUT_MS);

    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      const m = line.match(/^LUMEN_TUNNEL_URL=(.+)$/);
      if (m) {
        clearTimeout(timer);
        rl.close();
        const url = m[1].trim();
        resolve({
          url,
          child,
          host: new URL(url).hostname,
          kind: 'localtunnel',
        });
      }
    });
    child.stderr.on('data', (d) => {
      const t = d.toString();
      const em = t.match(/^LUMEN_TUNNEL_ERR=(.+)$/m);
      if (em) {
        clearTimeout(timer);
        reject(new Error(em[1]));
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 2) reject(new Error('lt-worker failed'));
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

let devProc = null;
let tunnelChild = null;

function shutdown() {
  if (tunnelChild && !tunnelChild.killed) tunnelChild.kill('SIGTERM');
  if (devProc && !devProc.killed) devProc.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

devProc = spawn('npm', ['run', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env },
  shell: true,
});

devProc.on('error', (err) => {
  console.error('[public-dev] npm run dev:', err);
  process.exit(1);
});

devProc.on('exit', (code) => {
  if (tunnelChild) tunnelChild.kill();
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
let result;

if (commandExists('cloudflared')) {
  console.log('[public-dev] Використовую cloudflared (стабільніше за localtunnel.me)…');
  try {
    result = await tryCloudflaredTunnel();
    tunnelChild = result.child;
  } catch (e) {
    console.warn('[public-dev] cloudflared не вдалось:', e.message, '→ localtunnel…');
  }
}

if (!result) {
  const candidates = [baseSub, `${baseSub}-${Math.random().toString(36).slice(2, 6)}`, null];
  for (const sub of candidates) {
    try {
      result = await tryLocaltunnelWorker(sub == null ? null : sub);
      tunnelChild = result.child;
      result.usedFallback = sub !== baseSub;
      break;
    } catch (err) {
      lastErr = err;
      if (sub == null) {
        console.error('[public-dev] localtunnel:', lastErr.message);
        console.error('[public-dev] Встанови cloudflared (winget install Cloudflare.cloudflared) і перезапусти npm run dev:public');
        process.exit(1);
      }
    }
  }
}

const publicUrl = result.url.replace(/\/$/, '');
const usedHost = result.host;
const loginUrl = `${publicUrl}/login`;
const usedFallback = result.usedFallback === true;

console.log('\n\x1b[33m╔════════════════════════════════════════════════════════════════╗\x1b[0m');
console.log('\x1b[33m║\x1b[0m  Публічний URL:');
console.log(`\x1b[33m║\x1b[0m  \x1b[32m${loginUrl}\x1b[0m`);
console.log('\x1b[33m╠════════════════════════════════════════════════════════════════╣\x1b[0m');
console.log('\x1b[33m║\x1b[0m  Один раз @BotFather → /setdomain → \x1b[36mлише хост\x1b[0m:');
console.log(`\x1b[33m║\x1b[0m  \x1b[36m${usedHost}\x1b[0m`);
if (usedFallback) {
  console.log('\x1b[33m║\x1b[0m  Піддомен змінено (зайнятий) — у BotFather вкажи хост з цього рядка.');
}
console.log(`\x1b[33m║\x1b[0m  Тунель: ${result.kind}`);
if (result.kind === 'cloudflared' && usedHost.includes('trycloudflare.com')) {
  console.log('\x1b[33m║\x1b[0m  \x1b[31mПісля зупинки dev:public старий *.trycloudflare.com\x1b[0m');
  console.log('\x1b[33m║\x1b[0m  \x1b[31mбільше не відкриється (1033) — лише URL з цього запуску.\x1b[0m');
}
console.log('\x1b[33m╚════════════════════════════════════════════════════════════════╝\x1b[0m\n');

openBrowserSync(loginUrl);
