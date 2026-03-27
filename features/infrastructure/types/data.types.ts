/** A single sub-item within an infrastructure layer (e.g. "Jellyfish Merkle Tree") */
export interface InfraItem {
  /** Unique machine-readable key used as the i18n lookup and expand-set ID */
  key: string;
  /** Icon name from the icon map in the client component */
  icon: string;
}

/** One of the 8 top-level infrastructure layers */
export interface InfraLayer {
  /** Unique machine-readable key (e.g. "ledger", "consensus") */
  id: string;
  /** Icon name for the layer header */
  icon: string;
  /** Tailwind gradient string for the layer accent */
  gradient: string;
  /** Sub-items contained in this layer */
  items: InfraItem[];
}
