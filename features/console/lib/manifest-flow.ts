/**
 * Transaction-manifest → structured flow steps.
 *
 * Parses the instructions of a raw transaction manifest into localized,
 * richly-detailed steps consumed by the ManifestFlowDiagram component.
 */

/* ─── Parsing ─────────────────────────────────────────────────────────────── */

export interface ManifestInstruction {
  name: string;
  args: string;
}

/** Splits a manifest into instructions on `;`, ignoring `;` inside strings. */
export function parseInstructions(manifest: string): ManifestInstruction[] {
  // Comment lines (# …) are not instructions; drop them before splitting
  manifest = manifest.replace(/^[ \t]*#[^\n]*/gm, '');
  const statements: string[] = [];
  let current = '';
  let inString = false;

  for (let i = 0; i < manifest.length; i++) {
    const char = manifest[i];
    if (char === '"' && manifest[i - 1] !== '\\') inString = !inString;
    if (char === ';' && !inString) {
      statements.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  statements.push(current);

  return statements.flatMap((statement) => {
    const trimmed = statement.trim();
    const match = trimmed.match(/^([A-Z][A-Z0-9_]*)([\s\S]*)$/);
    return match ? [{ name: match[1], args: match[2] }] : [];
  });
}

const stringArgs = (args: string): string[] =>
  [...args.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);

/** Value constructors whose inner strings are not plain string arguments. */
const WRAPPED_STRING_RE =
  /(?:Address|Decimal|PreciseDecimal|Bucket|Proof|Blob|NonFungibleLocalId|NonFungibleGlobalId|Expression|Bytes|Enum<[^>]*>)\(\s*"(?:[^"\\]|\\.)*"\s*\)/g;

/** Bare string arguments (method names, metadata keys, …) excluding wrapped values. */
const bareStringArgs = (args: string): string[] =>
  stringArgs(args.replace(WRAPPED_STRING_RE, ''));

const addressArgs = (args: string): string[] =>
  [...args.matchAll(/Address\("([^"]+)"\)/g)].map((m) => m[1]);

const decimalArgs = (args: string): string[] =>
  [...args.matchAll(/Decimal\("([^"]+)"\)/g)].map((m) => m[1]);

const bucketArgs = (args: string): string[] =>
  [...args.matchAll(/Bucket\("([^"]+)"\)/g)].map((m) => m[1]);

const nonFungibleIds = (args: string): string[] =>
  [...args.matchAll(/NonFungibleLocalId\("([^"]+)"\)/g)].map((m) => m[1]);

/* ─── Localized labels (console.manifest.flow) ────────────────────────────── */

interface StepLabel {
  title: string;
  description: string;
}

export interface FlowLabels {
  start: string;
  startHint: string;
  end: string;
  endHint: string;
  stepLabel: string;
  detailLabels: {
    account: string;
    resource: string;
    amount: string;
    method: string;
    metadataKey: string;
    nfts: string;
    target: string;
    blueprint: string;
    function: string;
    supply: string;
    bucket: string;
  };
  steps: {
    withdraw: StepLabel;
    withdrawNfts: StepLabel;
    take: StepLabel;
    takeAll: StepLabel;
    takeNfts: StepLabel;
    deposit: StepLabel;
    depositBatch: StepLabel;
    proof: StepLabel;
    setMetadata: StepLabel;
    removeMetadata: StepLabel;
    createFungible: StepLabel;
    createNonFungible: StepLabel;
    publish: StepLabel;
    burn: StepLabel;
    call: StepLabel;
    callFunction: StepLabel;
    generic: StepLabel;
  };
}

/* ─── Output model ────────────────────────────────────────────────────────── */

export type FlowStepKind =
  | 'withdraw'
  | 'take'
  | 'deposit'
  | 'proof'
  | 'metadata'
  | 'create'
  | 'publish'
  | 'call'
  | 'burn'
  | 'other';

export interface FlowDetail {
  label: string;
  value: string;
  /** Render in monospace (addresses, ids, method names) */
  mono?: boolean;
}

export interface FlowStep {
  kind: FlowStepKind;
  /** Raw manifest instruction name (CALL_METHOD, SET_METADATA, …) */
  instruction: string;
  title: string;
  description: string;
  details: FlowDetail[];
}

const format = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);

/* ─── Instruction → step ──────────────────────────────────────────────────── */

function describeCallMethod(instruction: ManifestInstruction, labels: FlowLabels): FlowStep {
  const { args } = instruction;
  const d = labels.detailLabels;
  const [target, ...restAddresses] = addressArgs(args);
  const method = bareStringArgs(args)[0] ?? '';
  const amounts = decimalArgs(args);
  const buckets = bucketArgs(args);
  const base = { instruction: instruction.name };

  switch (method) {
    case 'withdraw':
      return {
        ...base,
        kind: 'withdraw',
        title: labels.steps.withdraw.title,
        description: format(labels.steps.withdraw.description, { amount: amounts[0] ?? '?' }),
        details: [
          { label: d.account, value: target ?? '?', mono: true },
          { label: d.resource, value: restAddresses[0] ?? '?', mono: true },
          { label: d.amount, value: amounts[0] ?? '?' },
        ],
      };
    case 'withdraw_non_fungibles': {
      const ids = nonFungibleIds(args);
      return {
        ...base,
        kind: 'withdraw',
        title: labels.steps.withdrawNfts.title,
        description: format(labels.steps.withdrawNfts.description, { count: String(ids.length) }),
        details: [
          { label: d.account, value: target ?? '?', mono: true },
          { label: d.resource, value: restAddresses[0] ?? '?', mono: true },
          { label: d.nfts, value: ids.join(', ') || '?', mono: true },
        ],
      };
    }
    case 'deposit':
    case 'try_deposit_or_abort':
    case 'try_deposit_or_refund':
      return {
        ...base,
        kind: 'deposit',
        title: labels.steps.deposit.title,
        description: labels.steps.deposit.description,
        details: [
          { label: d.account, value: target ?? '?', mono: true },
          ...(buckets[0] ? [{ label: d.bucket, value: buckets[0], mono: true }] : []),
        ],
      };
    case 'deposit_batch':
    case 'try_deposit_batch_or_abort':
    case 'try_deposit_batch_or_refund':
      return {
        ...base,
        kind: 'deposit',
        title: labels.steps.depositBatch.title,
        description: labels.steps.depositBatch.description,
        details: [{ label: d.account, value: target ?? '?', mono: true }],
      };
    case 'create_proof_of_amount':
    case 'create_proof_of_non_fungibles':
      return {
        ...base,
        kind: 'proof',
        title: labels.steps.proof.title,
        description: labels.steps.proof.description,
        details: [
          { label: d.account, value: target ?? '?', mono: true },
          { label: d.resource, value: restAddresses[0] ?? '?', mono: true },
        ],
      };
    default:
      return {
        ...base,
        kind: 'call',
        title: labels.steps.call.title,
        description: format(labels.steps.call.description, { method: method || '?' }),
        details: [
          { label: d.method, value: method || '?', mono: true },
          { label: d.target, value: target ?? '?', mono: true },
        ],
      };
  }
}

function describeInstruction(instruction: ManifestInstruction, labels: FlowLabels): FlowStep {
  const { name, args } = instruction;
  const d = labels.detailLabels;
  const amounts = decimalArgs(args);
  const addresses = addressArgs(args);
  const buckets = bucketArgs(args);
  const base = { instruction: name };

  switch (name) {
    case 'CALL_METHOD':
      return describeCallMethod(instruction, labels);
    case 'TAKE_FROM_WORKTOP':
      return {
        ...base,
        kind: 'take',
        title: labels.steps.take.title,
        description: format(labels.steps.take.description, { amount: amounts[0] ?? '?' }),
        details: [
          { label: d.resource, value: addresses[0] ?? '?', mono: true },
          { label: d.amount, value: amounts[0] ?? '?' },
          ...(buckets[0] ? [{ label: d.bucket, value: buckets[0], mono: true }] : []),
        ],
      };
    case 'TAKE_ALL_FROM_WORKTOP':
      return {
        ...base,
        kind: 'take',
        title: labels.steps.takeAll.title,
        description: labels.steps.takeAll.description,
        details: [
          { label: d.resource, value: addresses[0] ?? '?', mono: true },
          ...(buckets[0] ? [{ label: d.bucket, value: buckets[0], mono: true }] : []),
        ],
      };
    case 'TAKE_NON_FUNGIBLES_FROM_WORKTOP': {
      const ids = nonFungibleIds(args);
      return {
        ...base,
        kind: 'take',
        title: labels.steps.takeNfts.title,
        description: format(labels.steps.takeNfts.description, { count: String(ids.length) }),
        details: [
          { label: d.resource, value: addresses[0] ?? '?', mono: true },
          { label: d.nfts, value: ids.join(', ') || '?', mono: true },
          ...(buckets[0] ? [{ label: d.bucket, value: buckets[0], mono: true }] : []),
        ],
      };
    }
    case 'CREATE_FUNGIBLE_RESOURCE':
    case 'CREATE_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY':
      return {
        ...base,
        kind: 'create',
        title: labels.steps.createFungible.title,
        description: format(labels.steps.createFungible.description, { supply: amounts[0] ?? '0' }),
        details: amounts[0] ? [{ label: d.supply, value: amounts[0] }] : [],
      };
    case 'CREATE_NON_FUNGIBLE_RESOURCE':
    case 'CREATE_NON_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY': {
      const ids = nonFungibleIds(args);
      return {
        ...base,
        kind: 'create',
        title: labels.steps.createNonFungible.title,
        description: labels.steps.createNonFungible.description,
        details: ids.length > 0 ? [{ label: d.nfts, value: String(ids.length) }] : [],
      };
    }
    case 'SET_METADATA':
      return {
        ...base,
        kind: 'metadata',
        title: labels.steps.setMetadata.title,
        description: format(labels.steps.setMetadata.description, { key: bareStringArgs(args)[0] ?? '?' }),
        details: [
          { label: d.metadataKey, value: bareStringArgs(args)[0] ?? '?', mono: true },
          { label: d.target, value: addresses[0] ?? '?', mono: true },
        ],
      };
    case 'REMOVE_METADATA':
      return {
        ...base,
        kind: 'metadata',
        title: labels.steps.removeMetadata.title,
        description: format(labels.steps.removeMetadata.description, { key: bareStringArgs(args)[0] ?? '?' }),
        details: [
          { label: d.metadataKey, value: bareStringArgs(args)[0] ?? '?', mono: true },
          { label: d.target, value: addresses[0] ?? '?', mono: true },
        ],
      };
    case 'PUBLISH_PACKAGE':
    case 'PUBLISH_PACKAGE_ADVANCED':
      return {
        ...base,
        kind: 'publish',
        title: labels.steps.publish.title,
        description: labels.steps.publish.description,
        details: [],
      };
    case 'BURN_RESOURCE':
      return {
        ...base,
        kind: 'burn',
        title: labels.steps.burn.title,
        description: labels.steps.burn.description,
        details: buckets[0] ? [{ label: d.bucket, value: buckets[0], mono: true }] : [],
      };
    case 'CALL_FUNCTION': {
      const strings = bareStringArgs(args);
      return {
        ...base,
        kind: 'call',
        title: labels.steps.callFunction.title,
        description: format(labels.steps.callFunction.description, {
          func: strings[1] ?? '?',
          blueprint: strings[0] ?? '?',
        }),
        details: [
          { label: d.blueprint, value: strings[0] ?? '?', mono: true },
          { label: d.function, value: strings[1] ?? '?', mono: true },
          { label: d.target, value: addresses[0] ?? '?', mono: true },
        ],
      };
    }
    default:
      return {
        ...base,
        kind: 'other',
        title: labels.steps.generic.title,
        description: format(labels.steps.generic.description, { name }),
        details: [],
      };
  }
}

/**
 * Builds the localized flow steps for a manifest, or null when nothing could
 * be parsed.
 */
export function buildManifestFlowSteps(manifest: string, labels: FlowLabels): FlowStep[] | null {
  const steps = parseInstructions(manifest).map((instruction) =>
    describeInstruction(instruction, labels),
  );
  return steps.length > 0 ? steps : null;
}
