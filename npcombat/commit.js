// ─────────────────────────────────────────────────────────────
// ⭐ 自己的承諾（五格）—— daily.html（學員）與 coach-review.html（教練一覽表、🌱組織）共用
// 2026-11-12 Randoph：「出現五個小框，先呈現 5 個星星，如果缺交就變成 X」
//   「教練造成變成驚嘆號，教練補上就恢復」「其實是滿三點就退班，只是有個彈性」
//
//   ⭐ 正常
//   ✕ 教練已送出、那天沒交（算學員自己的；三點只算 ✕）
//   ❗ 教練造成的：過了隔天 12:00 還沒送出，或標了已交但沒逐題檢核 → 教練補上就恢復，不算點
//
//   一格一天，規則與教練頁一覽表 dayState()、後台一覽表 cellOf() 同一套：
//   逐題紀錄 > 教練標記 > 教練已送出沒標＝沒交 > 逾期沒送出＝教練未回報。
//   全部用現有紀錄即時算，不存資料庫。後台記點（給管理員看的數字）不走這裡。
// ─────────────────────────────────────────────────────────────
function commitDs(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function commitOver(ds) { const dl = new Date(ds + 'T12:00:00'); dl.setDate(dl.getDate() + 1); return new Date() > dl; }   // 已過隔天 12:00

// 一天的狀態：'ok' | 'x' | 'warn' | 'na'（還在期限內）
function commitCell(units, hwOf, eng, submitted, over) {
  const hw = eng ? eng.homework : null;
  if (units && units.length) {                       // 學習組排課日：看作業
    const recs = units.map(hwOf).filter(Boolean);
    if (recs.length === units.length) {              // 逐題都檢核了 → 以逐題為準
      const done = recs.reduce((a, r) => a + (r.done || 0), 0);
      return done > 0 ? 'ok' : 'x';                  // 交了一部分不算缺交
    }
    if (hw === true)  return over ? 'warn' : 'na';   // 標已交、還沒逐題檢核
    if (hw === false) return 'x';
    if (recs.some(r => (r.done || 0) > 0)) return 'ok';
    return submitted ? 'x' : over ? 'warn' : 'na';
  }
  if (hw === true)  return 'ok';                     // 心得日：看教練標記
  if (hw === false) return 'x';
  return submitted ? 'x' : over ? 'warn' : 'na';
}

// 一次算多位學員 → { 學員id: { x, warn, xDays:[], warnDays:[] } }；沒有教練的不算（回傳裡沒有他）
async function loadCommit(sb, batchId, ids) {
  const out = {}; ids = [...new Set((ids || []).filter(Boolean))];
  if (!ids.length) return out;
  const [{ data: b }, { data: ss }] = await Promise.all([
    sb.from('batches').select('start_date, submit_from').eq('id', batchId).maybeSingle(),
    sb.from('batch_students').select('id, coach_id, dropped_at').in('id', ids)]);
  const studs = (ss || []).filter(s => s.coach_id), from = b && (b.submit_from || b.start_date);
  if (!studs.length || !from) return out;
  const cids = [...new Set(studs.map(s => s.coach_id))], sids = studs.map(s => s.id);
  const [{ data: cs }, { data: eg }, { data: hw }, { data: sm }] = await Promise.all([
    sb.from('batch_coaches').select('id, track').in('id', cids),
    sb.from('coach_engagement').select('student_id, log_date, homework').eq('batch_id', batchId).in('student_id', sids),
    sb.from('homework_checks').select('student_id, unit_no, done, total').eq('batch_id', batchId).in('student_id', sids),
    sb.from('coach_submits').select('coach_id, log_date').eq('batch_id', batchId).in('coach_id', cids)]);
  const track = {}; (cs || []).forEach(c => { track[c.id] = c.track; });
  const engBy = {}; (eg || []).forEach(r => { engBy[r.student_id + '|' + r.log_date] = r; });
  const hwBy = {};  (hw || []).forEach(r => { hwBy[r.student_id + '|' + r.unit_no] = r; });
  const sub = new Set((sm || []).map(r => r.coach_id + '|' + r.log_date));
  const today = commitDs(new Date()), sched = typeof SCHEDULE !== 'undefined' ? SCHEDULE : {};
  studs.forEach(s => {
    const learn = !track[s.coach_id] || track[s.coach_id] === 'learn', r = { x: 0, warn: 0, xDays: [], warnDays: [] };
    for (let d = new Date(from + 'T00:00:00'); commitDs(d) <= today; d.setDate(d.getDate() + 1)) {
      const ds = commitDs(d), w = d.getDay();
      if (s.dropped_at && ds >= s.dropped_at) break;       // 退班日（含）之後不算
      if (learn && (w < 1 || w > 5)) continue;             // 學習組週末不用回報
      const k = commitCell(learn ? sched[ds] : null, u => hwBy[s.id + '|' + u], engBy[s.id + '|' + ds], sub.has(s.coach_id + '|' + ds), commitOver(ds));
      if (k === 'x') { r.x++; r.xDays.push(ds); } else if (k === 'warn') { r.warn++; r.warnDays.push(ds); }
    }
    out[s.id] = r;
  });
  return out;
}

const commitMd = ds => +ds.slice(5, 7) + '/' + +ds.slice(8);
// 五格：✕ 排前面、再來 ❗、其餘 ⭐。size：格子高度（學員 46、名單列 26）
function commitBoxes(c, size) {
  const h = size || 46, fs = Math.round(h * 0.52), x = Math.min(c.x, 5), w = Math.min(c.warn, 5 - x);
  const box = i => `<span style="flex:1;max-width:${h * 1.6}px;height:${h}px;border-radius:${Math.round(h / 4.5)}px;display:flex;align-items:center;justify-content:center;font-size:${fs}px;line-height:1;`
    + (i < x ? `background:#fee2e2;border:1.5px solid #ef4444;color:#dc2626;font-weight:800">✕`
     : i < x + w ? `background:#ffedd5;border:1.5px solid #fb923c;color:#ea580c;font-weight:800">❗`
     : `background:#fef9c3;border:1.5px solid #facc15">⭐`) + `</span>`;
  return `<div style="display:flex;gap:${h > 30 ? 8 : 4}px">${[0, 1, 2, 3, 4].map(box).join('')}</div>`;
}
// 學員頁的小卡
function commitCard(c) {
  const sub = c.x >= 3 ? `已缺交 ${c.x} 次・請主動跟教練聯絡` : c.x ? `已缺交 ${c.x} 次` : c.warn ? '' : '全勤，繼續保持';
  const lines = [];
  if (c.x)    lines.push(`✕ 沒交：${c.xDays.map(commitMd).join('、')}`);
  if (c.warn) lines.push(`❗ ${c.warnDays.map(commitMd).join('、')} 教練還沒確認，可以提醒教練；確認後就恢復 ⭐`);
  return `<div style="margin:10px 14px;padding:12px 14px;border-radius:14px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,.06)">`
    + `<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:#374151">自己的承諾　<small style="font-weight:400;color:${c.x >= 3 ? '#dc2626' : '#6b7280'}">${sub}</small></div>`
    + commitBoxes(c) + (lines.length ? `<div style="margin-top:8px;font-size:12.5px;line-height:1.6;color:#6b7280">${lines.join('<br>')}</div>` : '') + `</div>`;
}
// 教練／上線名單列用：小五格＋小字。warnLabel：教練看是「待你確認」、上線看是「教練未確認」
function commitNote(c, warnLabel) { return [c.x ? `缺交 ${c.x}` : '', c.warn ? `${warnLabel} ${c.warn}` : ''].filter(Boolean).join('・'); }
function commitRow(c, warnLabel) {
  const n = commitNote(c, warnLabel);
  return `<div style="display:flex;align-items:center;gap:8px"><div style="flex:0 0 150px">${commitBoxes(c, 24)}</div>`
    + `<small style="white-space:nowrap;font-size:12px;color:${c.x >= 3 ? '#dc2626' : '#6b7280'};font-weight:${c.x >= 3 ? 700 : 400}">${n || '全勤'}</small></div>`;
}
// 教練頁一覽表上方：整組一張卡，缺交多的排前面。rows = [{ name, c }]
function commitList(rows, warnLabel) {
  rows = rows.filter(r => r.c).sort((a, b) => b.c.x - a.c.x || b.c.warn - a.c.warn);
  if (!rows.length) return '';
  return `<div style="margin:0 0 12px;padding:12px 14px;border-radius:14px;background:#fff;border:1px solid #e5e7eb">`
    + `<div style="font-size:14px;font-weight:700;margin-bottom:4px;color:#374151">⭐ 自己的承諾　<small style="font-weight:400;color:#6b7280">學員自己的頁面也看得到這五格</small></div>`
    + `<div style="font-size:12px;color:#6b7280;margin-bottom:8px;line-height:1.5">✕ 你已送出、那天沒交（三個就要注意）　❗ 等你回報或逐題檢核，補上就恢復 ⭐</div>`
    + rows.map(r => `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid #f3f4f6"><b style="flex:0 0 5em;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.name}</b>${commitRow(r.c, warnLabel)}</div>`).join('') + `</div>`;
}
