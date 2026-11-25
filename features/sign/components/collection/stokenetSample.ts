import { sealImageUrl } from '../../constants/seal';
import { sanitizeSymbol } from '../../lib/nf-manifest-helpers';
import type { CollectionMetaField } from '../../lib/sign-request';

export interface StokenetCollectionSample {
  name: string;
  symbol: string;
  orgName: string;
  orgUrl: string;
  logoUrl: string;
  customMetadata: CollectionMetaField[];
}

interface SampleProfile {
  namePrefix: string;
  symbolBase: string;
  orgName: string;
  domain: string;
  department: string;
  jurisdiction: string;
  category: string;
}

const PROFILES: SampleProfile[] = [
  {
    namePrefix: 'Despacho Jurídico Norte',
    symbolBase: 'DJN',
    orgName: 'Despacho Jurídico Norte S.L.',
    domain: 'norte-legal.example',
    department: 'Contratación y Cumplimiento',
    jurisdiction: 'ES-EU',
    category: 'legal',
  },
  {
    namePrefix: 'Estudio Creativo Atlas',
    symbolBase: 'ECA',
    orgName: 'Estudio Creativo Atlas',
    domain: 'atlas-studio.example',
    department: 'Producción y Licencias',
    jurisdiction: 'EU',
    category: 'creative',
  },
  {
    namePrefix: 'Consultoría Técnica Vega',
    symbolBase: 'CTV',
    orgName: 'Vega Engineering & Audit',
    domain: 'vega-tech.example',
    department: 'Auditoría Técnica',
    jurisdiction: 'INTL',
    category: 'engineering',
  },
  {
    namePrefix: 'Asociación Open Radix',
    symbolBase: 'AOR',
    orgName: 'Asociación Open Radix',
    domain: 'open-radix.example',
    department: 'Secretaría General',
    jurisdiction: 'EU',
    category: 'community',
  },
  {
    namePrefix: 'Notaría Digital Sol',
    symbolBase: 'NDS',
    orgName: 'Notaría Digital Sol (Demo)',
    domain: 'notaria-sol.example',
    department: 'Protocolo Electrónico',
    jurisdiction: 'ES-EU',
    category: 'notary',
  },
  {
    namePrefix: 'Firma Profesional Martín',
    symbolBase: 'FPM',
    orgName: 'Elena Martín · Autónoma',
    domain: 'elena-martin.example',
    department: 'Dirección',
    jurisdiction: 'ES-EU',
    category: 'freelance',
  },
];

let lastProfileIndex = -1;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates coherent, realistic random form data for fast Stokenet testing
 * (valid symbol, HTTPS URL, working icon URL, and non-reserved custom metadata).
 */
export function generateStokenetCollectionSample(
  origin?: string,
): StokenetCollectionSample {
  let idx = randomInt(0, PROFILES.length - 1);
  if (idx === lastProfileIndex && PROFILES.length > 1) {
    idx = (idx + 1) % PROFILES.length;
  }
  lastProfileIndex = idx;

  const profile = PROFILES[idx];
  const tag = randomInt(10, 99);
  const ref = randomInt(1000, 9999);

  return {
    name: `${profile.namePrefix} #${tag}`,
    symbol: sanitizeSymbol(`${profile.symbolBase}${tag}`),
    orgName: profile.orgName,
    orgUrl: `https://${profile.domain}`,
    logoUrl: origin ? sealImageUrl(origin) : '',
    customMetadata: [
      {
        key: 'department',
        value: profile.department,
        locked: false,
      },
      {
        key: 'registry_ref',
        value: `STOKENET-${ref}`,
        locked: true,
      },
      {
        key: 'jurisdiction',
        value: profile.jurisdiction,
        locked: true,
      },
    ],
  };
}
