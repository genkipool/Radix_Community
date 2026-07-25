import { createEntityRoute } from '@/features/dashboard/server/entityRoute';

/** Heavy data is cached in the service layer; the page itself stays dynamic. */
export const dynamic = 'force-dynamic';

const route = createEntityRoute({ kind: 'validator', segment: 'validator' });

export const generateMetadata = route.generateMetadata;
export default route.Page;
