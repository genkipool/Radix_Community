import { z } from 'zod';

export { networkIdFromName } from '@/services/ret';

export const retRequestSchema = z.object({
  network: z.enum(['mainnet', 'stokenet']).default('mainnet'),
});
