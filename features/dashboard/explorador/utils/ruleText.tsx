import type { RuleView } from '@/features/console/lib/role-lookup';
import { AddressChip } from '../components/SummaryCardKit';

export interface RuleWords {
    anyone: string;
    nobody: string;
    badge: string;
    rule_other: string;
}

/** Who a role rule lets in, in words: "Anyone", "Badge GPD", "Badge Admin #1#"… */
export function ruleText(rule: RuleView, words: RuleWords | undefined, names: Record<string, string>): string {
    switch (rule.type) {
        case 'allowAll':
            return words?.anyone ?? 'Anyone (AllowAll)';
        case 'denyAll':
            return words?.nobody ?? 'Nobody';
        case 'resource':
            return `${words?.badge ?? 'Badge'} ${names[rule.resource] ?? ''}`.trim();
        case 'nonFungible':
            return `${words?.badge ?? 'Badge'} ${names[rule.resource] ?? ''} ${rule.localId}`.trim();
        default:
            return words?.rule_other ?? 'Composite rule';
    }
}

/** The badge resource a rule names, or '' when it names none. */
export const badgeOfRule = (rule: RuleView) => ('resource' in rule ? rule.resource : '');

/** The badge a rule names, shortened with a copy button; nothing when it names none. */
export function RuleBadgeChip({ rule, copiedAddress, onCopy, copyTitle }: {
    rule: RuleView;
    copiedAddress: string | null;
    onCopy: (value: string) => void;
    copyTitle: string;
}) {
    const badge = badgeOfRule(rule);
    return badge ? <AddressChip address={badge} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} /> : null;
}
