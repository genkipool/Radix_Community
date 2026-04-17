/**
 * features/dapps/components/TagBadge.tsx
 */

import React from 'react';
import { LabelBadge } from '@/components/ui/LabelBadge';

export function TagBadge({ tag }: { tag: string }) {
  return <LabelBadge value={tag} />;
}
