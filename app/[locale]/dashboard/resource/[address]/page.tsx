import { createEntityRoute } from '@/features/dashboard/server/entityRoute';

/** Heavy data is cached in the service layer; the page itself stays dynamic. */
export const dynamic = 'force-dynamic';

const route = createEntityRoute({ kind: 'resource', segment: 'resource' });

export const generateMetadata = route.generateMetadata;
export default route.Page;
