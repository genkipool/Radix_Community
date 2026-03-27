import type { Dictionary } from '@/types/i18n';
import type { InfraLayer, InfraItem } from './data.types';
import type { InfraPageType } from './i18n.types';

/** Props for the InfrastructureClient component */
export interface InfrastructureClientProps {
  /** Dictionary resolved server-side at build time (SSG pattern). */
  t: Dictionary;
  initialAutoCollapse?: boolean;
  initialExpandedTopics?: string;
}

/** Props for the InfrastructureModal component */
export interface InfrastructureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Props for the ItemCard component */
export interface ItemCardProps {
  item: InfraItem;
  layerGradient: string;
  title: string;
  description: string;
  searchQuery: string;
  index: number;
}

/** Props for the LayerCard component */
export interface LayerCardProps {
  layer: InfraLayer;
  isExpanded: boolean;
  onToggle: () => void;
  layerT: InfraPageType['layers'][string];
  searchQuery: string;
  index: number;
}
