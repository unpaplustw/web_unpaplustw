// ─────────────────────────────────────────────────────────────
// 實戰班共用算分 —— 寫名字加分的唯一正本
//
// 2026-11-11 Randoph：「願意多填寫一點就可以多加一點分數」（不是沒寫就沒分）
//   認識／邀約／邀請（溝通本、說明會）有寫出是誰 → 每人次多 +1 分。基本分照舊，沒寫名字一分不少。
//   以寫的人數算，且不超過該行動的次數（邀約 3 次寫 2 個名字 → +2）。
//   名字存在 action_logs.names（{ meet:[contact id…], invite:[…], … }）；舊期沒有 names → 自然是 0。
//
// 🔴 載入這個檔的頁面：daily.html／coach-review.html／leaderboard.html／admin.html／cert.html
//    任何算行動分的地方都要加 namePts(log)，查 action_logs 時要帶 names 欄。
// ─────────────────────────────────────────────────────────────
const NAME_BONUS_KEYS = ['meet', 'invite', 'present', 'seminar'];
function nameOnlyPts(l) {   // 純「有寫出是誰」的加分（畫面上要單獨顯示時用）
  if (!l) return 0;
  const n = l.names || {};
  return NAME_BONUS_KEYS.reduce((s, k) => s + Math.min(Array.isArray(n[k]) ? n[k].length : 0, l[k] || 0), 0);
}
// 🔴 2026-11-12 Randoph：「邀約歸邀約，赴約歸赴約…我們是要養成邀約的習慣」「鼓勵邀約安排時間，如果當天有赴約就是 +1」
//   事先約好、到那天見到：赴約 +2。當天約當天就見到：赴約 +1。
//   當天見到的人記在 names.sameday（也在 names.attended 裡，attended 次數照算）。
//   各頁的赴約都寫成 attended ×2，所以當天見到的每位在這裡扣回 1 —— 各頁只要有加 namePts(log) 就自動對。
function sameDayCut(l) {
  if (!l) return 0;
  const n = l.names || {};
  return Math.min(Array.isArray(n.sameday) ? n.sameday.length : 0, l.attended || 0);
}
function attPts(l) { return l ? (l.attended || 0) * 2 - sameDayCut(l) : 0; }   // 赴約實得分（畫面上要單獨顯示時用）
function namePts(l) { return nameOnlyPts(l) - sameDayCut(l); }
