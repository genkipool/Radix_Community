'use client';

import { useEffect, useRef } from 'react';

/**
 * Ties the wallet requests a component sends to that component.
 *
 * Pass `signal()` to `sendToWallet` with each request. `abandon()` (from a
 * reset or a "start over") cancels the ones still waiting, in the wallet too,
 * and so does the component going away: closing the modal or popup, switching
 * tab, leaving the page. Otherwise the request stays in the Radix Connector
 * extension and on the phone with nobody waiting for it.
 *
 * A request the wallet has already received is still dropped from the
 * extension; on the phone only the person can reject it.
 */
export function useWalletRequestScope() {
  const controllers = useRef(new Set<AbortController>());
  // Once unmounted, a flow still running (seal, then collection) sends nothing more.
  const gone = useRef(false);

  const abandon = () => {
    const waiting = [...controllers.current];
    controllers.current.clear();
    waiting.forEach((controller) => controller.abort());
  };

  /** A signal for one request; it is aborted by `abandon` or on unmount. */
  const signal = () => {
    const controller = new AbortController();
    if (gone.current) controller.abort();
    else controllers.current.add(controller);
    return controller.signal;
  };

  useEffect(() => {
    const owned = controllers.current;
    gone.current = false;
    return () => {
      gone.current = true;
      const waiting = [...owned];
      owned.clear();
      waiting.forEach((controller) => controller.abort());
    };
  }, []);

  return { signal, abandon };
}
