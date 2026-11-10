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
function namePts(l) {
  if (!l) return 0;
  const n = l.names || {};
  return NAME_BONUS_KEYS.reduce((s, k) => s + Math.min(Array.isArray(n[k]) ? n[k].length : 0, l[k] || 0), 0);
}
