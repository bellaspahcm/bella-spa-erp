import { spawn } from 'node:child_process';
import net from 'node:net';

async function isPortAvailable(port) {
  try {
    await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(500) });
    return false;
  } catch (error) {
    if (!['ECONNREFUSED', 'UND_ERR_SOCKET'].includes(error?.cause?.code) && error?.name !== 'TimeoutError') {
      return false;
    }
  }

  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available E2E port found from ${startPort} to ${startPort + 99}.`);
}

function quoteCmdArg(value) {
  const text = String(value);
  if (!/[\s&|<>()^"]/g.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '\\"')}"`;
}

const env = { ...process.env };

if (!env.E2E_BASE_URL && !env.E2E_PORT) {
  env.E2E_PORT = String(await findAvailablePort(3104));
}

if (!env.E2E_REUSE_SERVER) {
  env.E2E_REUSE_SERVER = '0';
}

const playwrightArgs = [
  'playwright',
  'test',
  'e2e/tests/09-responsive-visual-smoke.spec.ts',
  ...process.argv.slice(2),
];
const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const args = process.platform === 'win32'
  ? ['/d', '/s', '/c', ['npx.cmd', ...playwrightArgs.map(quoteCmdArg)].join(' ')]
  : playwrightArgs;

const child = spawn(command, args, {
  env,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
