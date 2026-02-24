// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 画面が真っ白になる前に、何が起きているかログを出す
console.log("--- Supabase接続チェック ---");
// console.log("URL:", supabaseUrl);
// console.log("Key:", supabaseAnonKey ? "取得済み" : "未設定");

// URLが不正だとここでプログラムが止まるので、安全な値を入れておく
const safeUrl = supabaseUrl && supabaseUrl.startsWith('http') 
  ? supabaseUrl 
  : 'https://tmp.supabase.co'; 

export const supabase = createClient(safeUrl, supabaseAnonKey || '');