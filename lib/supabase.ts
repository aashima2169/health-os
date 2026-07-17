// lib/supabase.ts
// Browser client — session persisted via cookies (not localStorage), so
// middleware.ts (server-side) can see the same session for route
// gating. API-compatible with the plain @supabase/supabase-js client for
// every .from()/.storage() call already used across the app — nothing
// downstream (lib/db.ts, lib/agents/*, existing API routes) needed to
// change for this.
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
