'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { downloadBytes, isFullySigned } from '../lib/certificate';
import { networkIdFromResource, networkNameForId } from '../lib/network';
import { extractRadixAttachments, isPdfBytes } from '../lib/pdf-extract';
import {
  parseNetworkParam,
  parseOutputsParam,
  parseSendRoom,
  parseWatermarkParams,
} from '../lib/share';
import { fetchOnChainStatus } from '../services/signApi';
import type { AttestationEnvelope } from '../types/sign.types';
import type { DocumentFile } from './useDocumentFile';
import { useReceiveFileChannel } from './useFileChannel';

const useBeforePaint =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface ReceivedSignedFile {
  bytes: Uint8Array;
  name: string;
  envelope: AttestationEnvelope;
}

/**
 * Parses shared signing link parameters (route & query), enforces the target
 * network once on load, listens for P2P browser-to-browser file delivery, and
 * shares the on-ledger request status query cache with {@link OnChainSignPanel}.
 */
export function useSharedSignLink({
  doc,
  onAutoSwitchVerify,
}: {
  doc: DocumentFile;
  onAutoSwitchVerify: () => void;
}) {
  const { switchNetwork } = useRadixWallet();
  const routeParams = useParams<{ collection?: string; id?: string }>();
  const searchParams = useSearchParams();

  const sharedRequestKey =
    searchParams.get('req') ??
    (routeParams.collection && routeParams.id
      ? `${routeParams.collection}:#${routeParams.id}#`
      : undefined);
  const requestDocName = searchParams.get('doc') ?? undefined;
  const sharedOutputs = parseOutputsParam(searchParams.get('out'));
  const sharedWatermark = parseWatermarkParams(
    searchParams.get('wm'),
    searchParams.get('wmt'),
  );
  const hasRequestParam = !!sharedRequestKey;
  const requestNetworkId = (sharedRequestKey
    ? networkIdFromResource(sharedRequestKey)
    : parseNetworkParam(searchParams.get('net'))) as RadixNetworkId | null;
  const tabParam = searchParams.get('tab');

  const networkForced = useRef(false);
  useEffect(() => {
    if (requestNetworkId == null || networkForced.current) return;
    networkForced.current = true;
    switchNetwork(networkNameForId(requestNetworkId));
  }, [requestNetworkId, switchNetwork]);

  const [sendRoom, setSendRoom] = useState<string | null>(null);
  const [receivedSigned, setReceivedSigned] =
    useState<ReceivedSignedFile | null>(null);

  useBeforePaint(() => {
    const room = parseSendRoom(window.location.hash);
    if (room) {
      history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      );
    }
    setSendRoom(room);
  }, []);

  const receive = useReceiveFileChannel({
    roomId: sendRoom,
    onFile: (file) => {
      void doc.onFile(file);
      void (async () => {
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (!isPdfBytes(bytes)) return;
          const att = await extractRadixAttachments(bytes);
          if (!att.envelope || !isFullySigned(att.envelope)) return;
          setReceivedSigned({ bytes, name: file.name, envelope: att.envelope });
          onAutoSwitchVerify();
          downloadBytes(bytes, file.name, 'application/pdf');
        } catch {
          /* the file is loaded either way */
        }
      })();
    },
  });

  const sharedStatusQuery = useQuery({
    queryKey: ['sign-onchain-status', requestNetworkId, sharedRequestKey ?? ''],
    queryFn: () =>
      fetchOnChainStatus({
        networkId: requestNetworkId!,
        requestId: sharedRequestKey!,
      }),
    enabled: hasRequestParam && requestNetworkId != null,
  });
  const sharedRequestDocHash = sharedStatusQuery.data?.found
    ? sharedStatusQuery.data.docHash
    : null;

  const receiving =
    (!!sendRoom && receive.phase !== 'done' && receive.phase !== 'error') ||
    receive.phase === 'connecting' ||
    receive.phase === 'receiving';

  return {
    tabParam,
    sharedRequestKey,
    requestDocName,
    sharedOutputs,
    sharedWatermark,
    hasRequestParam,
    requestNetworkId,
    receive,
    receiving,
    receivedSigned,
    sharedRequestDocHash,
  };
}
