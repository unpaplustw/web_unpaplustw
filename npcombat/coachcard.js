// ─────────────────────────────────────────────────────────────
// 🎓 教練卡 —— admin.html（🎓 教練頁）與 coach-review.html（「📋 我的狀況」）共用（2026-11-19）
//   完成度、給教練的話、卡片畫法的規則只在這裡，兩邊看到的數字一定一樣。
//   輸入一包資料 ctx，不碰頁面的全域變數：
//     ctx = { batch, coaches（已核准）, coachMemberIds（Set，教練本人的 member_id）, students（已核准）,
//             engRows, submitRows, allLogs, hwRows, closes, cm（commit.js loadCommit 的結果）, now }
//   需要先載入：units.js（SCHEDULE）、consts.js（GROUPS、trackLabel）、score.js（namePts）、commit.js（loadCommit）
// ─────────────────────────────────────────────────────────────
const ccDs = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ccNm = r => (r && r.members_master && r.members_master.name) || '（未知）';
const ccGroupIdx = c => { const i = (typeof GROUPS !== 'undefined' ? GROUPS : []).indexOf(c.group_name || ''); return i === -1 ? 99 : i; };
const ccTrack = t => (typeof trackLabel === 'function' && trackLabel(t)) || '—';
const ccDone = r => !!r && r.homework !== null && r.homework !== undefined && (r.homework === false || r.homework_replied === true);
const ccEsc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
// 「教練的一天」從早上 05:00 算起（前一天的回報 05:00 才開放標記）——「我的狀況」一天只跳一次就看這個日期
const ccReadDate = now => ccDs(new Date(now.getTime() - 5 * 3600000));
// 配色兩套：後台深色（dark），教練專區淺色（light，2026-11-19 Randoph：深色跟教練專區「有點衝突」→ 改成教練專區的米白金色）
const CC_PAL = {
  dark:  { ok: '#4ade80', mid: '#facc15', bad: '#f87171', warn: '#fb923c', quiet: '#6b7280', track: 'rgba(255,255,255,.09)', off: 'rgba(255,255,255,.08)', full: '#22a05a', late: '#3b82f6', none: '#d9534f' },
  light: { ok: '#3f9a68', mid: '#b8860b', bad: '#c45c5c', warn: '#d9772b', quiet: '#a39c8e', track: '#ece6d8', off: '#ece6d8', full: '#4a9e6f', late: '#4a7fbf', none: '#c45c5c' } };

function ccEnv(ctx) {
  const b = ctx.batch || {}, now = ctx.now || new Date(), today = ccDs(now);
  const yest = ccDs(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const coachById = {}; (ctx.coaches || []).forEach(c => { coachById[c.id] = c; });
  const isLearnC = c => !c || !c.track || c.track === 'learn';
  const actStart = b.action_open_date || b.start_date;
  const learnFrom = (() => { if (!b.study_end) return actStart; const d = new Date(b.study_end + 'T00:00:00'); do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 1); return ccDs(d); })();
  const stuActFrom = s => isLearnC(coachById[s.coach_id]) ? learnFrom : actStart;
  const logDays = {}; (ctx.allLogs || []).forEach(l => { (logDays[l.student_id] = logDays[l.student_id] || new Set()).add(l.log_date); });
  const cmids = ctx.coachMemberIds || new Set((ctx.coaches || []).map(c => c.member_id));
  const real = (ctx.students || []).filter(s => s.status === 'approved' && !cmids.has(s.member_id));
  return { b, now, today, yest, isLearnC, actStart, stuActFrom, logDays, real, hasHomework: !!b.study_start };
}

// 這位教練「要送出」的每一天（到昨天）：學習組只有平日、行動組天天（同教練頁 pendingSubmitDays）
function ccCoachDays(ctx, env, c) {
  const b = env.b, from = b.submit_from || b.start_date, out = [];
  if (!from) return out;
  const learn = env.isLearnC(c);
  for (let d = new Date(from + 'T00:00:00'); ccDs(d) < env.today; d.setDate(d.getDate() + 1)) {
    const ds = ccDs(d), w = d.getDay();
    if ((b.end_date && ds > b.end_date) || (learn && (w < 1 || w > 5))) continue;
    const dl = new Date(ds + 'T12:00:00'); dl.setDate(dl.getDate() + 1);
    const r = (ctx.submitRows || []).find(x => x.coach_id === c.id && x.log_date === ds);
    out.push({ ds, k: r ? (new Date(r.submitted_at) > dl ? 'late' : 'full') : env.now > dl ? 'none' : 'na', owe: !!r && r.unreplied > 0 });
  }
  return out;
}

// 每位帶組教練的組員累積數字（繳交／回覆／作業／行動），分母規則見 wiki 管理介面（2026-08-17／09-17）
function ccGroups(ctx, env) {
  const now = env.now, today = env.today, b = env.b, pct = (n, d) => d ? Math.round(n / d * 100) : 0;
  const isWd = ds => { const w = new Date(ds + 'T00:00:00').getDay(); return w >= 1 && w <= 5; };
  const coachDue = ds => { const dl = new Date(ds + 'T12:00:00'); dl.setDate(dl.getDate() + 1); return now > dl; };
  const wdList = [];
  if (b.start_date) for (let d = new Date(b.start_date + 'T00:00:00'); ccDs(d) < today; d.setDate(d.getDate() + 1)) { const ds = ccDs(d); if (isWd(ds)) wdList.push(ds); }
  const wd = wdList.length, cDays = new Set(wdList.filter(coachDue)), wdC = cDays.size;
  const aStart = env.actStart, awd = wdList.filter(ds => ds >= aStart).length;
  let taughtN = 0; if (typeof SCHEDULE !== 'undefined') Object.entries(SCHEDULE).forEach(([d, arr]) => { if (d <= today) taughtN += arr.length; });
  const stuAct = l => (l.name_list||0)+(l.meet||0)+(l.invite||0)*2+(l.present||0)*5+(l.seminar||0)*5+(l.ghosted||0)+(l.rejected||0)+(l.attended||0)*2+namePts(l);
  const eng = ctx.engRows || [], logs = ctx.allLogs || [], hw = ctx.hwRows || [];
  return (ctx.coaches || []).map(c => {
    const mine = (ctx.students || []).filter(s => s.status === 'approved' && !s.dropped_at && s.coach_id === c.id); if (!mine.length) return null;   // 退班的不算進分母（2026-11-15）
    const total = mine.length, learn = env.isLearnC(c), hasCourse = env.hasHomework && learn;
    const stus = mine.map(s => {
      const lg = logs.filter(l => l.student_id === s.id && isWd(l.log_date) && l.log_date >= aStart && l.log_date < today);
      const e = eng.filter(r => r.student_id === s.id && isWd(r.log_date) && r.log_date < today);
      return { s, sent: e.filter(r => r.homework === true).length, rep: e.filter(r => cDays.has(r.log_date) && ccDone(r)).length,
               judged: e.filter(r => r.homework !== null && r.homework !== undefined).length,
               hwFull: hw.filter(r => r.student_id === s.id && r.total > 0 && r.done >= r.total).length, logN: lg.length, pts: lg.reduce((a, l) => a + stuAct(l), 0) };
    });
    const sum = k => stus.reduce((a, x) => a + x[k], 0), days = ccCoachDays(ctx, env, c);
    return { c, mine, learn, hasCourse, stus, days, miss: days.filter(d => d.k === 'none').length, wd, wdC, awd, taughtN,
             hand: pct(sum('sent'), wd * total), reply: pct(sum('rep'), wdC * total), hw: hasCourse ? pct(sum('hwFull'), taughtN * total) : null, act: pct(sum('logN'), awd * total) };
  }).filter(Boolean).sort((a, z) => ccGroupIdx(a.c) - ccGroupIdx(z.c));
}

// 行動回報連續沒填幾天（算到昨天）→ { n, never }；行動還沒開始、或昨天有填 → null
function ccActGap(env, s, logDays, yest) {
  logDays = logDays || env.logDays; yest = yest || env.yest;
  const f = env.stuActFrom(s), has = logDays[s.id] || new Set();
  if (!f || f > yest || has.has(yest)) return null;
  let n = 0; for (let d = new Date(yest + 'T00:00:00'); ccDs(d) >= f && !has.has(ccDs(d)); d.setDate(d.getDate() - 1)) n++;
  return { n, never: ![...has].some(ds => ds >= f) };
}

// 💬 給教練的話（2026-11-19 Randoph 看過 14 位試跑定稿）。不接 AI——照資料套規則，打開就是最新的。
//   三段：① 肯定一件真的有做到的事 ② 教練自己要補的事（最多兩件）③ 學員每位只講一次最嚴重的＋這週最拚的一位。
//   稱呼一律「〇〇教練」（實戰班的稱呼是教練，不是老師）。
function ccMsg(ctx, env, g) {
  const c = g.c, learn = g.learn, ids = new Set(g.mine.map(s => s.id)), what = learn ? '作業' : '心得', cm = ctx.cm || {};
  const call = (n => (n.length >= 3 ? n.slice(1) : n) + '教練')(ccNm(c)), join = a => a.length <= 3 ? a.join('、') : a.slice(0, 3).join('、') + ` 等 ${a.length} 位`;
  const marked = new Set((ctx.engRows || []).filter(r => ids.has(r.student_id) && r.homework != null).map(r => r.log_date));
  const due = g.days.filter(d => d.k !== 'na'), miss = due.filter(d => d.k === 'none'), ok = due.filter(d => d.k === 'full').length;
  const markedNoSub = miss.filter(d => marked.has(d.ds)).length, lastMark = [...marked].sort().pop() || null;
  const sinceMark = lastMark ? due.filter(d => d.ds > lastMark).length : due.length;   // 最後一次標記之後，又過了幾個「該標的日子」
  const warn = g.mine.reduce((a, s) => a + ((cm[s.id] || {}).warn || 0), 0);
  const HOW = '標完組員後，滑到「👥 組員」頁最下面，按金色的「送出＋日期」那顆，系統才會算你完成。';
  const praise = !miss.length && ok === due.length ? '這期每天都準時送出，謝謝你！'
    : markedNoSub >= 2 ? `這期你有 ${marked.size} 天都進去幫組員標記，辛苦了！`
    : g.reply >= 80 ? '你回覆組員都很即時，謝謝你！' : '謝謝你這段時間的陪伴！';
  const todo = [];
  if (markedNoSub >= 2) todo.push(`只差最後一步：${HOW}目前有 ${markedNoSub} 天標了還沒送出。`);
  else if (miss.length) todo.push(`有 ${miss.length} 天沒有送出。${HOW}`);
  if (sinceMark >= 2) todo.push(`最近 ${sinceMark} 天還沒看到組員的標記，是不是比較忙？有空時幫忙補標一下。`);
  if (!todo.length && g.reply < 60) todo.push(`組員交了之後，記得回一句，現在回覆大約 ${g.reply}%，你的一句話對組員很重要。`);
  if (!todo.length && learn && warn) todo.push(`有 ${warn} 格標了已交、還沒逐題檢核，有空時幫忙點一下。`);
  const x3 = [], never = [], xs = [], gap = [];
  g.mine.forEach(s => { const x = (cm[s.id] || {}).x || 0, a = ccActGap(env, s), n = ccNm(s);
    if (x >= 3) x3.push(n); else if (a && a.never) never.push(n); else if (x) xs.push(n); else if (a && a.n >= 3) gap.push(`${n}（${a.n} 天）`); });
  const care = [];
  if (x3.length) care.push(`${join(x3)}已經 3 次沒交${what}`);
  if (never.length) care.push(`${join(never)}還沒開始填行動回報`);
  if (xs.length) care.push(`${join(xs)}這幾天${what}沒交`);
  if (gap.length) care.push(`${join(gap)}好幾天沒填行動`);
  const w0 = ccDs(new Date(env.now.getTime() - 7 * 86400000)), wk = {};
  (ctx.allLogs || []).forEach(l => { if (ids.has(l.student_id) && l.log_date > w0) wk[l.student_id] = (wk[l.student_id] || 0) + (l.meet||0)+(l.invite||0)*2+(l.present||0)*5+(l.seminar||0)*5+(l.ghosted||0)+(l.rejected||0)+(l.attended||0)*2+namePts(l); });
  const star = g.mine.filter(s => (wk[s.id] || 0) >= 30).sort((a, z) => wk[z.id] - wk[a.id])[0];
  const lines = [`${call}，${praise}`, ...todo];
  if (care.length) lines.push(`另外${care.join('；')}，再麻煩你關心一下 🙏`);
  if (star) lines.push(`${ccNm(star)}這週很拚（${wk[star.id]} 分），可以在群組公開鼓勵 💪`);
  if (lines.length === 1) lines.push('組員狀況都很好，繼續保持 💪');
  return lines.join('\n');
}

// 每位教練一張卡的資料。完成度＝送出／回覆／檢核各 1/3（2026-11-15）；<50 紅、50–79 黃、≥80 綠；完成度低的排前面，不帶組的排最後
function ccCards(ctx, env) {
  const byC = {}; ccGroups(ctx, env).forEach(g => { byC[g.c.id] = g; });
  const real = env.real.filter(s => !s.dropped_at), cm = ctx.cm || {}, cl = ctx.closes || [], pct = (n, d) => d ? Math.round(n / d * 100) : 100;
  const cards = (ctx.coaches || []).map(c => {
    const g = byC[c.id] || null, down = real.filter(s => s.sponsor_id === c.id || (s.track === 'lifetime' && s.coach_id === c.id));
    if (!g && !down.length) return null;
    const dIds = new Set(down.map(s => s.member_id)), dc = cl.filter(x => dIds.has(x.member_id) && x.verified !== false);
    const o = { direct: new Set(dc.filter(x => x.is_new === true && x.target_code).map(x => x.target_code)).size, org: dc.filter(x => x.is_org).length,
                pend: dc.filter(x => x.verified === null).length, x3: down.filter(s => ((cm[s.id] || {}).x || 0) >= 3).length };
    let t = null;
    if (g) {
      const due = g.days.filter(d => d.k !== 'na'), ok = due.filter(d => d.k === 'full').length;
      const cells = g.mine.reduce((a, s) => a + ((cm[s.id] || {}).days || []).filter(d => d.k !== 'na').length, 0), warn = g.mine.reduce((a, s) => a + ((cm[s.id] || {}).warn || 0), 0);
      t = { miss: g.miss, late: due.filter(d => d.k === 'late').length, owe: due.filter(d => d.k === 'full' && d.owe).length, warn, due: due.length, ok, cells,
            sub: pct(ok, due.length), reply: g.reply, chk: pct(cells - warn, cells) };
      t.score = Math.round((t.sub + t.reply + t.chk) / 3);
    }
    const lvl = t ? (t.score < 50 ? 'r' : t.score < 80 ? 'y' : 'g') : o.pend ? 'y' : 'g';
    const weak = t ? [[t.sub, t.miss ? `${t.miss} 天沒送出` : `逾時送出 ${t.late} 天`], [t.reply, t.reply < 50 ? `回覆只有 ${t.reply}%` : `回覆 ${t.reply}%`], [t.chk, `${t.warn} 格還沒檢核`]].filter(x => x[0] < 80).sort((a, z) => a[0] - z[0]).map(x => x[1]) : [];
    return { c, g, down, o, t, lvl, weak, msg: g ? ccMsg(ctx, env, g) : '' };
  }).filter(Boolean);
  return cards.sort((a, z) => (a.t ? a.t.score : 999) - (z.t ? z.t.score : 999) || ccGroupIdx(a.c) - ccGroupIdx(z.c));
}

// 一位學員一顆標籤：綠正常／橘有 ✕／紅 3 個 ✕ 以上／灰連續 2 天以上沒填行動
function ccDot(ctx, env, s, nameS, P) {
  P = P || CC_PAL.dark;
  const x = ((ctx.cm || {})[s.id] || {}).x || 0, g = ccActGap(env, s), quiet = g && (g.never || g.n >= 2);
  const col = x >= 3 ? P.bad : x ? P.warn : quiet ? P.quiet : P.ok, tag = x ? `✕${x}` : quiet ? (g.never ? '沒填' : g.n + '天') : '';
  return `<span class="gc-dot" style="border-color:${col}"><i style="background:${col}"></i>${nameS(s.id, ccNm(s))}${tag ? `<b style="color:${col === P.quiet ? 'var(--muted)' : col}">${tag}</b>` : ''}</span>`;
}

// 卡片 HTML。opt：nameS／nameC（名字怎麼畫）、copyIdx（有就畫「複製」）、me（教練自己看：「我帶的組」「我的組織」、口吻改給本人）、read（後台顯示已讀）
function ccCardHtml(x, ctx, env, opt) {
  opt = opt || {};
  const plain = (id, n) => n, nameS = opt.nameS || plain, nameC = opt.nameC || plain, me = !!opt.me;
  const P = CC_PAL[opt.theme] || CC_PAL.dark;
  const colOf = p => p >= 80 ? P.ok : p >= 50 ? P.mid : P.bad, md = ds => ds.slice(5).replace('-', '/');
  const STR = { full: [P.full, '✓'], late: [P.late, '遲'], none: [P.none, '✕'], na: [P.off, ''] }, ICO = { r: '🔴', y: '🟡', g: '✅' };
  const stat = (n, lab, hot) => `<div class="gc-st"><b style="color:${hot ? P.bad : n ? 'var(--white)' : 'var(--muted)'}">${n}</b><span>${lab}</span></div>`;
  const bar = (lab, p, txt) => `<div class="gc-b3"><span>${lab}</span><div><i style="width:${p}%;background:${colOf(p)}"></i></div><b style="color:${colOf(p)}">${p}%</b><em>${txt}</em></div>`;
  const pendTxt = me ? '筆報件待你審' : '筆報件待他審';
  const list = [...x.weak, x.o.pend ? `${x.o.pend} ${pendTxt}` : ''].filter(Boolean).join('、');
  const say = me ? (list ? (x.lvl === 'g' ? '這期大致都有做到，還可以補：' + list : '還要補：' + list) : (x.t ? '這期該做的都有做到，謝謝你！' : '組織目前沒有待辦'))
    : list ? (x.lvl === 'g' && x.t ? '大致都有做到，還可以補：' + list : list) : (x.t ? '該做的都有做到' : '不帶組，組織沒有待辦');
  const who = me ? '我' : '他', g = x.g, t = x.t;
  return `<div class="gc ${x.lvl}">
    <div><span class="gc-name">${nameC(x.c.id, ccNm(x.c))}</span><span class="gc-meta">${g ? `${x.c.group_name || '未分組'}・${ccTrack(x.c.track || 'learn')}` : '不帶組'}</span>${opt.read || ''}</div>
    <div class="gc-say">${ICO[x.lvl]} ${say}</div>`
    + (g ? `<div class="gc-lab">🎓 ${who}帶的組（${g.mine.length} 人）</div>
    <div style="display:flex;align-items:center;gap:14px">
      <div style="text-align:center"><div class="gc-ring" style="background:conic-gradient(${colOf(t.score)} ${t.score * 3.6}deg, ${P.track} 0)"><b style="color:${colOf(t.score)}">${t.score}%</b></div><div class="gc-lab" style="margin:4px 0 0">完成度</div></div>
      <div style="flex:1">${bar('送出', t.sub, `${t.ok}/${t.due} 天準時`)}${bar('回覆', t.reply, '學員有交的')}${bar('檢核', t.chk, t.warn ? `${t.warn} 格待確認` : '都確認了')}</div></div>
    <div class="gc-strip" title="每天有沒有送出">${g.days.map(d => `<i style="background:${STR[d.k][0]}" title="${md(d.ds)}">${STR[d.k][1]}</i>`).join('')}<span class="gc-lab" style="margin:0 0 0 6px;align-self:center">每天送出${t.owe ? `・送出時欠回 ${t.owe} 天` : ''}</span></div>
    <div class="gc-dots">${g.mine.map(s => ccDot(ctx, env, s, nameS, P)).join('')}</div>` : '')
    + `<div class="gc-org"><div class="gc-lab">🌱 ${who}的組織（選${who}當負責上線的 ${x.down.length} 人）</div>`
    + (x.down.length ? `<div class="gc-sts" style="margin-top:0">${stat(x.o.direct, '推薦新人', false)}${stat(x.o.org, '組織締結', false)}${stat(x.o.pend, `報件待${who}審`, x.o.pend > 0)}${stat(x.o.x3, '下線 3 個 ✕', x.o.x3 > 0)}</div>
      <div class="gc-dots">${x.down.map(s => ccDot(ctx, env, s, nameS, P)).join('')}</div>` : `<div class="gc-none">這一期沒有學員選${who}當負責上線</div>`)
    + `</div>`
    + (x.msg && opt.copyIdx !== undefined ? `<div class="gc-msg"><div class="gc-msg-hd"><span>💬 給教練的話</span><button class="btn-edit" onclick="copyCoachMsg(${opt.copyIdx})">📋 複製</button></div>`
      + `<div class="gc-msg-t">${ccEsc(x.msg).replace(/\n/g, '<br>')}</div></div>` : '')
    + `</div>`;
}

// ════════════════════════════════════════════
// 📋 教練專區「我的狀況」（2026-11-19 Randoph）
//   「教練卡要不要在教練專區就顯示，這樣我就不用一直提醒，一進去就是要看現況是什麼，點擊已閱讀才能後續操作」
//   →「一天只顯示一次」→ 每天第一次進教練專區（早上 05:00 換日）先跳出自己的教練卡＋給教練的話，
//     按「我知道了」才能操作，同時寫 coach_status_reads（後台教練卡顯示已讀時間）。同一天再進來不擋；頁首「📋 我的狀況」隨時可再看。
//   狀況好的教練也一樣要按（Randoph：「進入一定要點擊我知道才能進行下一步」）。不帶組的（總教練）不擋。
//   載入失敗一律放行，不把教練鎖在外面。
// ════════════════════════════════════════════
async function ccLoadForCoach(sb, batchId, coachId) {
  const one = async q => { const { data, error } = await q; if (error) throw error; return data || []; };
  const [bt, coaches, studs, subs] = await Promise.all([
    one(sb.from('batches').select('*').eq('id', batchId)),
    one(sb.from('batch_coaches').select('id, member_id, status, track, group_name, members_master(name)').eq('batch_id', batchId).eq('status', 'approved')),
    one(sb.from('batch_students').select('id, coach_id, sponsor_id, member_id, track, status, dropped_at, members_master(name)').eq('batch_id', batchId).eq('status', 'approved')
          .or(`coach_id.eq.${coachId},sponsor_id.eq.${coachId}`)),
    one(sb.from('coach_submits').select('coach_id, log_date, submitted_at, unreplied').eq('batch_id', batchId).eq('coach_id', coachId))]);
  const ids = studs.map(s => s.id), mids = studs.map(s => s.member_id).filter(Boolean);
  const none = Promise.resolve([]);
  const [eng, logs, hw, closes] = await Promise.all([
    ids.length ? one(sb.from('coach_engagement').select('student_id, log_date, homework, homework_replied').eq('batch_id', batchId).in('student_id', ids)) : none,
    ids.length ? one(sb.from('action_logs').select('*').eq('batch_id', batchId).in('student_id', ids)) : none,
    ids.length ? one(sb.from('homework_checks').select('student_id, unit_no, done, total').eq('batch_id', batchId).in('student_id', ids)) : none,
    mids.length ? one(sb.from('closing_records').select('member_id, is_new, is_org, target_code, verified').eq('batch_id', batchId).in('member_id', mids)) : none]);
  const cmids = new Set(coaches.map(c => c.member_id));
  const cm = await loadCommit(sb, batchId, studs.filter(s => s.coach_id && !cmids.has(s.member_id)).map(s => s.id));
  return { batch: bt[0] || {}, coaches, coachMemberIds: cmids, students: studs, engRows: eng, submitRows: subs, allLogs: logs, hwRows: hw, closes, cm, now: new Date() };
}

const CC_CSS = `.cc-ov{position:fixed;inset:0;z-index:9000;background:rgba(45,42,36,.45);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:18px 12px 40px;
  --white:#2d2a24;--muted:#8c8577;--gold:#b8960c;--gold-bd:#e8d9a8;font-family:'Noto Sans TC',sans-serif;color:#2d2a24}
.cc-box{width:100%;max-width:560px;background:#f7f5f0;border:1px solid #e8e2d6;border-radius:18px;padding:18px 16px 16px;box-shadow:0 12px 40px rgba(0,0,0,.18)}
.cc-top{font-size:19px;font-weight:800;color:var(--gold);margin-bottom:4px}  .cc-sub{font-size:12.5px;color:var(--muted);margin-bottom:12px}
.cc-ok{display:block;width:100%;margin-top:14px;padding:15px;border:none;border-radius:14px;background:#b8960c;color:#fff;font-size:17px;font-weight:800;font-family:inherit;cursor:pointer}
.cc-ov .gc-msg{margin:0 0 12px;padding:12px 14px;border-radius:12px;background:#fffaf0;border:1px dashed #e0c97a}
.cc-ov .gc-msg-hd{font-size:13px;font-weight:700;color:var(--gold);margin-bottom:6px}  .cc-ov .gc-msg-t{font-size:15px;line-height:1.8;color:var(--white)}
.cc-ov .gc{background:#fff;border:1px solid #e8e2d6;border-top:4px solid;border-radius:14px;padding:14px 14px;text-align:left;box-shadow:0 2px 12px rgba(0,0,0,.06)}
.cc-ov .gc.r{border-top-color:#c45c5c}  .cc-ov .gc.y{border-top-color:#d4a017}  .cc-ov .gc.g{border-top-color:#4a9e6f}
.cc-ov .gc.r .gc-say{color:#c45c5c}  .cc-ov .gc.y .gc-say{color:#b8860b}  .cc-ov .gc.g .gc-say{color:#3f9a68}
.cc-ov .gc-name{font-size:17px;font-weight:800;color:var(--white)}  .cc-ov .gc-meta{font-size:12px;color:var(--gold);margin-left:8px}  .cc-ov .gc-say{margin:6px 0 12px;font-size:14px;font-weight:700}
.cc-ov .gc-lab{font-size:11.5px;color:var(--muted);margin-bottom:6px}
.cc-ov .gc-ring{width:62px;height:62px;border-radius:50%;display:flex;align-items:center;justify-content:center}  .cc-ov .gc-ring b{width:46px;height:46px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800}
.cc-ov .gc-strip{display:flex;gap:3px;margin-top:8px;flex-wrap:wrap}  .cc-ov .gc-strip i{width:20px;height:20px;border-radius:5px;color:#fff;font-size:11px;font-weight:700;font-style:normal;display:flex;align-items:center;justify-content:center}
.cc-ov .gc-dots{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}  .cc-ov .gc-dot{font-size:12px;padding:3px 8px;border-radius:999px;background:#faf8f3;border:1px solid;color:var(--white)}  .cc-ov .gc-dot i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px}  .cc-ov .gc-dot b{margin-left:4px;font-weight:700}
.cc-ov .gc-b3{display:flex;align-items:center;gap:8px;margin:5px 0}  .cc-ov .gc-b3 span{flex:0 0 30px;font-size:12px;color:var(--muted)}  .cc-ov .gc-b3 div{flex:1;height:7px;border-radius:4px;background:#ece6d8}  .cc-ov .gc-b3 div i{display:block;height:7px;border-radius:4px}  .cc-ov .gc-b3 b{flex:0 0 38px;text-align:right;font-size:13px}  .cc-ov .gc-b3 em{flex:0 0 78px;font-style:normal;font-size:11px;color:var(--muted);white-space:nowrap}
.cc-ov .gc-sts{display:flex;gap:6px;margin-top:10px}  .cc-ov .gc-st{flex:1;text-align:center;padding:6px 2px;border-radius:8px;background:#faf8f3}  .cc-ov .gc-st b{display:block;font-size:18px;font-weight:800}  .cc-ov .gc-st span{font-size:10.5px;color:var(--muted)}
.cc-ov .gc-org{margin-top:14px;padding-top:12px;border-top:1px solid #efe9dd}  .cc-ov .gc-none{font-size:12.5px;color:var(--muted)}`;

let ccLast = null;   // 最近一次算好的「我的狀況」，頁首按鈕再開時直接用
async function ccGate(sb, batchId, coachId, force) {
  try {
    const rd = ccReadDate(new Date());
    if (!force) {
      const { data } = await sb.from('coach_status_reads').select('id').eq('batch_id', batchId).eq('coach_id', coachId).eq('read_date', rd).maybeSingle();
      if (data) return;                                   // 今天看過了：不擋
    }
    const ctx = await ccLoadForCoach(sb, batchId, coachId), env = ccEnv(ctx);
    const x = ccCards(ctx, env).find(k => k.c.id === coachId);
    if (!x || (!x.g && !force)) return;                   // 不帶組的不擋（頁首按鈕還是看得到組織）
    ccLast = { x, ctx, env };
    if (!document.getElementById('ccCss')) { const st = document.createElement('style'); st.id = 'ccCss'; st.textContent = CC_CSS; document.head.appendChild(st); }
    const ov = document.createElement('div'); ov.id = 'ccGate'; ov.className = 'cc-ov';
    const d = new Date(rd + 'T00:00:00'), when = `${d.getMonth() + 1}/${d.getDate()}`;
    ov.innerHTML = `<div class="cc-box"><div class="cc-top">📋 我的狀況</div><div class="cc-sub">${when} 早上 5 點更新・${force ? '隨時可以從頁首「📋 我的狀況」再看' : '看完按最下面「我知道了」就能開始'}</div>`
      + (x.msg ? `<div class="gc-msg"><div class="gc-msg-hd">💬 給你的話</div><div class="gc-msg-t">${ccEsc(x.msg).replace(/\n/g, '<br>')}</div></div>` : '')
      + ccCardHtml(x, ctx, env, { me: true, theme: 'light' })
      + `<button class="cc-ok" id="ccOk">${force ? '關閉' : '我知道了，開始今天的回報'}</button></div>`;
    document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    document.getElementById('ccOk').onclick = async () => {
      const btn = document.getElementById('ccOk'); btn.disabled = true;
      if (!force) {
        try { await sb.from('coach_status_reads').upsert({ batch_id: batchId, coach_id: coachId, read_date: rd, score: x.t ? x.t.score : null, read_at: new Date().toISOString() },
                                                         { onConflict: 'batch_id,coach_id,read_date' }); } catch (e) {}
      }
      ov.remove(); document.body.style.overflow = '';
    };
  } catch (e) { console.warn('我的狀況載入失敗（不擋教練）', e); }
}
