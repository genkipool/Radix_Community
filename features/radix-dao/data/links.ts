import type { DaoGithubRepo, DaoSigningCertificate } from '../types/radixDao.types';

export const DAO_REPO_BASE = 'https://github.com/RadixDAO/governance-framework';
export const DAO_RAW_BASE = `${DAO_REPO_BASE}/raw/main`;
export const DAO_RAW_CDN_BASE = 'https://raw.githubusercontent.com/RadixDAO/governance-framework/main';
export const DAO_BLOB_BASE = `${DAO_REPO_BASE}/blob/main`;

export const DAO_EXTERNAL_LINKS = {
  portal: 'https://radixdao.org/',
  notices: 'https://radixdao.org/notices/',
  noticesJson: 'https://radixdao.org/notices.json',
  vote: 'https://vote.radixdao.org',
  tc4Ballot: 'https://vote.radixdao.org/tc/4',
  proposalsHistory: `${DAO_BLOB_BASE}/PROPOSALS.md`,
  rolesRegistry: `${DAO_BLOB_BASE}/guides/roles-registry.md`,
  charterGuide: `${DAO_BLOB_BASE}/guides/charter-reading-guide.md`,
  policyGuide: `${DAO_BLOB_BASE}/guides/policy-library-reading-guide.md`,
  electionGuide: `${DAO_BLOB_BASE}/guides/election-methods-guide.md`,
  permanentRacThread: 'https://radixtalk.com/t/candidacy-for-radix-dao-llcs-permanent-rac-election/2338',
  councilTelegram: 'https://t.me/RadixAccountabilityCouncil/1',
  midaoPortal: 'https://www.midao.org',
  formationRecord: `${DAO_REPO_BASE}/tree/main/legal/formation`,
} as const;

export const DAO_LEGAL_FACTS = {
  midaoRegistration: '10280-26',
  emails: ['rac@radix.community', 'veto@radix.community'] as const,
} as const;

export const DAO_SIGNING_CERTIFICATE: DaoSigningCertificate = {
  serialNumber: '497dc3092ebc024f6350b92a77fa14790de75b03',
  sha1Thumbprint: '95642b00a5338c81c28b76c4af6b99bc28de61ed',
  sha256Fingerprint: '73B1D38C5F4137307ADDEE4F8AF8BB922F887739C9FD9E499CFEAE10DACDE92D',
};

export const DAO_GITHUB_REPOS: DaoGithubRepo[] = [
  {
    name: 'governance-framework',
    url: 'https://github.com/RadixDAO/governance-framework',
    updatedAt: '2026-10-31',
    branch: 'main',
  },
  {
    name: 'website',
    url: 'https://github.com/RadixDAO/website',
    updatedAt: '2026-11-13',
    branch: 'main',
  },
  {
    name: 'pricing-service',
    url: 'https://github.com/RadixDAO/pricing-service',
    updatedAt: '2026-11-15',
    branch: 'main',
  },
];

export function getPdfDownloadUrl(pdfPath: string): string {
  return `${DAO_RAW_BASE}/${pdfPath}`;
}

export function getPdfCdnUrl(pdfPath: string): string {
  return `${DAO_RAW_CDN_BASE}/${pdfPath}`;
}

export function getSourceViewUrl(sourcePath: string): string {
  return `${DAO_BLOB_BASE}/${sourcePath}`;
}
