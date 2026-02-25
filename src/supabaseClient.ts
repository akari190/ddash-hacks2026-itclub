// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = "https://pnmqxwcokxpiexxvrmza.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBubXF4d2Nva3hwaWV4eHZybXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODg5OTAsImV4cCI6MjA4NzQ2NDk5MH0.RxbtkNzYLispJ8-naIchicEQXnw6rat-pU9pw9U5qcE"


// 画面が真っ白になる前に、何が起きているかログを出す
console.log("--- Supabase接続チェック ---");
// console.log("URL:", supabaseUrl);
// console.log("Key:", supabaseAnonKey ? "取得済み" : "未設定");

// // URLが不正だとここでプログラムが止まるので、安全な値を入れておく
// const safeUrl = supabaseUrl && supabaseUrl.startsWith('http') 
//   ? supabaseUrl 
//   : 'https://tmp.supabase.co'; 

// export const supabase = createClient(safeUrl, supabaseAnonKey || '');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);