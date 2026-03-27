import { Area, FundingSource, LegalExpense, ExplorerTarget, AdminView } from './data.types';
export type { ExplorerTarget };
import { CommunityDictionary } from './i18n.types';

export interface CommunityClientProps {
    t: CommunityDictionary;
}

export interface AdminPanelProps {
    areas: Area[];
    onUpdateAreas: (areas: Area[]) => void;
    initialView: AdminView;
    onViewChange: (view: AdminView) => void;
    onClose: () => void;
}

export interface ExplorerModalProps {
    t: CommunityDictionary;
    target: ExplorerTarget | null;
    onClose: () => void;
}

export interface CommunityHeroProps {
    collapsed: boolean;
    onSelectArea: (id: string | null) => void;
    areas?: Area[];
    onShowExplorer: (target: ExplorerTarget) => void;
}

export interface CommunityAreaViewProps {
    t: CommunityDictionary;
    area: Area;
    onShowExplorer: (target: ExplorerTarget) => void;
}

export interface CommunitySidebarProps {
    t: CommunityDictionary;
    selectedAreaId: string | null;
    onSelectArea: (id: string | null) => void;
    areas: Area[];
    adminView: AdminView;
    onAdminViewChange: (view: AdminView) => void;
}

export interface LedgerTableProps {
    t: CommunityDictionary;
    areas: Area[];
    fundingSources: FundingSource[];
    legalExpenses: LegalExpense[];
    onShowExplorer: (target: ExplorerTarget) => void;
}

export interface RadixInfoModalProps {
    t: CommunityDictionary;
    isOpen: boolean;
    onClose: () => void;
}
