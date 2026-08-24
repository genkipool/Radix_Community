/**
 * Guards for the links other features build into the dashboard.
 *
 * These broke once already: a Radix Seal explorer link resolved server-side but
 * the client bounced it away, and the MCP deep link was still emitting the
 * pre-migration query format. Both are cheap to assert and expensive to notice
 * by hand.
 */
import { describe, it, expect } from 'vitest';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import { explorerTxUrl } from '@/features/sign/lib/explorer';
import { dashboardTxUrl } from '@/services/mcp/dapp';

const SEAL_MAINNET = 'resource_rdx1nf89ryugl2ytuh7lfcrpt7ghudnfah7gdcwwjw6y3e6v5cwrr5tfxs';
const SEAL_STOKENET = 'resource_tdx_2_1n20d5q2y9p46zrjaw543vcpdmk3dygtlq4uzyw2zvssg48cxsteu3e';

/** No link anywhere may go back to the pre-migration query format. */
function assertCanonical(href: string) {
  expect(href).not.toMatch(/view=transactions/);
  expect(href).not.toMatch(/[?&]tx=/);
  expect(href).not.toMatch(/[?&]search=/);
  expect(href).toMatch(/\/dashboard\/(staking|explorer|tx|resource|account|validator)\b/);
}

describe('Radix Seal brand-resource links', () => {
  it('point at the resource page on the right ledger', () => {
    const mainnet = dashboardRoutes.entity('es', SEAL_MAINNET, { network: 'mainnet' });
    const stokenet = dashboardRoutes.entity('es', SEAL_STOKENET, { network: 'stokenet' });

    expect(mainnet).toBe(`/es/dashboard/resource/${SEAL_MAINNET}?network=mainnet`);
    expect(stokenet).toBe(`/es/dashboard/resource/${SEAL_STOKENET}?network=stokenet`);
    assertCanonical(mainnet);
    assertCanonical(stokenet);
  });

  it('keeps the network, since the ledger cannot be inferred from the page', () => {
    // A Stokenet resource opened without its network would resolve against
    // mainnet and silently show nothing.
    expect(dashboardRoutes.entity('es', SEAL_STOKENET, { network: 'stokenet' })).toContain(
      'network=stokenet',
    );
  });
});

describe('links built by other features', () => {
  it('the signing feature links to the transaction page, on its own ledger', () => {
    // The hash names its network, so the link says so too: opened elsewhere,
    // the page would otherwise fall back to the reader's last-used ledger.
    const href = explorerTxUrl('es', 'txid_rdx1abc');
    expect(href).toBe('/es/dashboard/tx/txid_rdx1abc?network=mainnet');
    assertCanonical(href);

    const stokenet = explorerTxUrl('es', 'txid_tdx_2_1abc');
    expect(stokenet).toBe('/es/dashboard/tx/txid_tdx_2_1abc?network=stokenet');
    assertCanonical(stokenet);
  });

  it('the MCP deep link is canonical for a real hash', () => {
    const href = dashboardTxUrl('mainnet', 'txid_rdx1abc');
    expect(href).toContain('/es/dashboard/tx/txid_rdx1abc');
    expect(href).toContain('network=mainnet');
    assertCanonical(href);
  });

  it('the MCP template keeps its placeholder substitutable', () => {
    // Agents replace `<intent_hash>`, so it must stay in the path and unescaped.
    const href = dashboardTxUrl('<network>');
    expect(href).toContain('/es/dashboard/tx/<intent_hash>');
    expect(href).not.toContain('%3C');
  });
});
