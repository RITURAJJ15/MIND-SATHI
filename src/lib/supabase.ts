import { createClient } from '@supabase/supabase-js';
import { tabStorage } from './tabStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tlyeuyflanjsowiqwrxo.supabase.co';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_gMWdqSThmv4s1E_lCM0iww_Calt7pJ0';

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('MIND SATHI: Supabase URL or Publishable Key is missing from environment.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: tabStorage,
  },
});
