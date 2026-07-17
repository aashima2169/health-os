// app/api/agents/signals/[id]/route.ts
// User-driven status changes only — "resolved" (I understand this now),
// "dismissed" (not relevant), or "active" (reopening a past decision from
// the history view). The model is never allowed to set any of these itself
// (see SIGNALS_PROMPT in lib/agents/prompts.ts) — declaring an
// investigation closed (or reopening one) is a call the person makes, not
// the AI.
import { NextRequest, NextResponse } from 'next/server'
import { setSignalStatus } from '../../../../../lib/agents/signalsStore'
import { createRequestClient } from '../../../../../lib/supabaseServer'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { status } = await req.json()

    if (status !== 'resolved' && status !== 'dismissed' && status !== 'active') {
      return NextResponse.json({ error: 'status must be "resolved", "dismissed", or "active"' }, { status: 400 })
    }

    const client = await createRequestClient()
    await setSignalStatus(id, status, client)
    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('[SIGNALS] setSignalStatus error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
