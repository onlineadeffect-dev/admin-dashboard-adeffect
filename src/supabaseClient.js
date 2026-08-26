import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

// Fail gracefully with a console error instead of throwing an unhandled top-level exception
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables! Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Vercel.");
}
