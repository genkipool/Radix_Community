import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Server-only Supabase client using the service_role key.
 * This client bypasses RLS — use ONLY in API Routes and Server Components.
 * NEVER expose to the browser.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
