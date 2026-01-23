
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables!');
    console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (typeof window !== 'undefined') {
        console.error('In Vercel: Go to Project Settings > Environment Variables and add these variables');
    }
}

export const supabase = createBrowserClient(
    supabaseUrl || '',
    supabaseAnonKey || ''
)
