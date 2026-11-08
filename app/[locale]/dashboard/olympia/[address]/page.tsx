import { createEntityRoute } from '@/features/dashboard/server/entityRoute';

/** Olympia archive data is final; the page itself stays dynamic like every entity route. */
export const dynamic = 'force-dynamic';

const route = createEntityRoute({ kind: 'olympia', segment: 'olympia' });

export const generateMetadata = route.generateMetadata;
export default route.Page;
