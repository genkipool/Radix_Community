import { z } from 'zod';

export const retRequestSchema = z.object({
  network: z.enum(['mainnet', 'stokenet']).default('mainnet'),
});

const NETWORK_IDS = { mainnet: 1, stokenet: 2 } as const;

export const networkIdFromName = (network: 'mainnet' | 'stokenet'): number =>
  NETWORK_IDS[network];
