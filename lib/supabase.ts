import { createClient } from '@supabase/supabase-js';

// Usamos placeholders si las variables no existen (ej: durante el build en GitHub Actions)
// En runtime o en Vercel sí estarán disponibles gracias a la integración.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';

/**
 * Server-only Supabase client using the service_role key.
 * This client bypasses RLS — use ONLY in API Routes and Server Components.
 * NEVER expose to the browser.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
