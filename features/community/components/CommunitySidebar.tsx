import { Code, Megaphone, GraduationCap, Server, Scale, Shield, ShieldCheck } from 'lucide-react';
import { ReactNode } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { SidebarGraphic } from '@/components/ui/SidebarGraphic';
import { SidebarCard } from '@/components/ui/SidebarCard';
import { Area, AdminView } from '../types/data.types';
import { CommunityDictionary } from '../types/i18n.types';

const ICON_MAP: Record<string, ReactNode> = {
    Code: <Code className="w-5 h-5" />,
    Megaphone: <Megaphone className="w-5 h-5" />,
    GraduationCap: <GraduationCap className="w-5 h-5" />,
    Server: <Server className="w-5 h-5" />,
    Scale: <Scale className="w-5 h-5" />,
    Shield: <Shield className="w-5 h-5" />,
};

interface CommunitySidebarProps {
    t: CommunityDictionary;
    selectedAreaId: string | null;
    onSelectArea: (id: string | null) => void;
    areas: Area[];
    adminView: AdminView;
    onAdminViewChange: (view: AdminView) => void;
}

export default function CommunitySidebar({
    t,
    selectedAreaId,
    onSelectArea,
    areas,
    adminView,
    onAdminViewChange,
}: CommunitySidebarProps) {
    const { svg: svgT, area_names: areaNames } = t;

    const header = (
        <SidebarGraphic
            appName={svgT.appName ?? 'Radix'}
            title={svgT.title ?? 'Transparency'}
            subtitle={svgT.subtitle ?? 'Open ecosystem management.'}
            badgeLabel={svgT.badgeLabel ?? 'COMMUNITY'}
            idPrefix="community"
            variant="community"
        />
    );

    // Admin card items
    const adminBadge = (
        <div className="w-8 h-6 flex items-center justify-end pr-0.5">
            {adminView !== null ? null : (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(99,102,241,0.3)' }}
                >+</span>
            )}
        </div>
    );

    return (
        <SidebarLayout
            header={header}
            onHeaderClick={() => { onSelectArea(null); onAdminViewChange(null); }}
            headerAriaLabel={t.global_address_label ?? 'Go to transparency overview'}
            heightOffset={80}
        >
            <div className="space-y-3">

                {/* ── Admin card ── */}
                <SidebarCard
                    id="admin"
                    icon={<ShieldCheck className="w-5 h-5" />}
                    gradient="from-violet-600 to-indigo-500"
                    title={t.admin_card_title ?? 'Administrator'}
                    isExpanded={false}
                    hasSelectedItem={adminView !== null}
                    headerBadge={adminBadge}
                    href="?admin=create"
                    onToggle={() => onAdminViewChange('create')}
                    items={[]}
                    onSelectItem={() => { }}
                />

                {/* ── Area cards ── */}
                {areas.map(area => {
                    const isSelected = selectedAreaId === area.id;

                    const countBadge = (
                        <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 tabular-nums"
                            style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-card-border)' }}
                        >
                            {area.tasks.length}
                        </span>
                    );

                    return (
                        <SidebarCard
                            key={area.id}
                            id={area.id}
                            icon={ICON_MAP[area.icon] ?? <Code className="w-5 h-5" />}
                            gradient={area.gradient}
                            title={areaNames[area.id] ?? area.id}
                            isExpanded={false}
                            hasSelectedItem={isSelected}
                            headerBadge={countBadge}
                            href={`?area=${area.id}`}
                            onToggle={() => onSelectArea(area.id)}
                            items={[]}
                            onSelectItem={() => { }}
                        />
                    );
                })}
            </div>
        </SidebarLayout>
    );
}
