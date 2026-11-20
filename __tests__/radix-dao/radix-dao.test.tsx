import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/context/LanguageContext';
import { translations } from '@/i18n';
import {
  DAO_DOCUMENTS,
  DAO_ON_CHAIN_ENTITIES,
  DAO_PERMANENT_CANDIDATES,
  DAO_TRANSITION_COUNCIL,
  getPdfDownloadUrl,
} from '@/features/radix-dao/data/radixDaoData';
import { DaoDocumentsSection } from '@/features/radix-dao/components/DaoDocumentsSection';
import enDict from '@/features/radix-dao/locales/en.json';
import esDict from '@/features/radix-dao/locales/es.json';

beforeAll(() => {
  if (typeof globalThis.IntersectionObserver === 'undefined') {
    globalThis.IntersectionObserver = class IntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
      root = null;
      rootMargin = '';
      thresholds = [];
    } as unknown as typeof IntersectionObserver;
  }
});

describe('Radix DAO data & i18n integrity', () => {
  it('contains all 26 active official PDFs with valid SHA-256 digests and unique IDs', () => {
    expect(DAO_DOCUMENTS).toHaveLength(26);

    const ids = new Set(DAO_DOCUMENTS.map((d) => d.id));
    expect(ids.size).toBe(26);

    for (const doc of DAO_DOCUMENTS) {
      expect(doc.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(doc.fileName.endsWith('.pdf')).toBe(true);
      expect(getPdfDownloadUrl(doc.pdfPath)).toMatch(
        /^https:\/\/github\.com\/RadixDAO\/governance-framework\/raw\/main\/.+\.pdf$/
      );
      expect(enDict.radixDao.documents.items[doc.id as keyof typeof enDict.radixDao.documents.items]).toBeDefined();
      expect(esDict.radixDao.documents.items[doc.id as keyof typeof esDict.radixDao.documents.items]).toBeDefined();
    }
  });

  it('lists all 5 Transition RAC seats, 14 Permanent RAC candidates, and 10 on-chain entries', () => {
    expect(DAO_TRANSITION_COUNCIL).toHaveLength(5);
    expect(DAO_TRANSITION_COUNCIL.filter((m) => m.isLlcMember)).toHaveLength(3);
    expect(DAO_PERMANENT_CANDIDATES).toHaveLength(14);
    for (const c of DAO_PERMANENT_CANDIDATES) {
      expect(c.threadUrl).toMatch(/^https:\/\/radixtalk\.com\/t\//);
      expect(enDict.radixDao.people.candidates[c.id as keyof typeof enDict.radixDao.people.candidates]).toBeDefined();
      expect(esDict.radixDao.people.candidates[c.id as keyof typeof esDict.radixDao.people.candidates]).toBeDefined();
    }
    expect(DAO_ON_CHAIN_ENTITIES).toHaveLength(10);
    expect(DAO_ON_CHAIN_ENTITIES.filter((e) => e.status === 'live')).toHaveLength(6);
  });
});

describe('DaoDocumentsSection', () => {
  it('renders all 26 inline PDF preview triggers and filters by category', () => {
    render(
      <LanguageProvider language="en" dictionary={translations.en}>
        <DaoDocumentsSection documents={enDict.radixDao.documents} />
      </LanguageProvider>
    );

    const pdfButtons = screen.getAllByRole('button', { name: /View PDF/i });
    expect(pdfButtons).toHaveLength(26);

    const formationTab = screen.getByRole('tab', { name: /Formation & Legal/i });
    fireEvent.click(formationTab);

    const filteredButtons = screen.getAllByRole('button', { name: /View PDF/i });
    expect(filteredButtons).toHaveLength(5);
  });
});
