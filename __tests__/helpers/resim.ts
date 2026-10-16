/**
 * A throwaway Radix Engine ledger (resim) for tests that must prove a manifest
 * actually commits, not just that it parses.
 *
 * resim keeps its ledger in ~/.scrypto and ignores XDG_DATA_HOME, so every
 * ledger here runs with HOME pointed at a fresh temporary directory: the
 * developer's own simulator state is never touched. `RESIM` is undefined when
 * resim is not installed (CI), and the suites skip.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';

export const SIMULATOR_NETWORK_ID = 242;
export const SIM_XRD = 'resource_sim1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxakj8n3';

export const RESIM = [join(homedir(), '.cargo/bin/resim'), 'resim'].find((bin) => {
  try {
    execFileSync(bin, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
});

export interface ResimAccount {
  address: string;
  publicKey: string;
  privateKey: string;
  ownerBadge: string;
}

export interface ResimRun {
  committed: boolean;
  output: string;
  /** Addresses listed under "New Entities", in order. */
  newEntities: string[];
}

export class ResimLedger {
  readonly home = mkdtempSync(join(tmpdir(), 'resim-'));
  private seq = 0;

  constructor() {
    this.exec('reset');
  }

  exec(...args: string[]): string {
    return execFileSync(RESIM!, args, {
      cwd: this.home,
      env: { ...process.env, HOME: this.home },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  newAccount(): ResimAccount {
    const out = this.exec('new-account');
    const pick = (label: string) => out.match(new RegExp(`${label}: (\\S+)`))?.[1] ?? '';
    return {
      address: pick('Account component address'),
      publicKey: pick('Public key'),
      privateKey: pick('Private key'),
      ownerBadge: pick('Owner badge'),
    };
  }

  /** Makes `account` the signer (and fee payer) of the following runs. */
  use(account: ResimAccount) {
    this.exec('set-default-account', account.address, account.privateKey, account.ownerBadge);
  }

  newToken(supply: string, name: string): string {
    const out = this.exec('new-token-fixed', supply, '--name', name);
    return out.match(/Resource: (resource_sim1\w+)/)?.[1] ?? '';
  }

  newBadge(name: string): string {
    const out = this.exec('new-badge-fixed', '1', '--name', name);
    return out.match(/Resource: (resource_sim1\w+)/)?.[1] ?? '';
  }

  /**
   * Runs a manifest built for the wallet. The wallet adds the fee lock itself,
   * so the test prepends one paid by `feePayer`.
   */
  run(manifest: string, feePayer: string): ResimRun {
    const file = join(this.home, `tx-${++this.seq}.rtm`);
    writeFileSync(
      file,
      `CALL_METHOD\n    Address("${feePayer}")\n    "lock_fee"\n    Decimal("500")\n;\n${manifest}`,
    );
    let output: string;
    try {
      output = this.exec('run', file);
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string };
      output = `${e.stdout ?? ''}\n${e.stderr ?? ''}`;
    }
    const entities = output.split('New Entities:')[1] ?? '';
    return {
      committed: /Transaction Status: COMMITTED SUCCESS/.test(output),
      output,
      newEntities: [...entities.matchAll(/(?:Component|Resource|Package): (\w+)/g)].map((m) => m[1]),
    };
  }

  /** Fungible balance of `resource` in `account` (0 when absent). */
  balance(account: string, resource: string): string {
    const out = this.exec('show', account);
    // "├─ resource_sim1…: 1000000 Alpha" under "Owned Fungible Resources".
    const line = out.split('\n').find((l) => l.includes(`${resource}:`)) ?? '';
    return line.match(new RegExp(`${resource}: ([\\d.]+)`))?.[1] ?? '0';
  }

  show(address: string): string {
    return this.exec('show', address);
  }

  dispose() {
    rmSync(this.home, { recursive: true, force: true });
  }
}

/** Fails with the manifest and resim's output, so a broken builder is obvious. */
export function expectCommitted(run: ResimRun, manifest = '') {
  if (!run.committed) {
    throw new Error(`Transaction did not commit.\n--- manifest ---\n${manifest}\n--- resim ---\n${run.output.slice(-4000)}`);
  }
}

/* Minimal bech32m, enough to move a well-known address between networks. */
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const polymod = (values: number[]) =>
  values.reduce((chk, v) => {
    const top = chk >>> 25;
    let next = ((chk & 0x1ffffff) << 5) ^ v;
    GEN.forEach((g, i) => {
      if ((top >>> i) & 1) next ^= g;
    });
    return next;
  }, 1);
const hrpExpand = (hrp: string) => [
  ...[...hrp].map((c) => c.charCodeAt(0) >>> 5),
  0,
  ...[...hrp].map((c) => c.charCodeAt(0) & 31),
];
function reencode(address: string, hrp: string): string {
  const sep = address.lastIndexOf('1');
  const data = [...address.slice(sep + 1, -6)].map((c) => CHARSET.indexOf(c));
  const mod = polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 0x2bc830a3;
  const checksum = Array.from({ length: 6 }, (_, i) => (mod >>> (5 * (5 - i))) & 31);
  return `${hrp}1${[...data, ...checksum].map((d) => CHARSET[d]).join('')}`;
}

/**
 * Well-known package addresses on the simulator. The toolkit's list predates
 * the locker package, so that one is re-encoded from its mainnet address: the
 * well-known entities share their bytes across networks.
 */
export async function simulatorPackages() {
  const known = await RadixEngineToolkit.Utils.knownAddresses(SIMULATOR_NETWORK_ID);
  return {
    pool: known.packageAddresses.poolPackage,
    resource: known.packageAddresses.resourcePackage,
    accessController: known.packageAddresses.accessControllerPackage,
    locker: reencode('package_rdx1pkgxxxxxxxxxlckerxxxxxxxxxx000208064247xxxxxxxxxlckerx', 'package_sim'),
  };
}
