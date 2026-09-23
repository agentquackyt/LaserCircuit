import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://awfkolakvukozafqfiwv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_59kuioFM7WVp6_WGUhRjJg_1ZwfXYIO"; // Safe to expose in frontend

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);