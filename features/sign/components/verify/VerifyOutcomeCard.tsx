'use client';

import {
  CheckCircle2,
  Circle,
  Clock,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import type { VerifyOutcome } from '../../hooks/useDocumentVerify';
import type { SignDictionary } from '../../types/dictionary';
import type { VerifiedSignature } from '../../types/sign.types';
import { DetailRow } from '../SignResultPanel';

export function VerifyOutcomeCard({
  t,
  outcome,
}: {
  t: SignDictionary;
  outcome: VerifyOutcome;
}) {
  const pendingSigners = outcome.requiredSigners.filter(
    (account) =>
      !outcome.signatures.some((s) => s.signerAccount === account && s.valid),
  );

  return (
    <ToolSection>
      <div className="flex items-center gap-3">
        {outcome.ok ? (
          <ShieldCheck className="size-7 text-[var(--color-success)]" />
        ) : (
          <ShieldX className="size-7 text-[var(--color-danger)]" />
        )}
        <h3
          className="text-base font-bold"
          style={{ color: 'var(--color-text-main)' }}
        >
          {outcome.ok ? t.verify.validTitle : t.verify.invalidTitle}
        </h3>
      </div>

      <ul className="space-y-2 text-sm">
        <CheckItem
          ok={outcome.fileMatches}
          okText={t.verify.fileMatch}
          badText={t.verify.fileMismatch}
        />
        <CheckItem
          ok={outcome.complete}
          okText={t.verify.complete}
          badText={t.verify.incomplete}
        />
        {outcome.onChainValid === null ? (
          <li style={{ color: 'var(--color-text-muted)' }}>
            • {t.verify.offchain}
          </li>
        ) : (
          <CheckItem
            ok={outcome.onChainValid}
            okText={t.verify.onchainValid}
            badText={t.verify.onchainInvalid}
          />
        )}
        {outcome.sealValid !== null && (
          <CheckItem
            ok={outcome.sealValid}
            okText={t.verify.sealValid}
            badText={t.verify.sealInvalid}
          />
        )}
      </ul>

      {outcome.requestSource !== 'none' && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {outcome.requestSource === 'typed'
            ? t.verify.requestFromKey
            : t.verify.requestFromCert}
        </p>
      )}
      {outcome.requestMismatch && (
        <p
          className="flex items-start gap-2 rounded-xl border px-3 py-2 text-xs"
          style={{
            borderColor: 'var(--color-warning, #eab308)',
            color: 'var(--color-text-main)',
          }}
        >
          <TriangleAlert
            className="mt-0.5 size-3.5 shrink-0"
            style={{ color: 'var(--color-warning, #eab308)' }}
          />
          {t.verify.requestMismatch}
        </p>
      )}

      <div
        className="pt-2 border-t space-y-2"
        style={{ borderColor: 'var(--color-card-border)' }}
      >
        <p
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {t.verify.signersHeader}
        </p>
        {outcome.signatures.map((s) => (
          <div
            key={s.signerAccount}
            className="flex items-start gap-2 text-sm"
          >
            {s.valid ? (
              <CheckCircle2 className="size-4 text-[var(--color-success)] shrink-0 mt-0.5" />
            ) : (
              <XCircle className="size-4 text-[var(--color-danger)] shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <span
                className="font-mono text-[12px] break-all"
                style={{ color: 'var(--color-text-main)' }}
              >
                {s.signerAccount}
              </span>
              {s.disclosedName && (
                <span
                  className="text-[12px]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {' · '}
                  {s.disclosedName}
                </span>
              )}
              {s.disclosedEmail && (
                <p
                  className="text-[12px]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {s.disclosedEmail}
                </p>
              )}
              {s.valid && <SignatureClock t={t} signature={s} />}
            </div>
          </div>
        ))}
        {outcome.signatures.some((s) => s.valid && s.disclosedName) && (
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t.verify.nameDeclared}
          </p>
        )}
      </div>

      {pendingSigners.length > 0 && (
        <div
          className="pt-2 border-t space-y-2"
          style={{ borderColor: 'var(--color-card-border)' }}
        >
          <p
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t.verify.pendingHeader}
          </p>
          {pendingSigners.map((account) => (
            <div key={account} className="flex items-center gap-2 text-sm">
              <Circle
                className="size-4 shrink-0"
                style={{ color: 'var(--color-text-muted)' }}
              />
              <span
                className="font-mono text-[12px] break-all"
                style={{ color: 'var(--color-text-main)' }}
              >
                {account}
              </span>
            </div>
          ))}
        </div>
      )}

      {outcome.message && (
        <div
          className="pt-2 border-t space-y-2"
          style={{ borderColor: 'var(--color-card-border)' }}
        >
          {!outcome.payloadBound && (
            <>
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t.verify.declaredHeader}
              </p>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t.verify.declaredNote}
              </p>
            </>
          )}
          <dl className="grid gap-2 text-sm">
            <DetailRow label={t.verify.message} value={outcome.message} />
            <DetailRow
              label={t.verify.timestamp}
              value={new Date(outcome.timestamp).toLocaleString()}
            />
          </dl>
          {outcome.createdAtCoherent === false && (
            <p
              className="text-xs font-semibold"
              style={{ color: 'var(--color-danger, #dc2626)' }}
            >
              {t.verify.createdIncoherent}
            </p>
          )}
        </div>
      )}
    </ToolSection>
  );
}

function SignatureClock({
  t,
  signature,
}: {
  t: SignDictionary;
  signature: VerifiedSignature;
}) {
  if (!signature.anchoredAt || !signature.anchorSource) {
    return (
      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        {t.verify.clockNone}
      </p>
    );
  }

  const disagrees = signature.signedAtAnchored === false;
  const source =
    signature.anchorSource === 'ledger'
      ? t.verify.clockLedger
      : t.verify.clockTimestamp.replace(
          '{authority}',
          signature.timestampAuthority || '—',
        );

  return (
    <>
      <p
        className="flex items-center gap-1.5 text-[11px]"
        style={{
          color: disagrees
            ? 'var(--color-danger, #dc2626)'
            : 'var(--color-text-muted)',
        }}
      >
        <Clock className="size-3 shrink-0" />
        <span>
          {source} · {new Date(signature.anchoredAt).toLocaleString()}
        </span>
      </p>
      {disagrees && (
        <p
          className="text-[11px] font-semibold"
          style={{ color: 'var(--color-danger, #dc2626)' }}
        >
          {t.verify.clockMismatch}
        </p>
      )}
      {signature.timestampUntrustedAnchor && (
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          {t.verify.clockUntrusted}
        </p>
      )}
      {signature.issuedAtAnchored === false && (
        <p
          className="text-[11px] font-semibold"
          style={{ color: 'var(--color-danger, #dc2626)' }}
        >
          {t.verify.clockIssuedAtMismatch}
        </p>
      )}
    </>
  );
}

function CheckItem({
  ok,
  okText,
  badText,
}: {
  ok: boolean;
  okText: string;
  badText: string;
}) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="size-4 text-[var(--color-success)] shrink-0" />
      ) : (
        <XCircle className="size-4 text-[var(--color-danger)] shrink-0" />
      )}
      <span style={{ color: 'var(--color-text-main)' }}>
        {ok ? okText : badText}
      </span>
    </li>
  );
}
