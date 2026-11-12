// 首頁的會員入口（右上角）：用 LINE 登入 → 查自己的會員狀態 → 沒註冊過就在這一頁直接填註冊表。
// 流程（2026-11-12 定）：登入後後台查不到這個人、或查得到但還沒申請過 → 首頁直接跳出註冊表；
//   不離開首頁、不用先加團隊 LINE、不選團隊（沒有團隊的人進中央待審，團隊歸屬審核時再處理）。
// 所有讀寫都走「會員閘道」member-gate（伺服器拿 LIFF access token 問 LINE 驗明正身），前端說了不算。
//
// 網址參數：?member=1＝一進來就打開自己的卡（官方帳號「開通會員」「會員卡」從舊會員中心轉過來用）；?oa=@團隊＝記來源官方帳號
// 預覽（不用登入、不寫資料）：網址加 #preview-member=none｜0｜pending｜rejected｜1
//   none＝後台沒有這個人　0＝有列但沒申請過　1111111＝預覽裡「已有人登記」的編號　2675630＝預覽裡查得到的推薦人
import { MEMBER } from './data.js';

const GATE = 'https://nsgqsopqlkhayuefdout.supabase.co/functions/v1/member-gate';
const LATER_KEY = 'aplus-reg-later';   // 按過「先逛逛」：之後進站不再自動跳註冊表（右上角按鈕還在）
const OTHER = '__other__';
const MSG = {
  bad_code: '會員編號是 7 位數字，請再檢查一次',
  bad_name: '請填姓名',
  bad_birthday: '請選生日',
  bad_gender: '請選性別',
  bad_peak: '請選負責你的高峰領袖',
  bad_sponsor: '推薦人編號是 7 位數字，不確定可以先空著',
};
const PREVIEW = {
  none: null,
  0: { name: 'LINE 暱稱', level: 0, ai_credits: 30, status: 'visitor' },
  pending: { name: '王小明', level: 0, ai_credits: 30, status: 'pending', code: '2712345', peak_leader: '游育杰' },
  rejected: { name: '王小明', level: 0, ai_credits: 30, status: 'rejected', code: '2712345', birthday: '1968-03-09', gender: 'male',
    peak_leader: '游育杰', sponsor_code: '2675630', sponsor_name: '游育杰' },
  1: { name: '預覽會員', level: 1, ai_credits: 80, status: 'member', code: '2712345' },
};

function loadScript(src) {
  return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.append(s); });
}
const pad = (n) => String(n).padStart(2, '0');

export function initMember({ openCard, el }) {
  const btn = document.getElementById('member-btn');
  const preview = (location.hash.match(/preview-member=(none|pending|rejected|\d)/) || [])[1];
  if (!MEMBER.liffId && !preview) return; // 首頁 LIFF 還沒建好：先不顯示，現在的首頁完全不受影響
  btn.hidden = false;

  let lineUserId = null, profile = null, member = undefined; // undefined＝還沒查；null＝後台沒有這個人
  let peaks = null;                                          // 負責高峰領袖下拉（查過就留著）
  let mockMember = preview ? PREVIEW[preview] : null;

  const param = (k) => new URLSearchParams(location.search).get(k);   // 要等 liff.init 之後才讀（LIFF 會先把參數包在 liff.state）
  const logged = () => Boolean(preview || lineUserId);
  const needReg = () => member === null || member?.status === 'visitor' || member?.status === 'rejected';
  const later = () => { try { return localStorage.getItem(LATER_KEY) === '1'; } catch { return false; } };

  /* ---------- 會員閘道 ---------- */
  function mock(body) {
    if (body.action === 'me') return { ok: true, member: mockMember };
    const a = body.args || {};
    if (body.fn === 'reg_options') return { ok: true, data: { peaks: ['林姍玥', '游育杰', '黃舜心'] } };
    if (body.fn === 'reg_sponsor') return { ok: true, data: { name: a.p_code === '2675630' ? '游育杰' : null } };
    if (body.fn === 'register_member') {
      if (a.p_code === '1111111' && !a.p_coop) return { ok: true, data: { ok: false, error: 'code_taken' } };
      mockMember = { name: a.p_name, level: 0, ai_credits: 30, status: 'pending', code: a.p_code + (a.p_coop ? 'B' : ''),
        peak_leader: a.p_peak, sponsor_name: a.p_sponsor_name, coop_pending: Boolean(a.p_coop) };
      return { ok: true, data: { ok: true, coop: Boolean(a.p_coop) } };
    }
    return { ok: false };
  }
  async function gate(body) {
    if (preview) return mock(body);
    const res = await fetch(GATE, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: window.liff.getAccessToken(), ...body }) });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || 'gate');
    return d;
  }
  async function lookup() {
    const d = await gate({ action: 'me' });
    if (d.profile) profile = { ...profile, ...d.profile };
    member = d.member;                       // null＝後台沒有這個人
  }

  /* ---------- 右上角按鈕 ---------- */
  function paint() {
    btn.replaceChildren();
    const known = member && (member.status === 'member' || member.status === 'pending');
    if (known) {
      if (profile?.pictureUrl) { const img = el('img', 'member-pic'); img.src = profile.pictureUrl; img.alt = ''; btn.append(img); }
      btn.append(el('span', 'member-name', member.name || profile?.displayName || '會員'),
        member.status === 'member' ? el('span', 'member-vip', `VIP${member.level ?? 0}`) : el('span', 'member-vip member-wait', '審核中'));
    } else if (logged() && member !== undefined) {
      btn.append(el('span', 'member-name', '註冊成為會員'));
    } else {
      btn.append(el('span', 'member-name', '會員登入'));
    }
  }

  function logoutButton() {
    const out = el('button', 'button button-sub', '登出'); out.type = 'button';
    out.addEventListener('click', () => { window.liff.logout(); location.reload(); });
    return out;
  }
  const canLogout = () => !preview && window.liff?.isLoggedIn?.();

  /* ---------- 會員卡／審核中 ---------- */
  function memberCard() {
    const wrap = el('div', 'simple');
    wrap.append(el('h2', 'card-title', member.name || profile?.displayName || '會員'));
    const dl = el('dl', 'port');
    dl.append(el('dt', '', '等級'), el('dd', '', `VIP${member.level ?? 0}`), el('dt', '', 'AI 點數'), el('dd', '', `${member.ai_credits ?? 0} 點`));
    if (member.code) dl.append(el('dt', '', '會員編號'), el('dd', '', String(member.code).slice(0, 7)));
    wrap.append(dl);
    if (canLogout()) { const row = el('div', 'card-buttons reg-actions'); row.append(logoutButton()); wrap.append(row); }
    return wrap;
  }
  function pendingCard() {
    const wrap = el('div', 'simple');
    wrap.append(el('h2', 'card-title', '申請已送出'),
      el('p', 'simple-line', '團隊確認後就會通過，這張卡會自動變成正式會員，不用再填一次。'));
    const dl = el('dl', 'port');
    dl.append(el('dt', '', '會員編號'), el('dd', '', String(member.code || '').slice(0, 7)),
      el('dt', '', '姓名'), el('dd', '', member.name || ''),
      el('dt', '', '負責高峰領袖'), el('dd', '', member.peak_leader || ''));
    wrap.append(dl);
    if (member.coop_pending) wrap.append(el('p', 'note', '共同經營・待確認'));
    if (canLogout()) { const row = el('div', 'card-buttons reg-actions'); row.append(logoutButton()); wrap.append(row); }
    return wrap;
  }

  /* ---------- 註冊表 ---------- */
  function field(label, required, control, hint) {
    const box = el('div', 'reg-field');
    const lab = el(control.id ? 'label' : 'p', 'reg-label', label);
    lab.append(el('span', required ? 'reg-tag' : 'reg-tag reg-opt', required ? '必填' : '選填'));
    if (control.id) lab.htmlFor = control.id;
    box.append(lab, control);
    if (hint) box.append(el('p', 'reg-hint', hint));
    return box;
  }
  function input(id, props) { const i = el('input', 'reg-input'); i.id = id; i.type = 'text'; Object.assign(i, props); return i; }
  function select(id, first, options) {
    const s = el('select', 'reg-select'); s.id = id;
    const o0 = el('option', '', first); o0.value = ''; s.append(o0);
    for (const [value, text] of options) { const o = el('option', '', text); o.value = value; s.append(o); }
    return s;
  }

  async function regCard() {
    if (!peaks) {
      try { peaks = (await gate({ action: 'register', fn: 'reg_options' })).data?.peaks || []; } catch { peaks = null; }
    }
    const old = member?.status === 'rejected' ? member : {};   // 被退回：把上次填的帶回來改
    const form = el('form', 'simple reg'); form.noValidate = true;
    form.append(el('h2', 'card-title', '註冊成為會員'),
      el('p', 'simple-line', old.status ? '上次的申請被退回了。請檢查下面的資料，改好再送出一次。' : '填好送出，團隊確認後就會通過。'));

    // 會員編號、姓名
    const fCode = input('reg-code', { inputMode: 'numeric', maxLength: 7, placeholder: '7 位數字', autocomplete: 'off', value: String(old.code || '').slice(0, 7) });
    const fName = input('reg-name', { maxLength: 40, placeholder: '會員證上的姓名', autocomplete: 'name', value: old.name || '' });

    // 生日：年月日三格下拉（比月曆好選）
    const thisYear = new Date().getFullYear();
    const years = []; for (let y = thisYear; y >= 1925; y -= 1) years.push([String(y), `${y}（民國 ${y - 1911} 年）`]);
    const fY = select('reg-y', '年', years);
    const fM = select('reg-m', '月', Array.from({ length: 12 }, (_, i) => [String(i + 1), `${i + 1} 月`]));
    const fD = select('reg-d', '日', Array.from({ length: 31 }, (_, i) => [String(i + 1), `${i + 1} 日`]));
    fM.setAttribute('aria-label', '生日的月'); fD.setAttribute('aria-label', '生日的日');
    const bRow = el('div', 'reg-row'); bRow.append(fY, fM, fD);
    const bd = /^(\d{4})-(\d{2})-(\d{2})/.exec(old.birthday || '');
    if (bd) { fY.value = String(Number(bd[1])); fM.value = String(Number(bd[2])); fD.value = String(Number(bd[3])); }
    const bField = field('生日', true, bRow); bField.querySelector('.reg-label').htmlFor = 'reg-y';

    // 性別
    let gender = old.gender || '';
    const chips = el('div', 'reg-chips');
    const gBtn = [['male', '男'], ['female', '女']].map(([v, t]) => {
      const b = el('button', 'reg-chip', t); b.type = 'button'; b.setAttribute('aria-pressed', String(gender === v));
      b.addEventListener('click', () => { gender = v; gBtn.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
      chips.append(b); return b;
    });

    // 負責高峰領袖：名單＋「不在名單上」自己填；名單載不到就直接自己填
    const fPeakOther = input('reg-peak-other', { maxLength: 40, placeholder: '高峰領袖的姓名' });
    let fPeak = null;
    const peakBox = el('div', 'reg-stack');
    if (peaks && peaks.length) {
      fPeak = select('reg-peak', '請選擇', [...peaks.map((n) => [n, n]), [OTHER, '不在名單上（自己填）']]);
      const showOther = () => { fPeakOther.hidden = fPeak.value !== OTHER; };
      fPeak.addEventListener('change', () => { showOther(); if (fPeak.value === OTHER) fPeakOther.focus(); });
      if (old.peak_leader) { fPeak.value = peaks.includes(old.peak_leader) ? old.peak_leader : OTHER; if (fPeak.value === OTHER) fPeakOther.value = old.peak_leader; }
      showOther();
      peakBox.append(fPeak, fPeakOther);
    } else {
      fPeakOther.value = old.peak_leader || '';
      peakBox.append(fPeakOther);
    }
    const pField = field('負責高峰領袖', true, peakBox, '不確定的話，問介紹你的人是哪一位高峰在帶');
    pField.querySelector('.reg-label').htmlFor = fPeak ? 'reg-peak' : 'reg-peak-other';

    // 推薦人（選填）：編號填滿 7 碼就查族譜，查得到帶出姓名
    const more = el('details', 'reg-more');
    const sum = el('summary', '', '推薦人'); sum.append(el('span', 'reg-tag reg-opt', '選填'), el('span', 'reg-hint', '知道的話填一下，審核會快很多'));
    const fSc = input('reg-sc', { inputMode: 'numeric', maxLength: 8, placeholder: '7 位數字', autocomplete: 'off', value: old.sponsor_code || '' });
    const fSn = input('reg-sn', { maxLength: 40, placeholder: '推薦人的姓名', autocomplete: 'off', value: old.sponsor_name || '' });
    const scMsg = el('p', 'reg-hint'); scMsg.hidden = true; scMsg.setAttribute('aria-live', 'polite');
    const scField = field('推薦人編號', false, fSc); scField.append(scMsg);
    more.append(sum, scField, field('推薦人姓名', false, fSn));
    if (old.sponsor_code || old.sponsor_name) more.open = true;
    let asked = '', autoName = '';
    fSc.addEventListener('input', async () => {
      const code = fSc.value.trim().toUpperCase();
      if (!/^\d{7}[A-Z]?$/.test(code)) { scMsg.hidden = true; asked = ''; return; }
      if (code === asked) return;
      asked = code;
      try {
        const name = (await gate({ action: 'register', fn: 'reg_sponsor', args: { p_code: code } })).data?.name;
        if (asked !== code) return;                                   // 查的時候他又改了
        scMsg.textContent = name ? `✓ 找到：${name}　是這位嗎？` : '系統裡還沒有這個人，請在下面填推薦人姓名';
        scMsg.hidden = false;
        if (!fSn.value.trim() || fSn.value === autoName) { fSn.value = name || ''; autoName = name || ''; }   // 自己打的姓名不蓋；上次自動帶的要跟著換
      } catch { scMsg.hidden = true; }
    });

    // 錯誤訊息、共同經營詢問、按鈕
    const err = el('p', 'reg-err'); err.hidden = true; err.setAttribute('role', 'alert');
    const coopBox = el('div', 'reg-coop'); coopBox.hidden = true;
    const coopYes = el('button', 'button', '我們是共同經營'); coopYes.type = 'button';
    const coopNo = el('button', 'button button-sub', '我再檢查一下編號'); coopNo.type = 'button';
    const coopRow = el('div', 'card-buttons'); coopRow.append(coopYes, coopNo);
    coopBox.append(el('p', '', '這個會員編號已經有人登記了。如果你們是共同經營（兩個人共用這個編號），請按下面按鈕，團隊確認後就會通過。'), coopRow);
    const send = el('button', 'button', '送出'); send.type = 'submit';
    const skip = el('button', 'button button-sub', '先逛逛'); skip.type = 'button';
    const actions = el('div', 'card-buttons reg-actions'); actions.append(send, skip);
    if (canLogout()) actions.append(logoutButton());

    form.append(field('會員編號', true, fCode), field('姓名', true, fName), bField, field('性別', true, chips), pField, more, err, coopBox, actions);

    const fail = (text, focus) => { err.textContent = text; err.hidden = false; (focus || err).scrollIntoView({ block: 'center' }); focus?.focus({ preventScroll: true }); };
    async function submit(coop) {
      err.hidden = true;
      const code = fCode.value.trim(), name = fName.value.trim();
      if (!/^\d{7}$/.test(code)) return fail(MSG.bad_code, fCode);
      if (!name) return fail(MSG.bad_name, fName);
      const y = Number(fY.value), mo = Number(fM.value), d = Number(fD.value);
      const day = new Date(y, mo - 1, d);
      if (!y || !mo || !d || day.getMonth() !== mo - 1 || day > new Date()) return fail(MSG.bad_birthday, !y ? fY : !mo ? fM : fD);
      if (!gender) return fail(MSG.bad_gender, gBtn[0]);
      let peak = fPeak ? fPeak.value : OTHER;
      if (!peak) return fail(MSG.bad_peak, fPeak);
      if (peak === OTHER) { peak = fPeakOther.value.trim(); if (!peak) return fail('請填高峰領袖的姓名', fPeakOther); }
      const sc = fSc.value.trim().toUpperCase();
      if (sc && !/^\d{7}[A-Z]?$/.test(sc)) { more.open = true; return fail(MSG.bad_sponsor, fSc); }
      if (sc && sc.slice(0, 7) === code) { more.open = true; return fail('推薦人編號不能跟自己的會員編號一樣', fSc); }

      send.disabled = coopYes.disabled = true; send.textContent = '送出中…';
      try {
        const r = (await gate({ action: 'register', fn: 'register_member', args: {
          p_code: code, p_name: name, p_birthday: `${y}-${pad(mo)}-${pad(d)}`, p_gender: gender, p_peak: peak,
          p_sponsor_code: sc || null, p_sponsor_name: fSn.value.trim() || null, p_coop: Boolean(coop), p_oa: param('oa'),
        } })).data || {};
        if (r.ok || r.error === 'pending' || r.error === 'already_member') {   // 送出成功（或其實早就送過）→ 換成最新的卡
          await lookup(); paint(); openMine(); return;
        }
        if (r.error === 'code_taken') { coopBox.hidden = false; coopBox.scrollIntoView({ block: 'center' }); }
        else fail(MSG[r.error] || '送出失敗，請再試一次');
      } catch { fail('連線失敗，請再試一次'); }
      send.disabled = coopYes.disabled = false; send.textContent = '送出';
    }
    form.addEventListener('submit', (e) => { e.preventDefault(); coopBox.hidden = true; submit(false); });
    coopYes.addEventListener('click', () => submit(true));
    coopNo.addEventListener('click', () => { coopBox.hidden = true; fCode.focus(); });
    fCode.addEventListener('input', () => { coopBox.hidden = true; });
    skip.addEventListener('click', () => {
      try { localStorage.setItem(LATER_KEY, '1'); } catch { /* 無痕模式：下次還會跳 */ }
      document.getElementById('card-close').click();
    });
    return form;
  }

  /* ---------- 開哪一張 ---------- */
  async function openMine() {
    if (member?.status === 'member') return openCard(memberCard(), false);
    if (member?.status === 'pending') return openCard(pendingCard(), false);
    const tour = document.getElementById('tour'); if (tour) tour.hidden = true;   // 註冊表優先，導覽下次再看
    openCard(await regCard(), true);
  }

  btn.addEventListener('click', async () => {
    if (!logged()) { // 還沒登入：LINE 登入後會回到這一頁，沒註冊過的會直接看到註冊表
      if (!window.liff) return;
      window.liff.login({ redirectUri: location.href.split('#')[0] });
      return;
    }
    if (member === undefined) { try { await lookup(); paint(); } catch { return; } }
    openMine();
  });

  // 切回這一頁：重查狀態（審核通過了就自動換成會員卡）。填到一半的註冊表不動它。
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || preview || !lineUserId || member?.status === 'member') return;
    const before = member?.status;
    try { await lookup(); } catch { return; }
    paint();
    if (before === 'pending' && member?.status === 'member') openCard(memberCard(), false);
  });

  (async () => {
    paint();
    try {
      if (!preview) {
        await loadScript(MEMBER.liffSdk);
        await window.liff.init({ liffId: MEMBER.liffId });
        if (!window.liff.isLoggedIn()) {
          if (param('member')) window.liff.login({ redirectUri: location.href.split('#')[0] });   // 從「開通會員」來的：直接登入
          return;
        }
        profile = await window.liff.getProfile();
        lineUserId = profile.userId;
      }
      await lookup();
    } catch (e) { console.warn('member', e); }
    paint();
    if (member === undefined) return;                       // 沒查成：不亂跳，按鈕再按一次會重查
    if (param('member')) openMine();
    else if (needReg() && !later()) openMine();             // 第一次進來、後台沒建檔 → 直接註冊
  })();
}
