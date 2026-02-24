// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// エラー回避のためのチェックを入れるとデバッグしやすいです
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("環境変数が読み込めていません。 .env または GitHub Secrets を確認してください。");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);