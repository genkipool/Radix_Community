import type { Dictionary } from '@/types/i18n';

export interface AcademyClientProps {
    /** Dictionary resolved server-side (SSG — generateStaticParams). */
    t: Dictionary;
}
