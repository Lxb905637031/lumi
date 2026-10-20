import { spawnSync } from 'node:child_process';
import { isIPv4 } from 'node:net';
import os from 'node:os';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function findLanAddress() {
  const interfaces = os.networkInterfaces();
  const addresses = Object.entries(interfaces)
    .filter(([name]) => !/^(?:lo|utun|tun|tap|bridge|docker|veth|virbr|vmnet|vboxnet|wg|tailscale)/i.test(name))
    .flatMap(([, entries]) => entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address)
    .filter((address) => /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(address));
  if (addresses.length === 1) return addresses[0];
  return undefined;
}

const host = process.env.TARO_DEVICE_HOST ?? findLanAddress();
if (!process.env.TARO_APP_API_BASE_URL && host) {
  if (!isIPv4(host) || host.startsWith('127.') || host === '0.0.0.0') {
    console.error('TARO_DEVICE_HOST must be the computer LAN IPv4 address.');
    process.exit(1);
  }
  process.env.TARO_APP_API_BASE_URL = `http://${host}:4300/api/v1`;
}

if (!process.env.TARO_APP_API_BASE_URL) {
  console.error('Unable to determine a unique LAN address. Set TARO_DEVICE_HOST or TARO_APP_API_BASE_URL.');
  process.exit(1);
}

const endpoint = new URL(process.env.TARO_APP_API_BASE_URL);
if (
  !['http:', 'https:'].includes(endpoint.protocol) ||
  ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
) {
  console.error('Device debugging requires an HTTP(S) API address reachable from the phone.');
  process.exit(1);
}

console.log(`Building miniapp for device debugging with API: ${process.env.TARO_APP_API_BASE_URL}`);
const result = spawnSync('pnpm', ['run', 'build'], {
  cwd: fileURLToPath(new URL('../apps/miniapp/', import.meta.url)),
  env: process.env,
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
