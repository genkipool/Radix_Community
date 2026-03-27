'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const COOKIE_OPEN_TOPICS = 'docs_open_topics';
const COOKIE_AUTO_COLLAPSE = 'docs_auto_collapse';

/**
 * Persists documentation preferences in cookies.
 */
export async function updateDocsPreference(key: 'topics' | 'autoCollapse', value: string | boolean) {
    const cookieStore = await cookies();
    
    if (key === 'topics') {
        cookieStore.set(COOKIE_OPEN_TOPICS, value as string, { path: '/', maxAge: 31536000 });
    } else {
        cookieStore.set(COOKIE_AUTO_COLLAPSE, String(value), { path: '/', maxAge: 31536000 });
    }
    
    // We don't strictly need revalidatePath here because React Query handles the state,
    // but it's good practice for RSC consistency if other parts of the page use these cookies.
    revalidatePath('/[locale]/docs', 'layout');
}
