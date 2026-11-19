import type { DaoNoticeItem } from '../types/radixDao.types';

export const DAO_NOTICE_ATTACHMENTS: Record<string, { pdfUrl: string; pdfName: string }> = {
  '2026-11-13-notice-of-non-elevation-temperature-check-number-2-burn-or-disable-radix-works-xrd-tokens': {
    pdfUrl: 'https://github.com/user-attachments/files/34829959/TRAC_Resolution_TC2_signed.pdf',
    pdfName: 'TRAC_Resolution_TC2_signed.pdf',
  },
  '2026-11-10-minutes-of-trac-meeting-on-nov-7th': {
    pdfUrl: 'https://github.com/user-attachments/files/34645827/RAC_Meeting_minutes_7_Nov_2026_signed.pdf',
    pdfName: 'RAC_Meeting_minutes_7_Nov_2026_signed.pdf',
  },
  '2026-10-31-transition-rac-meeting-minute-for-the-12th-october-2026-dao-formation-and-other-subjects': {
    pdfUrl: 'https://github.com/user-attachments/files/34213852/RAC_Meeting_minutes_12_Oct_2026_signed.pdf',
    pdfName: 'RAC_Meeting_minutes_12_Oct_2026_signed.pdf',
  },
  '2026-08-29-transition-rac-s-decisions-to-enable-and-support-the-ratification-process': {
    pdfUrl: 'https://github.com/user-attachments/files/31600502/RAC_Meeting_minutes_25_Aug_2026_final_signed.pdf',
    pdfName: 'RAC_Meeting_minutes_25_Aug_2026_final_signed.pdf',
  },
  '2026-08-29-transition-rac-certificate-technical-information-and-details': {
    pdfUrl: 'https://github.com/user-attachments/files/31597930/RAC_certificate_details_notice_signed.pdf',
    pdfName: 'RAC_certificate_details_notice_signed.pdf',
  },
};

export function extractNoticeSlug(url: string): string {
  const cleaned = url.replace(/\/+$/, '');
  return cleaned.slice(cleaned.lastIndexOf('/') + 1);
}

/**
 * Fallback official notices snapshot (sourced directly from https://radixdao.org/notices.json).
 * Used when the live JSON feed is temporarily unreachable during SSR/ISR.
 */
export const FALLBACK_DAO_NOTICES: DaoNoticeItem[] = [
  {
    id: 'https://radixdao.org/notices/2026-11-13-notice-of-non-elevation-temperature-check-number-2-burn-or-disable-radix-works-xrd-tokens/',
    slug: '2026-11-13-notice-of-non-elevation-temperature-check-number-2-burn-or-disable-radix-works-xrd-tokens',
    url: 'https://radixdao.org/notices/2026-11-13-notice-of-non-elevation-temperature-check-number-2-burn-or-disable-radix-works-xrd-tokens/',
    title: 'Notice of Non-Elevation: Temperature Check #2 (Burn or Disable Radix Works XRD Tokens)',
    datePublished: '2026-11-13T23:24:47.000Z',
    category: 'Resolutions & decisions',
    pdfUrl: 'https://github.com/user-attachments/files/34829959/TRAC_Resolution_TC2_signed.pdf',
    pdfName: 'TRAC_Resolution_TC2_signed.pdf',
  },
  {
    id: 'https://radixdao.org/notices/2026-11-10-minutes-of-trac-meeting-on-nov-7th/',
    slug: '2026-11-10-minutes-of-trac-meeting-on-nov-7th',
    url: 'https://radixdao.org/notices/2026-11-10-minutes-of-trac-meeting-on-nov-7th/',
    title: 'Minutes of TRAC meeting on Nov 7th',
    datePublished: '2026-11-10T19:03:16.000Z',
    category: 'Resolutions & decisions',
    pdfUrl: 'https://github.com/user-attachments/files/34645827/RAC_Meeting_minutes_7_Nov_2026_signed.pdf',
    pdfName: 'RAC_Meeting_minutes_7_Nov_2026_signed.pdf',
  },
  {
    id: 'https://radixdao.org/notices/2026-10-31-transition-rac-meeting-minute-for-the-12th-october-2026-dao-formation-and-other-subjects/',
    slug: '2026-10-31-transition-rac-meeting-minute-for-the-12th-october-2026-dao-formation-and-other-subjects',
    url: 'https://radixdao.org/notices/2026-10-31-transition-rac-meeting-minute-for-the-12th-october-2026-dao-formation-and-other-subjects/',
    title: 'Transition RAC meeting minute for the 12th October 2026: DAO formation and other subjects',
    datePublished: '2026-10-31T09:31:40.000Z',
    category: 'Resolutions & decisions',
    pdfUrl: 'https://github.com/user-attachments/files/34213852/RAC_Meeting_minutes_12_Oct_2026_signed.pdf',
    pdfName: 'RAC_Meeting_minutes_12_Oct_2026_signed.pdf',
  },
  {
    id: 'https://radixdao.org/notices/2026-08-29-transition-rac-s-decisions-to-enable-and-support-the-ratification-process/',
    slug: '2026-08-29-transition-rac-s-decisions-to-enable-and-support-the-ratification-process',
    url: 'https://radixdao.org/notices/2026-08-29-transition-rac-s-decisions-to-enable-and-support-the-ratification-process/',
    title: "Transition RAC's decisions to enable and support the Ratification process",
    datePublished: '2026-08-29T16:41:29.000Z',
    category: 'Resolutions & decisions',
    pdfUrl: 'https://github.com/user-attachments/files/31600502/RAC_Meeting_minutes_25_Aug_2026_final_signed.pdf',
    pdfName: 'RAC_Meeting_minutes_25_Aug_2026_final_signed.pdf',
  },
  {
    id: 'https://radixdao.org/notices/2026-08-29-transition-rac-certificate-technical-information-and-details/',
    slug: '2026-08-29-transition-rac-certificate-technical-information-and-details',
    url: 'https://radixdao.org/notices/2026-08-29-transition-rac-certificate-technical-information-and-details/',
    title: 'Transition RAC Certificate technical information and details',
    datePublished: '2026-08-29T15:07:15.000Z',
    category: 'Reports & records',
    pdfUrl: 'https://github.com/user-attachments/files/31597930/RAC_certificate_details_notice_signed.pdf',
    pdfName: 'RAC_certificate_details_notice_signed.pdf',
  },
];
