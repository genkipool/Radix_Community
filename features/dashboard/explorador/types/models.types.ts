/** 
 * Entity and Business models transformed for internal logic
 * Specific to the Explorer (explorador) feature.
 */

export interface OracleUpdate {
  baseToken: string;
  quoteToken: string;
  price: string;
}

export interface AirdropData {
  component: string;
  eventId: string;
  account: string;
  amount: string;
  resource: string | null;
}

export interface ParsedManifest {
  lockFeeAmount: string | null;
  lockFeeAccount: string | null;
  mainAction: string | null;
  nftId: string | null;
  badgeResource: string | null;
  badgeAmount: string | null;
  badgeOrigin: string | null;
  oracleUpdates: OracleUpdate[];
  candiesMatch: RegExpMatchArray | null;
}

/** Visual style tokens for the "Received via:" source badge */
export interface SourceStyle {
  method: string;
  title: string;
  color: string;
  bg: string;
}

/** 
 * Transaction Event structure from Gateway API
 * Used to replace 'any' in details components
 */
export interface TransactionEvent {
  name: string;
  data: {
    fields: Array<{
      field_name?: string;
      value: unknown;
      kind: string;
      elements?: Array<{ kind?: string; value?: string; field_name?: string; fields?: Array<{ field_name?: string; value?: string; kind?: string }> }>;
    }>;
  };
}
