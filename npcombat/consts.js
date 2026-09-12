// ─────────────────────────────────────────────────────────────
// 實戰班共用常數 —— 這裡是唯一正本
//
// 為什麼有這個檔（2026-09-12）：
//   admin.html 的 CFC 清單少了「李美潤」，而黃致豪的直屬 CFC 就是李美潤。
//   按他的「編輯」→ 下拉找不到對應 option → 一按儲存，值就被靜靜洗掉。
//   同一份清單在 register.html（教練報名表）與 admin.html 各寫一份，遲早漂移。
//
// 🔴 改任何一項只改這個檔。載入這個檔的頁面：
//    register.html（報名表單的選項）／admin.html（名冊、編輯、檢查清單）
//    coach-review.html（班別短碼與標籤）
//
// ⚠️ 課表不在這裡 —— 課表與作業題目在 units.js。
// ─────────────────────────────────────────────────────────────

// 🏅 最佳榮譽資格（公司的榮譽階級，教練報名時自填）
const RANK_OPTIONS = ['成就', '星鑽', '高峰', 'CFC'];

// 👑 直屬 CFC（教練屬於哪一個 CFC 單位；本人就是 CFC 時填自己那一組）
//    ⚠️ 新增／更名 CFC 一定要改這裡，兩個頁面會同時跟上。
const CFC_OPTIONS = [
  '李美潤',
  '顏麗玉、游天貴',
  '李芊嬅',
  '張隆熙',
  '林甘霖、楊牧潔',
  '蔡依儒、尤竣億',
  '林姍嬅、凌翊迅',
  '楊敬豪、林珊合',
];

// 📚 班別（28 期起三組）。🔴 班別掛在「組」上（batch_coaches.track），不是掛在學員身上
const TRACKS = { learn: '初階學習組', action: '進階行動組', elite: '高階精英組' };

// 班別的短標籤：名冊／配對頁的小徽章
const TRACK_TAG = { learn: '📚 學習', action: '🏃 行動', elite: '⚡ 精英' };

// 班別的單字短碼：教練指南的社群改名格式「28初/組別/學/姓名」
// （Randoph 2026-09-12 定：初、進、高）
const TRACK_ABBR = { learn: '初', action: '進', elite: '高' };

// 🏆 高階精英組席次上限，額滿即止（Randoph 定）
const ELITE_SEATS = 5;

// 組別名稱。🔴 期中不要改 —— 改了會讓既有教練的 group_name 對不上而顯示「未分組」，
//    要改得等該期跑完「實戰班結案匯出.py」之後。
const GROUPS = ['第一組', '第二組', '第三組', '第四組', '第五組', '第六組', '第七組', '第八組',
                '第九組', '第十組', '第十一組', '第十二組', '第十三組', '第十四組',
                '第十五組', '第十六組'];

// 下拉選單用：DB 存的值若不在清單裡（舊資料、清單改過），照樣列出來並標記，
// 不要讓它因為找不到 option 而在儲存時被洗掉。
function optionsWithCurrent(list, current) {
  const arr = current && !list.includes(current) ? [...list, current] : list;
  return arr.map(v => `<option value="${v}"${current === v ? ' selected' : ''}>`
    + `${v}${list.includes(v) ? '' : '（⚠️ 清單外）'}</option>`).join('');
}

// 單選按鈕用：register.html 的 .radio-option 版型，樣式與原本手寫的完全一致
function radioOptions(name, list) {
  return list.map(v =>
    `<label class="radio-option"><input type="radio" name="${name}" value="${v}">`
    + `<div class="radio-label">${v}</div></label>`).join('');
}
