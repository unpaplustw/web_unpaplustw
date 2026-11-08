// 首頁的會員入口（右上角）：用 LINE 登入，向會員中心查「名字、VIP 等級、AI 點數」。
// 會員中心是核心（身分、團隊、等級、點數）；這裡只讀，不寫任何資料。
// 自己的會員資料一律走「會員閘道」member-gate（伺服器拿 LIFF access token 問 LINE 驗明正身才查），前端說了不算。
// list_join_oas（可加入的 OA 清單）是公開資料，直接查。
//
// 預覽（不用登入）：網址加 #preview-member=none｜0｜1   none＝還沒加任何 OA
import { MEMBER } from './data.js';

const SB_URL = 'https://nsgqsopqlkhayuefdout.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZ3Fzb3BxbGtoYXl1ZWZkb3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzgzMjgsImV4cCI6MjA4ODMxNDMyOH0.FCMF_WaWjmtuWUKO2vqQBM4cFVGrdqt9fdmxYwUii0Y';
const HUB = `https://liff.line.me/${MEMBER.hubLiffId}`;
const GATE = `${SB_URL}/functions/v1/member-gate`;

async function rpc(name, args) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.json();
}
function loadScript(src) {
  return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.append(s); });
}

export function initMember({ openCard, el }) {
  const btn = document.getElementById('member-btn');
  const preview = (location.hash.match(/preview-member=(none|\d)/) || [])[1];
  if (!MEMBER.liffId && !preview) return; // 首頁 LIFF 還沒建好：先不顯示，現在的首頁完全不受影響
  btn.hidden = false;

  let lineUserId = null, profile = null, member = undefined; // undefined＝還沒查；null＝會員中心查不到

  const vip = (m) => `VIP${m.level ?? 0}`;
  function paint() {
    btn.replaceChildren();
    if (member) {
      if (profile?.pictureUrl) { const img = el('img', 'member-pic'); img.src = profile.pictureUrl; img.alt = ''; btn.append(img); }
      btn.append(el('span', 'member-name', member.name || profile?.displayName || '會員'), el('span', 'member-vip', vip(member)));
    } else if (lineUserId || member === null) {
      btn.append(el('span', 'member-name', '加入團隊 LINE'));
    } else {
      btn.append(el('span', 'member-name', '會員登入'));
    }
  }

  function link(label, href, primary = true) { const a = el('a', primary ? 'button' : 'button button-sub', label); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; }
  async function joinCard() {
    const wrap = el('div', 'simple');
    wrap.append(el('h2', 'card-title', '先加入你的團隊 LINE'),
      el('p', 'card-hook', '用 LINE 登入了，但會員中心還找不到你。'),
      el('p', 'simple-line', '先加入介紹你的人所屬團隊的 LINE 官方帳號，加完回到這一頁，會自動接上。不知道該加哪一個，請問介紹你的人。'));
    const list = el('div', 'card-buttons');
    wrap.append(list);
    try {
      const want = new URLSearchParams(location.search).get('oa');
      let oas = await rpc('list_join_oas', { p_handle: want });
      if ((!oas || !oas.length) && want) oas = await rpc('list_join_oas', { p_handle: null });
      for (const t of oas || []) list.append(link(`➕ ${t.owner_name}`, `https://line.me/R/ti/p/${encodeURIComponent(t.line_handle)}`, false));
      if (!oas || !oas.length) list.append(el('p', 'simple-line', '目前查不到可加入的官方帳號，請聯繫你的介紹人。'));
    } catch { list.append(el('p', 'simple-line', '清單載入失敗，請重新整理。')); }
    return wrap;
  }
  function memberCard() {
    const wrap = el('div', 'simple');
    wrap.append(el('h2', 'card-title', member.name || profile?.displayName || '會員'));
    const dl = el('dl', 'port');
    dl.append(el('dt', '', '等級'), el('dd', '', vip(member)), el('dt', '', 'AI 點數'), el('dd', '', `${member.ai_credits ?? 0} 點`));
    wrap.append(dl);
    const row = el('div', 'card-buttons');
    if ((member.level ?? 0) < 1) {
      wrap.append(el('p', 'card-hook', '你現在是體驗帳號。'), el('p', 'simple-line', '填寫會員編號與介紹人，由團隊審核後成為正式會員。'));
      row.append(link('註冊成為會員', HUB));
    } else {
      row.append(link('我的會員卡', HUB));
    }
    if (!preview && window.liff?.isLoggedIn?.()) {
      const out = el('button', 'button button-sub', '登出'); out.type = 'button';
      out.addEventListener('click', () => { window.liff.logout(); location.reload(); });
      row.append(out);
    }
    wrap.append(row);
    return wrap;
  }

  async function lookup() {
    if (preview) { member = preview === 'none' ? null : { name: '預覽會員', level: Number(preview), ai_credits: preview === '0' ? 30 : 80 }; return; }
    const res = await fetch(GATE, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: window.liff.getAccessToken(), action: 'me' }) });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || 'gate');
    if (d.profile) profile = { ...profile, ...d.profile };
    member = d.member;                       // null＝會員中心查不到（還沒加任何團隊 OA）
  }

  btn.addEventListener('click', async () => {
    if (!preview && !lineUserId) { // 還沒登入：LINE 登入後會回到這一頁
      if (!window.liff) return;
      window.liff.login({ redirectUri: location.href.split('#')[0] });
      return;
    }
    if (member) openCard(memberCard(), false);
    else openCard(await joinCard(), false);
  });

  // 加完好友切回來：自動重查，不用他自己想要按哪裡
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || member || !lineUserId) return;
    try { await lookup(); paint(); if (member) openCard(memberCard(), false); } catch { /* 下次再查 */ }
  });

  (async () => {
    paint();
    if (preview) { await lookup(); paint(); return; }
    try {
      await loadScript(MEMBER.liffSdk);
      await window.liff.init({ liffId: MEMBER.liffId });
      if (!window.liff.isLoggedIn()) return;
      profile = await window.liff.getProfile();
      lineUserId = profile.userId;
      await lookup();
    } catch (e) { console.warn('member', e); }
    paint();
  })();
}
