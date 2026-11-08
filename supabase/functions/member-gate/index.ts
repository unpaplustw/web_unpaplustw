// 會員閘道（member-gate）：全站「誰在操作」由這裡驗證，前端說了不算。
// 做法沿用 analyze-product：前端交 LIFF access token → 問 LINE 這是不是我們頻道發的、是哪個人 → 才用這個身分做事。
// （access token 會被 LIFF 自動續期；idToken 約 1 小時就過期，不用它。見 wiki 工具庫/LINE.md）
//
// 目前的動作：
//   me       → 回傳自己的會員資料（名字、VIP 等級、AI 點數；不含電話 email）
//   academy  → 環球致富學院的 6 支函式（白名單），身分欄一律換成驗證過的 userId，前端傳的不算
// 之後要加的（發通行證、加點數…）都在這裡加 action，敏感動作一律只走這支。
import { createClient } from 'jsr:@supabase/supabase-js@2';

const LINE_CHANNEL_ID = '2009692859'; // 全站 LIFF 共用的 LINE Login channel
const ALLOW_ORIGINS = ['https://unpaplus.com.tw', 'http://localhost:8767'];
const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

// 學院通道：fn → 身分參數名、允許前端帶的其他參數（其餘一律丟掉）
const ACADEMY: Record<string, { id: string; args: string[] }> = {
  get_academy_context:      { id: 'p_line_user_id',  args: [] },
  apply_academy:            { id: 'p_line_user_id',  args: ['p_np_member_code', 'p_name', 'p_phone', 'p_cfc_leader', 'p_reason'] },
  get_academy_lesson:       { id: 'p_line_user_id',  args: ['p_lesson_id'] },
  list_academy_enrollments: { id: 'p_admin_line_id', args: ['p_status'] },
  approve_academy:          { id: 'p_admin_line_id', args: ['p_member_id', 'p_plan', 'p_expires_at'] },
  revoke_academy:           { id: 'p_admin_line_id', args: ['p_member_id', 'p_reason'] },
};

function cors(req: Request) {
  const o = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOW_ORIGINS.includes(o) ? o : ALLOW_ORIGINS[0],
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

// access token → 可信的 LINE 身分；驗不過回 null
async function verifyLine(accessToken: string) {
  const vr = await fetch('https://api.line.me/oauth2/v2.1/verify?access_token=' + encodeURIComponent(accessToken));
  const vd = await vr.json().catch(() => ({}));
  if (!vr.ok || String(vd.client_id) !== LINE_CHANNEL_ID || !(vd.expires_in > 0)) return null;
  const pr = await fetch('https://api.line.me/v2/profile', { headers: { Authorization: 'Bearer ' + accessToken } });
  const pd = await pr.json().catch(() => ({}));
  if (!pr.ok || !pd.userId) return null;
  return { userId: pd.userId as string, displayName: pd.displayName as string, pictureUrl: (pd.pictureUrl ?? null) as string | null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { ok: false, error: 'method' }, 405);
  let body: { access_token?: string; action?: string; fn?: string; args?: Record<string, unknown> } = {};
  try { body = await req.json(); } catch { return json(req, { ok: false, error: 'bad_json' }, 400); }
  if (!body.access_token) return json(req, { ok: false, error: 'no_token' }, 401);

  const who = await verifyLine(body.access_token);
  if (!who) return json(req, { ok: false, error: 'invalid_token' }, 401);

  switch (body.action ?? 'me') {
    case 'me': {
      const { data, error } = await sb.rpc('get_member_basic', { p_line_user_id: who.userId });
      if (error) return json(req, { ok: false, error: 'db' }, 500);
      const member = data && data.id ? { name: data.name, level: data.level ?? 0, ai_credits: data.ai_credits ?? 0 } : null;
      return json(req, { ok: true, profile: { displayName: who.displayName, pictureUrl: who.pictureUrl }, member });
    }
    case 'academy': {
      const spec = ACADEMY[body.fn ?? ''];
      if (!spec) return json(req, { ok: false, error: 'unknown_fn' }, 400);
      const params: Record<string, unknown> = { [spec.id]: who.userId };
      for (const k of spec.args) params[k] = body.args?.[k] ?? null;
      const { data, error } = await sb.rpc(body.fn!, params);
      if (error) return json(req, { ok: false, error: 'db' }, 500);
      return json(req, { ok: true, data });
    }
    default:
      return json(req, { ok: false, error: 'unknown_action' }, 400);
  }
});
