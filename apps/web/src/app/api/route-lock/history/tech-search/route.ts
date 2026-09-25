import { NextResponse, type NextRequest } from 'next/server'

import { supabaseAdmin } from '@/shared/data/supabase/admin'
import { supabaseServer } from '@/shared/data/supabase/server'
import { requireAccessPass } from '@/shared/access/requireAccessPass'
import { requireModule } from '@/shared/access/access'

export const runtime = 'nodejs'

async function resolveSelectedPcOrg(req: NextRequest) {
  const sb = await supabaseServer()
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser()

  if (!user || userErr) {
    return { ok: false as const, status: 401, error: 'unauthorized' }
  }

  const admin = supabaseAdmin()

  const { data: profile, error: profileErr } = await admin
    .from('user_profile')
    .select('selected_pc_org_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (profileErr) {
    return { ok: false as const, status: 500, error: profileErr.message }
  }

  const pc_org_id = String(profile?.selected_pc_org_id ?? '').trim()
  if (!pc_org_id) {
    return { ok: false as const, status: 409, error: 'no selected org' }
  }

  try {
    const pass = await requireAccessPass(req, pc_org_id)
    requireModule(pass, 'route_lock')

    return {
      ok: true as const,
      pc_org_id,
    }
  } catch (err: any) {
    const status = Number(err?.status ?? 500)

    if (status === 401) return { ok: false as const, status: 401, error: 'unauthorized' }
    if (status === 403) return { ok: false as const, status: 403, error: 'forbidden' }
    if (status === 400)
      return {
        ok: false as const,
        status: 400,
        error: String(err?.message ?? 'invalid_pc_org_id'),
      }

    return { ok: false as const, status: 500, error: 'access_error' }
  }
}

function escLike(input: string) {
  return input.replace(/[%_,]/g, '')
}

export async function GET(req: NextRequest) {
  const guard = await resolveSelectedPcOrg(req)
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })
  }

  const qRaw = String(req.nextUrl.searchParams.get('q') ?? '').trim()
  const q = escLike(qRaw)
  const limit = Math.max(1, Math.min(20, Number(req.nextUrl.searchParams.get('limit') ?? 10) || 10))

  const admin = supabaseAdmin()

  let query = admin
    .from('route_lock_history_roster_v')
    .select(
      'assignment_id,person_id,tech_id,full_name,co_name,assignment_active,start_date,end_date',
    )
    .eq('pc_org_id', guard.pc_org_id)
    .limit(limit)

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,tech_id.ilike.%${q}%`)
  }

  const { data, error } = await query.order('full_name', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const seen = new Set<string>()

  const items = (data ?? [])
    .map((r: any) => ({
      assignment_id: String(r?.assignment_id ?? '').trim(),
      person_id: String(r?.person_id ?? '').trim(),
      tech_id: String(r?.tech_id ?? '').trim(),
      full_name: String(r?.full_name ?? '').trim(),
      co_name: r?.co_name == null ? null : String(r.co_name),
      assignment_active: !!r?.assignment_active,
      start_date: r?.start_date == null ? null : String(r.start_date),
      end_date: r?.end_date == null ? null : String(r.end_date),
    }))
    .filter((r) => r.assignment_id && r.tech_id && r.full_name)
    .filter((r) => {
      const key = `${r.assignment_id}::${r.tech_id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  return NextResponse.json({
    ok: true,
    items,
  })
}
