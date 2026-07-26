// @vitest-environment node
/**
 * When is a peer actually gone?
 *
 * ICE reports `disconnected` (and sometimes `failed`) on paths that are still
 * working: a busy TURN relay, a lossy uplink, a Wi-Fi hand-off. Acting on that
 * opinion tore down transfers that were visibly progressing, which is what made
 * some links reconnect over and over mid-file. These tests pin the rule that
 * replaced it: a peer counts as alive while frames keep arriving or the send
 * buffer keeps draining, whatever ICE says.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wirePeer } from '@/features/p2p/lib/webrtc';

type Listener = () => void;

class FakeDataChannel {
  readyState: RTCDataChannelState = 'open';
  bufferedAmount = 0;
  binaryType = 'blob';
  bufferedAmountLowThreshold = 0;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  readonly sent: unknown[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();

  send(data: unknown): void {
    this.sent.push(data);
  }
  addEventListener(type: string, fn: Listener): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(fn);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, fn: Listener): void {
    this.listeners.get(type)?.delete(fn);
  }
  close(): void {
    this.readyState = 'closed';
    this.onclose?.();
  }
  /** Simulate a frame arriving from the peer. */
  deliver(data: unknown): void {
    this.onmessage?.({ data });
  }
}

class FakePeerConnection {
  connectionState: RTCPeerConnectionState = 'connected';
  onconnectionstatechange: (() => void) | null = null;
  close(): void {
    this.connectionState = 'closed';
  }
  /** Simulate ICE changing its mind. */
  moveTo(state: RTCPeerConnectionState): void {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

function setup() {
  const dc = new FakeDataChannel();
  const pc = new FakePeerConnection();
  const messages: unknown[] = [];
  let closes = 0;
  const peer = wirePeer(
    pc as unknown as RTCPeerConnection,
    dc as unknown as RTCDataChannel,
    {
      onMessage: (message) => messages.push(message),
      onBinary: () => undefined,
      onClose: () => {
        closes += 1;
      },
    },
  );
  return { dc, pc, peer, messages, closed: () => closes };
}

describe('peer liveness', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps a `disconnected` session alive while frames keep arriving', async () => {
    const { dc, pc, closed } = setup();
    pc.moveTo('disconnected');

    // A minute of ICE unhappiness, with the peer plainly still talking.
    for (let i = 0; i < 20; i += 1) {
      await vi.advanceTimersByTimeAsync(3_000);
      dc.deliver('{"t":"chunk-start","index":1,"byteLength":10}');
    }
    expect(closed()).toBe(0);

    // It recovers, as `disconnected` usually does, with nothing torn down.
    pc.moveTo('connected');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(closed()).toBe(0);
  });

  it('gives up on a `disconnected` session once nothing proves it is there', async () => {
    const { pc, closed } = setup();
    pc.moveTo('disconnected');
    await vi.advanceTimersByTimeAsync(14_000);
    expect(closed()).toBe(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(closed()).toBe(1);
  });

  it('treats a closed channel as immediate, no grace involved', () => {
    const { dc, closed } = setup();
    dc.close();
    expect(closed()).toBe(1);
  });

  it('reports close exactly once', async () => {
    const { dc, pc, closed } = setup();
    pc.moveTo('failed');
    await vi.advanceTimersByTimeAsync(60_000);
    dc.close();
    pc.moveTo('closed');
    expect(closed()).toBe(1);
  });
});

describe('transport keepalive', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('proves an idle channel is alive without reaching the application', async () => {
    const { dc, messages } = setup();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(dc.sent.length).toBeGreaterThan(0);
    expect(dc.sent.every((frame) => frame === '{"t":"__ka"}')).toBe(true);

    // The peer's keepalives are transport business only.
    dc.deliver('{"t":"__ka"}');
    expect(messages).toEqual([]);
    dc.deliver('{"t":"bye"}');
    expect(messages).toEqual([{ t: 'bye' }]);
  });

  it('stays quiet while real data is queued', async () => {
    const { dc } = setup();
    dc.bufferedAmount = 512 * 1024;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(dc.sent).toEqual([]);
  });

  it('stops once the peer is gone', async () => {
    const { dc } = setup();
    dc.close();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(dc.sent).toEqual([]);
  });
});

describe('send backpressure', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hands the event loop back periodically while streaming', async () => {
    const { dc, peer } = setup();
    let yields = 0;
    const streaming = (async () => {
      for (let i = 0; i < 64; i += 1) {
        const before = dc.sent.length;
        const send = peer.sendBinary(new ArrayBuffer(16));
        // A frame that does not resolve within microtasks yielded a task.
        await Promise.resolve();
        if (dc.sent.length === before) yields += 1;
        await send;
      }
    })();
    await vi.advanceTimersByTimeAsync(1_000);
    await streaming;
    expect(dc.sent).toHaveLength(64);
    expect(yields).toBeGreaterThan(0);
  });

  it('refuses to send on a dead channel', async () => {
    const { dc, peer } = setup();
    dc.close();
    await expect(peer.sendBinary(new ArrayBuffer(16))).rejects.toThrow(
      'peer_disconnected',
    );
  });
});
