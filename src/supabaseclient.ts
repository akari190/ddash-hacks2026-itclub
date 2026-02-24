import { createClient } from '@supabase/supabase-js';

// 直接書かずに、Viteの機能で.envから読み込む
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);