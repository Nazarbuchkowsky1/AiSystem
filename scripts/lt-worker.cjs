/* Дочірній процес: localtunnel + один рядок LUMEN_TUNNEL_URL=... у stdout */
const localtunnel = require('localtunnel');

const port = parseInt(process.argv[2], 10) || 5173;
const sub = process.argv[3] && process.argv[3] !== 'none' ? process.argv[3] : undefined;

(async () => {
  try {
    const t = await localtunnel({
      port,
      local_host: '127.0.0.1',
      subdomain: sub,
    });
    process.stdout.write(`LUMEN_TUNNEL_URL=${t.url}\n`);
    t.on('close', () => process.exit(0));
  } catch (e) {
    process.stderr.write(`LUMEN_TUNNEL_ERR=${e.message || e}\n`);
    process.exit(2);
  }
})();
