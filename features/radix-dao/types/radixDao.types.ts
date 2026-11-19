import type radixDaoEn from '../locales/en.json';

export type DaoCopy = typeof radixDaoEn.radixDao;

export type DaoDocumentCategory =
  | 'formation'
  | 'constitutional'
  | 'decisions'
  | 'roles'
  | 'conduct'
  | 'resilience'
  | 'contributors'
  | 'stewardship';

export type DaoDocumentStatus = 'filed' | 'issued' | 'ratified';

export interface DaoDocument {
  id: string;
  category: DaoDocumentCategory;
  status: DaoDocumentStatus;
  version?: string;
  fileSize?: string;
  pdfPath: string;
  sourcePath?: string;
  sha256: string;
  fileName: string;
}

export interface DaoOnChainEntity {
  id: string;
  address: string | null;
  status: 'live' | 'pending';
}

export interface DaoTransitionMember {
  seat: string;
  name: string;
  telegram: string;
  isLlcMember: boolean;
}

export interface DaoPermanentCandidate {
  id: string;
  number: string;
  name: string;
  handle?: string;
  isCurrentTrac: boolean;
  threadUrl: string;
}

export interface DaoNoticeItem {
  id: string;
  slug: string;
  url: string;
  title: string;
  datePublished: string;
  category: string;
  pdfUrl?: string;
  pdfName?: string;
}

export interface DaoGithubRepo {
  name: string;
  url: string;
  updatedAt: string;
  branch: string;
}

export interface DaoSigningCertificate {
  serialNumber: string;
  sha1Thumbprint: string;
  sha256Fingerprint: string;
}
