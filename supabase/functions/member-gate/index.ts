// 會員閘道（member-gate）：全站「誰在操作」由這裡驗證，前端說了不算。
// 做法沿用 analyze-product：前端交 LIFF access token → 問 LINE 這是不是我們頻道發的、是哪個人 → 才用這個身分做事。
// （access token 會被 LIFF 自動續期；idToken 約 1 小時就過期，不用它。見 wiki 工具庫/LINE.md）
//
// 目前的動作：
//   me       → 回傳自己的會員資料與狀態（visitor／pending／rejected／member；查不到列＝null；不含電話 email）
//   academy  → 環球致富學院的 4 支函式（白名單），身分欄一律換成驗證過的 userId，前端傳的不算
//              （2026-11-10 起學院不單獨上鎖：VIP1 以上直接進，沒有申請、審核、特批、停權）
//   admin    → 會員中心後台的 9 支函式（白名單，同上）；能不能做由 DB 授權表 admin_grants 判斷
//   register → 首頁註冊表的 3 支函式（白名單，同上）；頭像由這裡用 LINE 驗過的帶入，前端傳的不算
// 之後要加的（發通行證、加點數…）都在這裡加 action，敏感動作一律只走這支。
import { createClient } from 'jsr:@supabase/supabase-js@2';

const LINE_CHANNEL_ID = '2009692859'; // 全站 LIFF 共用的 LINE Login channel
const ALLOW_ORIGINS = ['https://unpaplus.com.tw', 'http://localhost:8767'];
const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

type Spec = { id: string; args: string[]; pic?: string };

// 學院通道：fn → 身分參數名、允許前端帶的其他參數（其餘一律丟掉）
const ACADEMY: Record<string, Spec> = {
  get_academy_context:      { id: 'p_line_user_id',  args: [] },                        // 能不能進：ok／not_member
  get_academy_lesson:       { id: 'p_line_user_id',  args: ['p_lesson_id'] },
  get_academy_starter:     { id: 'p_line_user_id',  args: [] },                        // 新手村 17 堂＋自己的進度
  log_academy_progress:     { id: 'p_line_user_id',  args: ['p_lesson_id', 'p_pct'] },  // 看到幾成（>=90 算看過）
};

// 會員中心後台（/members/admin/）：權限由 DB 的 admin_can() 照授權表判斷，這裡只負責「你是誰」
const ADMIN: Record<string, Spec> = {
  admin_whoami:       { id: 'p_caller_line_id', args: [] },
  admin_list_members: { id: 'p_caller_line_id', args: ['p_status'] },
  admin_approve:      { id: 'p_caller_line_id', args: ['p_member_id'] },
  admin_reject:       { id: 'p_caller_line_id', args: ['p_member_id'] },
  admin_set_level:    { id: 'p_caller_line_id', args: ['p_member_id', 'p_level'] },
  admin_list_grants:  { id: 'p_caller_line_id', args: [] },
  admin_set_grant:    { id: 'p_caller_line_id', args: ['p_member_id', 'p_action', 'p_scope_type', 'p_scope_id', 'p_on'] },
  admin_list_lineage: { id: 'p_caller_line_id', args: ['p_filter'] },   // 族譜（中央／manage_peaks 權）
  admin_save_lineage: { id: 'p_caller_line_id', args: ['p_member_code', 'p_name', 'p_sponsor_code', 'p_sponsor_name', 'p_peak_core'] },
};
// 首頁註冊（2026-11-12）：登入後後台查不到、或還沒申請過 → 首頁直接填表；不用先加團隊 OA
const REGISTER: Record<string, Spec> = {
  reg_options:     { id: 'p_line_user_id', args: [] },                 // 負責高峰領袖下拉（族譜位階＝高峰）
  reg_sponsor:     { id: 'p_line_user_id', args: ['p_code'] },         // 推薦人編號 → 族譜姓名
  register_member: { id: 'p_line_user_id', pic: 'p_picture_url',
                     args: ['p_code', 'p_name', 'p_birthday', 'p_gender', 'p_peak', 'p_sponsor_code', 'p_sponsor_name', 'p_coop', 'p_oa'] },
};
const CHANNELS: Record<string, Record<string, Spec>> = { academy: ACADEMY, admin: ADMIN, register: REGISTER };

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
      const { data, error } = await sb.rpc('get_member_card', { p_line_user_id: who.userId });
      if (error) return json(req, { ok: false, error: 'db' }, 500);
      const member = data && data.id ? {
        name: data.name, level: data.level ?? 0, ai_credits: data.ai_credits ?? 0, status: data.status,
        code: data.code, birthday: data.birthday, gender: data.gender, peak_leader: data.peak_leader,
        sponsor_code: data.sponsor_code, sponsor_name: data.sponsor_name, coop_pending: data.coop_pending,
      } : null;
      return json(req, { ok: true, profile: { displayName: who.displayName, pictureUrl: who.pictureUrl }, member });
    }
    case 'academy':
    case 'admin':
    case 'register': {
      const list = CHANNELS[body.action], fn = body.fn ?? '';
      const spec = Object.hasOwn(list, fn) ? list[fn] : null;
      if (!spec) return json(req, { ok: false, error: 'unknown_fn' }, 400);
      const params: Record<string, unknown> = { [spec.id]: who.userId };
      for (const k of spec.args) params[k] = body.args?.[k] ?? null;
      if (spec.pic) params[spec.pic] = who.pictureUrl;
      const { data, error } = await sb.rpc(fn, params);
      if (error) return json(req, { ok: false, error: 'db' }, 500);
      return json(req, { ok: true, data });
    }
    default:
      return json(req, { ok: false, error: 'unknown_action' }, 400);
  }
});
