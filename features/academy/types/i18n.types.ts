import type { AcademyFeature, AcademyModule, AcademyComparisonTable, AcademyFaqItem } from './data.types';

export interface AcademyDictionary {
    hero: {
        tag: string;
        title: string;
        titleAccent: string;
        description: string;
        btnStart: string;
        btnDiscord: string;
    };
    whatIsScrypto: {
        tag: string;
        title: string;
        titleAccent: string;
        description: string;
    };
    features: AcademyFeature[];
    comparison: {
        tag: string;
        title: string;
        titleAccent: string;
        titleEnd: string;
        description: string;
        scryptoLabel: string;
        solidityLabel: string;
        scryptoComment: string;
        solidityComment: string;
        table: AcademyComparisonTable;
    };
    content: {
        tag: string;
        title: string;
        titleAccent: string;
        description: string;
        modules: AcademyModule[];
        hideLessons: string;
        viewLessons: string;
    };
    faq: {
        title: string;
        titleAccent: string;
        items: AcademyFaqItem[];
    };
    cta: {
        tag: string;
        title: string;
        titleAccent: string;
        description: string;
        btnRegister: string;
        btnProgram: string;
        hispanicAcademy: string;
    };
}
