import type { DaoPermanentCandidate, DaoTransitionMember } from '../types/radixDao.types';

export const DAO_TRANSITION_COUNCIL: DaoTransitionMember[] = [
  { seat: '01', name: 'projectShift', telegram: 'projectShift', isLlcMember: true },
  { seat: '02', name: '√Mr. Peanutbutter', telegram: 'ALFRED_DULAiRE', isLlcMember: true },
  { seat: '03', name: 'Tadkis', telegram: 'tadkis', isLlcMember: true },
  { seat: '04', name: 'avaunt', telegram: 'Avaunt', isLlcMember: false },
  { seat: '05', name: 'Jazzer', telegram: 'Jazzer9F', isLlcMember: false },
];

/**
 * 15 community candidates who presented during the Permanent RAC candidacy window
 * (16 Oct - 13 Nov 2026) on RadixTalk thread #2338, under TRAC verification as of 16 Nov 2026.
 */
export const DAO_PERMANENT_CANDIDATES: DaoPermanentCandidate[] = [
  {
    id: 'linuxx',
    number: '01',
    name: 'linuxx',
    handle: '@linuxx_xrd',
    isCurrentTrac: false,
    threadUrl: 'https://radixtalk.com/t/nomination-for-the-dao/2339',
  },
  {
    id: 'gilesmorris',
    number: '02',
    name: 'Giles Morris',
    handle: 'gilesmorris.me',
    isCurrentTrac: false,
    threadUrl: 'https://radixtalk.com/t/rfp-volunteer-delegate-candidate-on-the-permanent-rac-of-the-radix-midao/2312',
  },
  {
    id: 'dazligth',
    number: '03',
    name: 'dazligth',
    handle: '@Seboeoeoel',
    isCurrentTrac: false,
    threadUrl: 'https://radixtalk.com/t/candidacy-for-radix-dao-llcs-permanent-rac-election/2338/7',
  },
  {
    id: 'a137x',
    number: '04',
    name: 'a137x',
    isCurrentTrac: false,
    threadUrl: 'https://radixtalk.com/t/candidacy-for-radix-dao-llcs-permanent-rac-election/2338/8',
  },
  {
    id: 'peterjan',
    number: '05',
    name: 'Peterjan',
    isCurrentTrac: false,
    threadUrl: 'https://radixtalk.com/t/candidacy-permanent-rac/2340',
  },
  {
    id: 'jimmi',
    number: '06',
    name: 'Jimmi',
    isCurrentTrac: false,
    threadUrl: 'https://radixtalk.com/t/candidacy-for-radix-dao-llcs-permanent-rac-election/2338/10',
  },
  {
    id: 'genkipool',
    number: '07',
    name: 'GENKIPOOL',
    handle: '@LRB85',
    isCurrentTrac: false,
    threadUrl: 'https://radixtalk.com/t/candidacy-for-permanent-rac-genkipool/2346',
  },
  {
    id: 'cryptobright',
    number: '08',
    name: 'CryptoBright (Cluse)',
    handle: '@cryptobright545',
    isCurrentTrac: false,
    threadUrl: 'https://radixtalk.com/t/candidacy-for-permanent-rac-cryptobright-aka-cluse/2347',
  },
  {
    id: 'lunatic',
    number: '09',
    name: 'Lunatic',
    isCurrentTrac: false,
    threadUrl: 'https://radixtalk.com/t/candidacy-for-radix-dao-llcs-permanent-rac-election/2338/14',
  },
  {
    id: 'kadafi',
    number: '10',
    name: 'Kadafi_Enduro (Hubert)',
    isCurrentTrac: false,
    threadUrl: 'https://radixtalk.com/t/candidacy-for-radix-dao-llcs-permanent-rac-election/2338/16',
  },
  {
    id: 'wingspan',
    number: '11',
    name: 'wingspan',
    handle: '@wingspan_r',
    isCurrentTrac: false,
    threadUrl: 'https://radixtalk.com/t/candidacy-for-permanent-rac-wingspan/2348',
  },
  {
    id: 'markus',
    number: '12',
    name: 'Markus',
    handle: '@mx472',
    isCurrentTrac: false,
    threadUrl: 'https://radixtalk.com/t/candidacy-for-the-permanent-rac-markus/2349',
  },
  {
    id: 'tadas',
    number: '13',
    name: 'Tadas_GetRadix',
    isCurrentTrac: true,
    threadUrl: 'https://radixtalk.com/t/candidacy-for-radix-dao-llcs-permanent-rac-election/2338/20',
  },
  {
    id: 'alfred',
    number: '14',
    name: 'Alfred_Dulaire (√Mr. Peanutbutter)',
    handle: '@ALFRED_DULAiRE',
    isCurrentTrac: true,
    threadUrl: 'https://radixtalk.com/t/candidacy-for-radix-dao-llcs-permanent-rac-election/2338/21',
  },
  {
    id: 'robellino1',
    number: '15',
    name: 'Robellino1',
    isCurrentTrac: false,
    threadUrl: 'https://radixtalk.com/t/candidacy-for-radix-dao-llcs-permanent-rac-election/2338/22',
  },
];

export const DAO_DELEGATED_FUNCTION_IDS = [
  'treasury_signers',
  'governance_operator',
  'legal_signatory',
  'compliance_liaison',
  'web2_custodian',
] as const;

export const DAO_WORKING_GROUP_IDS = [
  'strategic_coordination',
  'governance_legal',
] as const;
