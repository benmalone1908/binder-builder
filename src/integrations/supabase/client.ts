import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://dgbaqskznbfltnqouwwj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnYmFxc2t6bmJmbHRucW91d3dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTY1MTksImV4cCI6MjA4NjA3MjUxOX0.mXn4-u5SnW1Q8LtL_Xc54c-Df6Ii0DNG_gMNLaAVT7U";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: window.localStorage,
  },
});
