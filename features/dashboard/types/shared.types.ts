/**
 * Shared types used across multiple dashboard sub-features (Explorador & Validadores).
 */

export interface EntityMeta {
  name: string | null;
  iconUrl: string | null;
  symbol: string | null;
  blueprintName?: string | null;
}

export interface FungibleChange {
  entity_address: string;
  resource_address: string;
  balance_change: string;
  is_fee?: boolean;
  type?: string;
}

export interface FungibleFeeChange {
  entity_address: string;
  balance_change: string;
  resource_address?: string;
  is_fee?: boolean;
  type?: string;
}

export interface NonFungibleChange {
  entity_address: string;
  resource_address: string;
  added?: string[];
  removed?: string[];
}

/** 
 * Full Gateway API response details for an entity
 * Used by panels and modals that need all metadata and state.
 */
export interface GatewayEntityDetails {
  address: string;
  metadata: {
    items: MetadataItem[];
  };
  explicit_metadata?: {
    items: MetadataItem[];
  };
  details?: {
    type?: string;
    divisibility?: number;
    total_supply?: number | string;
    total_minted?: number | string;
    total_burned?: number | string;
    role_assignments?: RoleAssignments;
    blueprint_name?: string;
    blueprint_version?: string;
    package_address?: string;
    state?: Record<string, unknown>;
    blueprints?: Blueprint[];
  };
  fungible_resources?: {
    items: Array<{
      resource_address: string;
      amount: string;
      explicit_metadata?: { items: MetadataItem[] };
    }>;
  };
  non_fungible_resources?: {
    items: Array<{
      resource_address: string;
      amount?: number;
      explicit_metadata?: { items: MetadataItem[] };
      vaults?: {
        items: Array<{
          items: string[];
        }>;
      };
    }>;
  };
  // Fallbacks for when using partial entity data cached or similar
  name?: string | null;
  iconUrl?: string | null;
  symbol?: string | null;
}

/** Gateway metadata item as returned by the entity detail endpoints */
export interface MetadataItem {
  key: string;
  value: MetadataValue;
  is_locked: boolean;
  last_updated_at_state_version: number;
}

export interface MetadataValue {
  raw_hex?: string;
  programmatic_json?: ProgrammaticJson;
  typed?: MetadataTypedValue;
}

export interface MetadataTypedValue {
  type?: string;
  kind?: string;
  value?: string;
  values?: string[];
  url?: string;
  identifier?: string;
}

export interface ProgrammaticJson {
  kind?: string;
  type_name?: string;
  value?: string;
  fields?: ProgrammaticJsonField[];
  elements?: ProgrammaticJson[];
  variant_id?: number;
  variant_name?: string;
}

export interface ProgrammaticJsonField {
  field_name?: string;
  kind?: string;
  type_name?: string;
  value?: string;
  fields?: ProgrammaticJsonField[];
  elements?: ProgrammaticJson[];
}

export interface RoleAssignments {
  owner?: { rule?: { type: string } | Record<string, unknown> };
  entries?: GatewayRoleEntry[];
}

export interface GatewayRoleEntry {
  role_key: { name: string; module?: string };
  assignment: GatewayRoleAssignment;
  updater_roles?: string[];
}

export interface GatewayRoleAssignment {
  resolution: string;
  explicit_rule?: {
    type: string;
    access_rule?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface Blueprint {
  package_address?: string;
  blueprint_name?: string;
  blueprint_version?: string;
}

export interface ConfigEntry {
  name: string;
  resolution: string;
  updatable: boolean;
  desc: string;
  group: 'admin' | 'roles' | 'metadata' | 'main' | 'royalty';
  ruleAddress?: string | null;
}

export type RoleResolution = 'active' | 'deny' | 'allow_all';

export interface TransactionDetails {
  intent_hash?: string;
  state_version?: number;
  epoch?: number;
  round?: number;
  confirmed_at?: string;
  manifest_instructions?: string;
  manifest_classes?: string[];
  receipt?: {
    status?: string;
    error_message?: string;
    state_updates?: {
      new_global_entities?: Array<{
        entity_address: string;
        metadata?: { items: MetadataItem[] };
      }>;
    };
    fee_summary?: FeeSummary;
    fee_destination?: FeeDestination;
    costing_parameters?: CostingParameters;
    events?: GatewayEvent[];
  };
  total_locked_xrd?: string;
  total_unstaking_xrd?: string;
  affected_global_entities?: string[] | Array<{
    address: string;
    metadata?: {
      items: MetadataItem[];
    };
  }>;
  balance_changes?: {
    fungible_fee_balance_changes?: FungibleFeeChange[];
    fungible_balance_changes?: FungibleChange[];
    non_fungible_balance_changes?: NonFungibleChange[];
  };
}

export interface FeeSummary {
  xrd_total_execution_cost?: string;
  xrd_total_royalty_cost?: string;
  xrd_total_storage_cost?: string;
  xrd_total_tipping_cost?: string;
  xrd_total_finalization_cost?: string;
  [key: string]: unknown;
}

export interface FeeDestination {
  to_burn?: string | { xrd_amount?: string; xrdAmount?: string };
  toBurn?: string | { xrd_amount?: string; xrdAmount?: string };
  to_proposer?: string | { xrd_amount?: string; xrdAmount?: string };
  toProposer?: string | { xrd_amount?: string; xrdAmount?: string };
  to_validator_set?: string | { shares?: Array<Record<string, unknown>>; xrd_amount?: string; xrdAmount?: string };
  toValidatorSet?: string | { shares?: Array<Record<string, unknown>>; xrd_amount?: string; xrdAmount?: string };
  to_royalty_recipients?: Array<string | { 
    royalty_recipient?: { entity_address?: string; entityAddress?: string };
    recipient_address?: string;
    recipientAddress?: string;
    recipient_component_address?: string;
    xrd_amount?: string; 
    xrdAmount?: string; 
    amount?: string; 
  }>;
  toRoyaltyRecipients?: Array<string | { 
    royalty_recipient?: { entity_address?: string; entityAddress?: string };
    recipient_address?: string;
    recipientAddress?: string;
    recipient_component_address?: string;
    xrd_amount?: string; 
    xrdAmount?: string; 
    amount?: string; 
  }>;
  [key: string]: unknown;
}

export interface CostingParameters {
  xrd_usd_price?: string;
  [key: string]: unknown;
}

export interface GatewayField {
  field_name?: string;
  kind?: string;
  value?: unknown;
  elements?: unknown[];
  variant_name?: string;
  [key: string]: unknown;
}

export interface GatewayEvent {
  name?: string;
  emitter?: { 
    entity?: { entity_address: string; entity_type: string };
    global_emitter?: string;
  };
  data?: { fields?: GatewayField[]; kind?: string; variant_name?: string };
  [key: string]: unknown;
}
