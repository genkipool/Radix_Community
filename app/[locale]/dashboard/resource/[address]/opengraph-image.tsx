/** Share card for an explorer resource page; see features/dashboard/server/entityOg. */
import { entityOgImage } from '@/features/dashboard/server/entityOg';
import { OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og-card';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Radix Community';

export default entityOgImage('resource');
