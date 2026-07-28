// scripts/create-demo-user.mjs
// One-off script — run locally with `node scripts/create-demo-user.mjs`.
// Creates the fixed demo@flarewise.app Supabase auth user via the admin
// API and prints its user_id, which you then paste into
// supabase/phase_demo_seed.sql and supabase/phase_demo_readonly.sql.
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY straight
// out of .env.local — no dotenv dependency needed for a one-off script.
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

const env = loadEnvLocal()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_EMAIL = 'demo@flarewise.app'

const { data, error } = await supabase.auth.admin.createUser({
  email: DEMO_EMAIL,
  email_confirm: true,
})

if (error) {
  console.error('Failed to create demo user:', error.message)
  process.exit(1)
}

console.log('Demo user created.')
console.log('email:', DEMO_EMAIL)
console.log('user_id:', data.user.id)
console.log('\nPaste this user_id into supabase/phase_demo_seed.sql and supabase/phase_demo_readonly.sql before running them.')
