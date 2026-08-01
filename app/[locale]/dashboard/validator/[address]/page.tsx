import { createEntityRoute } from '@/features/dashboard/server/entityRoute';

/** Heavy data is cached in the service layer; the page itself stays dynamic. */
export const dynamic = 'force-dynamic';

// A validator link is a staking link: people share it to point at who they
// delegate to, not at its transaction stream.
const route = createEntityRoute({ kind: 'validator', segment: 'validator', view: 'staking' });

export const generateMetadata = route.generateMetadata;
export default route.Page;
