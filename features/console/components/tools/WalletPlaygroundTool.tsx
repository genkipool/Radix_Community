'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Database, Fingerprint, Info, LogIn, ShieldCheck, UserRound } from 'lucide-react';
import type { WalletData } from '@radixdlt/radix-dapp-toolkit';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { NETWORKS, RadixNetworkId } from '@/features/wallet/constants/network';
import {
  buildWalletInteraction,
  buildWalletRequestItems,
  generateRolaChallenge,
  needsChallenge,
  validateWalletRequest,
  type Quantifier,
  type WalletAuthMode,
  type WalletInteraction,
  type WalletRequestSpec,
} from '@/features/wallet/lib/wallet-interaction';
import { sendPlaygroundRequest } from '../../lib/playground-wallet';
import type { RolaProofResult } from '@/services/rola/verify';
import { truncateAddress } from '@/utils/formatters';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { OptionButtons } from '../shared/OptionButtons';
import { ToolSection } from '../shared/ToolSection';
import { RadixLogo } from '@/components/shared/RadixLogo';
import { JsonFileButton, JsonPanel } from './wallet-playground/JsonFile';
import { ResponseView } from './wallet-playground/ResponseView';

type Kind = 'oneTime' | 'login' | 'proof';
type LoginAuth = Exclude<WalletAuthMode, 'none'>;
type Scope = 'oneTime' | 'ongoing';
type JsonFile = 'request' | 'response';

type Outcome =
  | { status: 'idle' }
  | { status: 'waiting' }
  | { status: 'ok'; sent: WalletInteraction; walletData: WalletData; walletResponse: unknown; challenge: string | null }
  | { status: 'error'; sent: WalletInteraction | null; code: string; message?: string };

/** Taller option buttons than the console default, for an easier target. */
const OPTION_HEIGHT = 'min-h-11 py-2.5';

const COUNT_OPTIONS = ['1', '2', '3', '4', '5'] as const;
const VALUE_COUNT_OPTIONS = ['1', '2', '3'] as const;

const KIND_ICONS: Record<Kind, ReactNode> = {
  oneTime: <Database className="size-4" />,
  login: <LogIn className="size-4" />,
  proof: <ShieldCheck className="size-4" />,
};

/**
 * Turns a multi-select OptionButtons into a single choice that can be cleared:
 * clicking another value selects only it, clicking the active one empties it.
 */
const toggleOne = (next: string[], prev: string[]) => next.filter((v) => !prev.includes(v)).slice(-1);

/** A labelled block, in the console's plain style. */
function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
        {hint && (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {hint}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

export default function WalletPlaygroundTool({ t }: ConsoleToolProps) {
  const labels = t.walletPlayground;
  const issueText = labels.issues as Record<string, string>;
  const errorTexts = labels.errors as Record<string, string>;
  const { activeNetworkId, accounts: sessionAccounts, persona } = useRadixWallet();
  const panelId = useId();

  // ── Request builder state ────────────────────────────────────────────────
  const [kind, setKind] = useState<Kind>('oneTime');
  const [auth, setAuth] = useState<LoginAuth>('loginWithChallenge');
  const [accountCount, setAccountCount] = useState<string[]>([]);
  const [quantifier, setQuantifier] = useState<Quantifier>('atLeast');
  const [withProof, setWithProof] = useState(false);
  const [accountsScope, setAccountsScope] = useState<Scope>('ongoing');
  const [wantsName, setWantsName] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [emailQuantifier, setEmailQuantifier] = useState<Quantifier>('atLeast');
  const [phones, setPhones] = useState<string[]>([]);
  const [phoneQuantifier, setPhoneQuantifier] = useState<Quantifier>('atLeast');
  const [personaScope, setPersonaScope] = useState<Scope>('ongoing');
  const [reset, setReset] = useState<string[]>([]);
  const [proofAccounts, setProofAccounts] = useState<string[]>([]);
  const [proofIdentity, setProofIdentity] = useState(true);

  // ── Request lifecycle ────────────────────────────────────────────────────
  const [outcome, setOutcome] = useState<Outcome>({ status: 'idle' });
  const [openFile, setOpenFile] = useState<JsonFile | null>(null);
  const [rola, setRola] = useState<RolaProofResult[] | null>(null);
  const [rolaError, setRolaError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const requestSeq = useRef(0);

  const identityAddress = persona?.identityAddress || undefined;
  const quantity = Number(accountCount[0] ?? 0);
  const isWaiting = outcome.status === 'waiting';

  const spec: WalletRequestSpec = (() => {
    if (kind === 'proof') {
      return {
        auth: 'usePersona',
        identityAddress,
        proofOfOwnership: { accountAddresses: proofAccounts, proveIdentity: proofIdentity },
      };
    }
    const wantsData = wantsName || emails.length > 0 || phones.length > 0;
    const scopeFor = (scope: Scope): Scope => (kind === 'oneTime' ? 'oneTime' : scope);
    return {
      auth: kind === 'oneTime' ? 'none' : auth,
      identityAddress: kind === 'login' && auth === 'usePersona' ? identityAddress : undefined,
      accounts: quantity > 0 ? { scope: scopeFor(accountsScope), quantifier, quantity, withProof } : undefined,
      personaData: wantsData
        ? {
            scope: scopeFor(personaScope),
            fullName: wantsName,
            ...(emails.length > 0 ? { emailAddresses: { quantifier: emailQuantifier, quantity: Number(emails[0]) } } : {}),
            ...(phones.length > 0 ? { phoneNumbers: { quantifier: phoneQuantifier, quantity: Number(phones[0]) } } : {}),
          }
        : undefined,
      reset: kind === 'login' ? { accounts: reset.includes('accounts'), personaData: reset.includes('personaData') } : undefined,
    };
  })();

  const issues = validateWalletRequest(spec);
  const signs = needsChallenge(spec);
  const network = activeNetworkId ? NETWORKS[activeNetworkId as RadixNetworkId] : null;

  /** What will be sent, or what was sent once the wallet has it. */
  const requestJson = (() => {
    const sent = outcome.status === 'ok' || outcome.status === 'error' ? outcome.sent : null;
    if (sent) return JSON.stringify(sent, null, 2);
    if (issues.length > 0 || !network) return null;
    const placeholder = labels.pendingValue;
    const interaction = buildWalletInteraction({
      items: buildWalletRequestItems(spec, signs ? placeholder : undefined),
      networkId: network.networkId,
      dAppDefinitionAddress: network.dAppDefinitionAddress,
      origin: typeof window === 'undefined' ? '' : window.location.origin,
      interactionId: placeholder,
    });
    return JSON.stringify(interaction, null, 2);
  })();

  const requestIsLive = outcome.status === 'ok' || (outcome.status === 'error' && !!outcome.sent);
  const responseJson =
    outcome.status === 'ok'
      ? JSON.stringify(outcome.walletResponse ?? outcome.walletData, null, 2)
      : null;

  // Any edit makes the previous answer stale: the request file goes back to preview.
  const edit = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    if (outcome.status !== 'waiting' && outcome.status !== 'idle') {
      setOutcome({ status: 'idle' });
      setRola(null);
      setRolaError(null);
      if (openFile === 'response') setOpenFile(null);
    }
  };

  const handleSend = async () => {
    if (!activeNetworkId || issues.length > 0 || isWaiting) return;
    const seq = ++requestSeq.current;
    const challenge = signs ? generateRolaChallenge() : null;
    const items = buildWalletRequestItems(spec, challenge ?? undefined);
    setOutcome({ status: 'waiting' });
    setRola(null);
    setRolaError(null);
    setIsVerifying(false);

    const result = await sendPlaygroundRequest(activeNetworkId as RadixNetworkId, items);
    if (seq !== requestSeq.current) return;
    if (result.ok) {
      setOutcome({ status: 'ok', sent: result.sent, walletData: result.walletData, walletResponse: result.walletResponse, challenge });
      void verifyProofs(seq, result.walletData, challenge);
    } else {
      setOutcome({ status: 'error', sent: result.sent, code: result.error, message: result.message });
    }
  };

  const handleStopWaiting = () => {
    requestSeq.current += 1;
    setOutcome({ status: 'idle' });
  };

  /** Checks every returned signature server-side, as a dApp backend would. */
  const verifyProofs = async (seq: number, walletData: WalletData, challenge: string | null) => {
    const proofs = walletData.proofs ?? [];
    const signed = challenge ?? proofs[0]?.challenge;
    if (!activeNetworkId || !signed || proofs.length === 0) return;
    setIsVerifying(true);
    try {
      const res = await fetch('/api/auth/radix/rola-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          networkId: activeNetworkId,
          challenge: signed,
          items: proofs.map(({ type, address, proof }) => ({ type, address, proof })),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { results: RolaProofResult[] };
      if (seq === requestSeq.current) setRola(data.results);
    } catch {
      if (seq === requestSeq.current) setRolaError(labels.errors.verifyFailed);
    }
    if (seq === requestSeq.current) setIsVerifying(false);
  };

  const errorText = (code: string) =>
    errorTexts[code] ?? labels.errors.generic;

  // ── Reusable builder fragments ───────────────────────────────────────────
  const quantifierButtons = (value: Quantifier, onChange: (q: Quantifier) => void, inactive = false) => (
    <OptionButtons<Quantifier>
      options={[
        { value: 'atLeast', label: labels.atLeast, title: labels.atLeastHint },
        { value: 'exactly', label: labels.exactly, title: labels.exactlyHint },
      ]}
      value={value}
      onChange={edit(onChange)}
      size="sm"
      buttonClassName={OPTION_HEIGHT}
      disabled={isWaiting || inactive}
    />
  );

  const scopeButtons = (value: Scope, onChange: (s: Scope) => void, inactive = false) => (
    <Group label={labels.scopeLabel} hint={labels.scopeHint}>
      <OptionButtons<Scope>
        options={[
          { value: 'ongoing', label: labels.scopeOngoing, title: labels.scopeOngoingHint },
          { value: 'oneTime', label: labels.scopeOneTime, title: labels.scopeOneTimeHint },
        ]}
        value={value}
        onChange={edit(onChange)}
        size="sm"
        buttonClassName={OPTION_HEIGHT}
        disabled={isWaiting || inactive}
      />
    </Group>
  );

  const countButtons = (options: readonly string[], value: string[], onChange: (v: string[]) => void) => (
    <OptionButtons
      multiple
      hideCheck
      options={options.map((n) => ({ value: n, label: n }))}
      value={value}
      onChange={(next) => edit(onChange)(toggleOne(next, value))}
      size="sm"
      buttonClassName={OPTION_HEIGHT}
      disabled={isWaiting}
    />
  );

  const accountsGroup = (
    <ToolSection title={labels.accountsTitle} hint={labels.accountsHint}>
      <div className="space-y-6">
        {countButtons(COUNT_OPTIONS, accountCount, setAccountCount)}
        {/* Always rendered (disabled without addresses) so the page never jumps. */}
        {quantifierButtons(quantifier, setQuantifier, quantity === 0)}
        <Group label={labels.proofLabel} hint={labels.proofHint}>
              <OptionButtons
                options={[
                  { value: 'no', label: labels.proofOff, title: labels.proofOffHint },
                  { value: 'yes', label: labels.proofOn, title: labels.proofOnHint },
                ]}
                value={withProof ? 'yes' : 'no'}
                onChange={(v) => edit(setWithProof)(v === 'yes')}
                size="sm"
                buttonClassName={OPTION_HEIGHT}
                disabled={isWaiting || quantity === 0}
              />
        </Group>
        {kind === 'login' && scopeButtons(accountsScope, setAccountsScope, quantity === 0)}
      </div>
    </ToolSection>
  );

  const valueRow = (label: string, value: string[], onChange: (v: string[]) => void, q: Quantifier, onQuantifier: (q: Quantifier) => void) => (
    <div className="space-y-2">
      <span className="block text-xs font-semibold" style={{ color: 'var(--color-text-main)' }}>
        {label}
      </span>
      {countButtons(VALUE_COUNT_OPTIONS, value, onChange)}
      {quantifierButtons(q, onQuantifier, value.length === 0)}
    </div>
  );

  const personaDataGroup = (
    <ToolSection title={labels.personaDataTitle} hint={labels.personaDataHint}>
      <div className="space-y-5">
        <OptionButtons
          multiple
          options={[{ value: 'name', label: labels.personaDataName, icon: <UserRound className="size-3.5" /> }]}
          value={wantsName ? ['name'] : []}
          onChange={(v) => edit(setWantsName)(v.length > 0)}
          size="sm"
          buttonClassName={OPTION_HEIGHT}
          disabled={isWaiting}
        />
        {valueRow(labels.emailsLabel, emails, setEmails, emailQuantifier, setEmailQuantifier)}
        {valueRow(labels.phonesLabel, phones, setPhones, phoneQuantifier, setPhoneQuantifier)}
        {kind === 'login' && scopeButtons(personaScope, setPersonaScope, !(wantsName || emails.length > 0 || phones.length > 0))}
      </div>
    </ToolSection>
  );

  const toggleFile = (file: JsonFile) => setOpenFile(openFile === file ? null : file);

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <header className="space-y-1">
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
            {labels.configTitle}
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {labels.configHint}
          </p>
        </header>

        <div className="space-y-5">
          <ToolSection title={labels.kindTitle}>
            <OptionButtons<Kind>
              layout="grid"
              className="sm:grid-cols-3"
              options={(['oneTime', 'login', 'proof'] as const).map((k) => ({
                value: k,
                label: labels.kinds[k].title,
                description: labels.kinds[k].desc,
                icon: KIND_ICONS[k],
              }))}
              value={kind}
              onChange={edit(setKind)}
              size="sm"
              buttonClassName={OPTION_HEIGHT}
              disabled={isWaiting}
            />
          </ToolSection>

          {kind === 'login' && (
            <ToolSection title={labels.authTitle} hint={labels.authHint}>
              <div className="space-y-3">
                <OptionButtons<LoginAuth>
                  options={[
                    { value: 'loginWithChallenge', label: labels.authChallenge, title: labels.authChallengeHint, icon: <Fingerprint className="size-3.5" /> },
                    { value: 'loginWithoutChallenge', label: labels.authNoChallenge, title: labels.authNoChallengeHint },
                    { value: 'usePersona', label: labels.authUsePersona, title: labels.authUsePersonaHint },
                  ]}
                  value={auth}
                  onChange={edit(setAuth)}
                  size="sm"
                  buttonClassName={OPTION_HEIGHT}
                  disabled={isWaiting}
                />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  {auth === 'loginWithChallenge' ? labels.authChallengeHint : auth === 'loginWithoutChallenge' ? labels.authNoChallengeHint : labels.authUsePersonaHint}
                </p>
              </div>
            </ToolSection>
          )}

          {kind === 'proof' && (
            <>
              <ToolSection title={labels.sessionPersona} hint={labels.proofIdentityHint}>
                <div className="space-y-3">
                  <OptionButtons
                    multiple
                    options={[{ value: 'identity', label: labels.proofIdentity, icon: <Fingerprint className="size-3.5" /> }]}
                    value={proofIdentity ? ['identity'] : []}
                    onChange={(v) => edit(setProofIdentity)(v.length > 0)}
                    size="sm"
                    buttonClassName={OPTION_HEIGHT}
                    disabled={isWaiting || !identityAddress}
                  />
                  <p className="flex items-start gap-1.5 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    <Info className="mt-px size-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                    {labels.proofPersonaBug}
                  </p>
                </div>
              </ToolSection>
              <ToolSection title={labels.proofAccountsTitle} hint={labels.proofAccountsHint}>
                {sessionAccounts.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {labels.proofNoAccounts}
                  </p>
                ) : (
                  <OptionButtons
                    multiple
                    layout="grid"
                    className="sm:grid-cols-2"
                    options={sessionAccounts.map((a) => ({
                      value: a.address,
                      label: a.label,
                      description: truncateAddress(a.address, 10, 6),
                      title: a.address,
                    }))}
                    value={proofAccounts}
                    onChange={edit(setProofAccounts)}
                    size="sm"
                    buttonClassName={OPTION_HEIGHT}
                    disabled={isWaiting}
                  />
                )}
              </ToolSection>
            </>
          )}

          {kind !== 'proof' && accountsGroup}
          {kind !== 'proof' && personaDataGroup}

          {kind === 'login' && (
            <ToolSection title={labels.resetTitle} hint={labels.resetHint}>
              <OptionButtons
                multiple
                options={[
                  { value: 'accounts', label: labels.resetAccounts },
                  { value: 'personaData', label: labels.resetPersonaData },
                ]}
                value={reset}
                onChange={edit(setReset)}
                size="sm"
                buttonClassName={OPTION_HEIGHT}
                disabled={isWaiting}
              />
            </ToolSection>
          )}
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={isWaiting || issues.length > 0 || !activeNetworkId}
          title={labels.requestHint}
          className="flex w-full items-center justify-center bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] h-11 rounded-full font-bold text-sm hover:opacity-90 transition-opacity px-6 shadow active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          <RadixLogo
            label={labels.requestButton}
            showBeta={false}
            width="180"
            height="32"
            viewBox="0 0 240 40"
            fontSize={18}
            textX={135}
            textAnchor="middle"
            logoScale={0.12}
            logoTranslateY={8}
            logoTranslateX={5}
            strokeColor="white"
            textColor="white"
            className={isWaiting ? 'animate-pulse' : ''}
          />
        </button>

        {isWaiting && (
          <p role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span>{labels.waitingHint}</span>
            <button type="button" onClick={handleStopWaiting} className="font-semibold underline-offset-2 hover:underline cursor-pointer" style={{ color: 'var(--color-text-main)' }}>
              {labels.stopWaiting}
            </button>
          </p>
        )}
        {issues.length > 0 && (
          <ul className="space-y-1">
            {issues.map((issue) =>
              // Nothing chosen yet is a prompt, not a problem.
              issue === 'empty' ? (
                <li key={issue} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <Info className="mt-px size-3.5 shrink-0" />
                  {issueText[issue]}
                </li>
              ) : (
                <li key={issue} className="flex items-start gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" />
                  {issueText[issue] ?? labels.errors.generic}
                </li>
              ),
            )}
          </ul>
        )}
        {outcome.status === 'error' && (
          <p role="alert" className="text-xs font-medium text-red-500">
            {errorText(outcome.code)}
          </p>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <JsonFileButton
              name={labels.requestJson}
              hint={labels.requestJsonHint}
              open={openFile === 'request'}
              disabled={!requestJson}
              controls={`${panelId}-json`}
              onToggle={() => toggleFile('request')}
            />
            <JsonFileButton
              name={labels.responseJson}
              hint={labels.responseJsonHint}
              open={openFile === 'response'}
              disabled={!responseJson}
              controls={`${panelId}-json`}
              onToggle={() => toggleFile('response')}
            />
          </div>
          {openFile === 'request' && requestJson && (
            <JsonPanel
              id={`${panelId}-json`}
              name={labels.requestJson}
              json={requestJson}
              note={requestIsLive ? labels.sentNote : labels.previewNote}
              copyLabel={labels.copyJson}
            />
          )}
          {openFile === 'response' && responseJson && (
            <JsonPanel
              id={`${panelId}-json`}
              name={labels.responseJson}
              json={responseJson}
              note={outcome.status === 'ok' && !outcome.walletResponse ? labels.parsedNote : undefined}
              copyLabel={labels.copyJson}
            />
          )}
        </div>
      </div>

      {outcome.status === 'ok' && (
        <ToolSection title={labels.responseTitle}>
          <ResponseView
            labels={labels}
            walletData={outcome.walletData}
            challenge={outcome.challenge ?? outcome.walletData.proofs?.[0]?.challenge ?? null}
            rola={rola}
            rolaError={rolaError}
            isVerifying={isVerifying}
          />
        </ToolSection>
      )}
    </div>
  );
}
