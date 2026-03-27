export interface AcademyFeature {
    title: string;
    description: string;
}

export interface AcademyModule {
    num: string;
    title: string;
    description: string;
    duration: string;
    lessons: string[];
}

export interface AcademyFaqItem {
    q: string;
    a: string;
}

export interface AcademyComparisonTable {
    headers: string[];
    rows: string[][];
}
