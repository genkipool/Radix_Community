import { GameItem } from './data.types';

/**
 * Prop interfaces for Games feature components.
 */

export interface GamesClientProps {
    initialAutoCollapse?: boolean;
    initialExpandedTopics?: string;
    initialGridView?: boolean;
    initialTheaterMode?: boolean;
}

export interface GamesSidebarProps {
    selectedGameId: string | null;
    onSelectGame: (id: string | null) => void;
    expandedCategories: Set<string>;
    onCategoryToggle: (id: string) => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    autoCollapse: boolean;
    onAutoCollapseChange: (v: boolean) => void;
    searchQuery: string;
    onSearchQueryChange: (q: string) => void;
    gridView: boolean;
    onGridViewToggle: () => void;
    theaterMode: boolean;
    onTheaterModeToggle: () => void;
}

export interface GamesHeroProps {
  onSelectGame: (id: string) => void;
  collapsed?: boolean;
}

export interface GamePlayerProps {
    game: GameItem;
}

export interface LeaderboardSidebarProps {
    gameTitle: string;
}

export interface TournamentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export interface DevPublishModalProps {
    isOpen: boolean;
    onClose: () => void;
}
