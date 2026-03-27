/**
 * Models and interfaces specific to the Validators slice.
 */

import type { ValidatorOp as ExplorerValidatorOp } from '@/types/radix';

export type ValidatorOp = ExplorerValidatorOp;

export interface ValidatorStats {
  totalStaked: string;
  activeValidators: number;
  totalValidators: number;
  avgApy: number;
  avgUptime: number;
}
