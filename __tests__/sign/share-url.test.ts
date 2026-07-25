import { describe, it, expect } from 'vitest';
import { buildShareUrl, parseNetworkParam } from '@/features/sign/lib/share';

describe('share link network', () => {
  it('carries the network on a plain document-delivery link', () => {
    const url = buildShareUrl({
      origin: 'https://app.test',
      pathname: '/es/console/sign-document',
      docName: 'c.pdf',
      networkId: 2,
      tab: 'sign',
      sendRoomId: 'a'.repeat(32),
    });
    expect(url).toContain('net=2');
    const net = new URL(url).searchParams.get('net');
    expect(parseNetworkParam(net)).toBe(2);
  });

  it('carries the network on a request link too', () => {
    const url = buildShareUrl({
      origin: 'https://app.test',
      pathname: '/es/console/sign-document',
      requestKey: 'resource_tdx_2_1abc:#3#',
      networkId: 2,
    });
    expect(url).toContain('/r/resource_tdx_2_1abc/3');
    expect(url).toContain('net=2');
  });

  it('omits the param when no network is given', () => {
    const url = buildShareUrl({
      origin: 'https://app.test',
      pathname: '/es/console/sign-document',
      docName: 'c.pdf',
    });
    expect(url).not.toContain('net=');
    expect(parseNetworkParam(null)).toBeNull();
    expect(parseNetworkParam('9')).toBeNull();
  });
});
