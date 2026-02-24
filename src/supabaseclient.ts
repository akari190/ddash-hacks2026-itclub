import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://pnmqxwcokxpiexxvrmza.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBubXF4d2Nva3hwaWV4eHZybXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODg5OTAsImV4cCI6MjA4NzQ2NDk5MH0.RxbtkNzYLispJ8-naIchicEQXnw6rat-pU9pw9U5qcE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);