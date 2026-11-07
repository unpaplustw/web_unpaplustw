// A Plus 天空之城（城堡版）的所有設定。加一個功能區＝在 TILES 加一筆（或把 reserved 改成 empty），不用改程式。
//
// spot：在城裡的位置，對應 scene.js 的 SPOTS
//   castle＝北邊的大城堡｜left＝城堡左側｜right＝城堡右側｜front＝城堡前方｜gate＝南邊城門上方｜plot＝城牆內的空地（用 angle 指定方位）｜checkpoint＝城門前方的小島（檢查哨）
// rooms：建築裡的教室名牌（只是名牌，點了一樣開這一區的卡片）
// status：
//   full     精神之塔（點了開完整卡片）
//   empty    功能區（點了開小卡片，需要 line 與 link）
//   reserved 城牆內的預留空地（不能點，不進清單）；angle＝方位（0＝正前方、往右為正）

// 卡片文案：hook＝第一句勾子（粗體），line＝說明，cta＝按鈕字（沒寫就是「前往」）。2026-11-06 Randoph 定稿
export const TILES = [
  { id: 'aplus',   name: 'APLUS城', status: 'full', spot: 'castle',
    hook: 'A Plus 從 2004 年走到今天的地方。', line: '系統怎麼來、誰在帶路、守什麼規矩、做過哪些事，都在這裡。' },
  { id: 'academy', name: '環球致富學院', status: 'empty', spot: 'left',
    hook: '把「不知道下一步該做什麼」，變成照著修就會的學分。',
    line: '21 個學分、46 個單元，每堂都有影片和作業。沒有開課日、沒有排行榜，照自己的節奏走。用 LINE 申請，審核通常 1～2 天，不用付費。',
    cta: '看課程目錄', link: '/academy/' },
  { id: 'lineai',  name: 'LINEAI 顧問',  status: 'empty', spot: 'right',
    hook: '不用等領袖有空，24 小時隨時問。',
    line: '領袖多年的實戰經驗都寫進了 AI 知識庫。遇到客人說太貴、不知道怎麼回，問一句，AI 就調出最相關的經驗回答你。',
    cta: '認識 AI 顧問', link: '/lineai/' },
  { id: 'combat',  name: '實戰班',       status: 'empty', spot: 'front',
    hook: '一個人玩不是玩，一群人玩才是玩。',
    line: '4 週、有教練帶的行動班，學完馬上做。每期的開班時間和報名費，以招生頁為準。',
    cta: '看這期招生', link: '/npcombat/' },
  { id: 'stories', name: '凱旋門',       status: 'empty', spot: 'gate',
    hook: '每一位，都曾是和你一樣的普通人。',
    line: '家庭主婦、補教老師、美髮店老闆、退休校長⋯⋯看他們怎麼從原本的生活，走到現在的成績。',
    cta: '看他們的故事', link: '/heroes/' },
  { id: 'health',  name: '健康檢查站',   status: 'empty', spot: 'checkpoint', landmark: 'clinic',
    hook: '你的抗氧化力還剩多少？18 秒測得出來。',
    line: 'KC 用光照一下皮膚就有數字；全能查查幫你查商品成分和字號真偽，為家人把關（要用 LINE 登入）。',
    links: [{ label: '測抗氧化力', href: '/kc/' }, { label: '查商品成分', href: '/checker/' }] },

  { id: 'plot-e', status: 'reserved', angle: 72 },
  { id: 'plot-w', status: 'reserved', angle: -72 },   // 2026-11-06 雷達站拿掉（自媒體有內容再放回：spot: 'plot', landmark: 'radar', link: '/radar/'）
];

// 地區沙龍：資料集中在綠佳利島的「公司總部」卡片（島上不再一間間蓋，太擠）。
// salon：名牌；source：island/data/service.txt 裡的標題，地址與營業時間由此對應。
export const PORTS = [
  { id: 'taipei',    name: '台北總公司', salon: '台北總公司', lon: 121.52, lat: 25.04, source: '台北總公司／台北服務中心' },
  { id: 'yilan',     name: '宜蘭',       salon: '宜蘭沙龍',   lon: 121.75, lat: 24.75, source: '宜蘭服務中心' },
  { id: 'zhongli',   name: '中壢',       salon: '中壢沙龍',   lon: 121.22, lat: 24.96, source: '中壢服務中心' },
  { id: 'taichung',  name: '台中',       salon: '台中沙龍',   lon: 120.67, lat: 24.15, source: '台中服務中心' },
  { id: 'tainan',    name: '台南',       salon: '台南沙龍',   lon: 120.20, lat: 22.99, source: '台南服務中心' },
  { id: 'kaohsiung', name: '高雄',       salon: '高雄沙龍',   lon: 120.30, lat: 22.63, source: '高雄服務中心' },
];

// 綠佳利島（公司）：A Plus 天空之城右邊的另一座島，放所有「公司官方」的東西。
// 島面＝台灣輪廓；建築用 lon／lat 擺位置。links＝卡片裡的按鈕；salons: true＝卡片下方列出各地區沙龍。
// 能按的地標全部放在西部平原（NDS 在吊橋上岸處）；東半邊留給中央山脈與海岸山脈。
export const COMPANY = {
  id: 'company', name: '綠佳利島', link: '/company/', cta: '進入綠佳利島',
  hook: '環貫綠佳利的官方世界，一次找齊。', line: '官網、社群、APP、會員系統、全台服務中心、各地區宣傳品，都在這座島上。',
  buildings: [
    { id: 'hq',     name: '公司總部',     kind: 'hq',      lon: 121.22, lat: 24.95, salons: true,
      hook: '台灣總部就在台北車站前的新光摩天大樓。', line: '下面有全台 6 個服務中心的地址和營業時間，出門前先看一下。',
      links: [{ label: '前往官網', href: 'https://www.naturally-plus.com/tw/zh' }] },
    { id: 'social', name: '官方社群',     kind: 'screen',  lon: 120.82, lat: 24.55,
      hook: '公司官方的 Facebook 和 YouTube 頻道。',
      links: [{ label: 'Facebook', href: 'https://www.facebook.com/NaturallyPlusTW' }, { label: 'YouTube', href: 'https://youtube.com/c/NaturallyPlusTWNo1' }] },
    { id: 'app',    name: '綠佳利 APP',   kind: 'signal',  lon: 120.36, lat: 23.70,
      hook: '最好康的優惠、最即時的動態，一手掌握不漏接。', line: '公司不定期在 APP 上推出優惠活動。',
      links: [{ label: '下載 APP', href: 'http://cms.naturally-plus.com.tw/share/index.html' }] },
    { id: 'nds',    name: 'NDS 會員登錄', kind: 'gate',    lon: 120.50, lat: 24.16,
      hook: '已經是會員？登入 NDS 看自己的資料。', line: '獎金、點數、組織，都在會員系統裡。',
      links: [{ label: '登入 NDS', href: 'https://nds.naturally-plus.com/login' }] },
    { id: 'docs',   name: '宣傳品資料館', kind: 'library', lon: 120.28, lat: 23.22,
      hook: '8 個地區、59 份官方 DM 和小冊子。', line: '要分享給朋友之前，先來這裡下載正確的版本。',
      links: [{ label: '下載宣傳品', href: '/company/#downloads' }] },
  ],
};
// ⏳ IG：公司台灣官網頁尾沒有 IG，等 Randoph 提供網址再加進 social

// 衛星：2026-11-06 拿掉（APP、NDS 搬到綠佳利島）
export const SATELLITES = [];


export const TOUR = ['這是 A Plus 天空之城', '點建築看內容', '最高的城堡是 APLUS城'];

// 衛星在進站或操作後繞行多久（毫秒），之後停住並停止重繪，下次操作再繼續。
export const ORBIT_AFTER_ACTIVITY_MS = 15000;

// 首頁會員入口（右上角）。liffId 空白＝還沒建好，按鈕不顯示（預覽：網址加 #preview-member=none｜0｜1）
// 首頁 LIFF：「總會員中心」，在 LINE Developers 的「np-aplus › 會員中心」頻道底下
export const MEMBER = {
  liffId: '2009692859-h2XfVyCT',   // 「總會員中心」LIFF（Endpoint https://unpaplus.com.tw/，2026-11-08 Randoph 建）
  hubLiffId: '2009692859-9mE2Ymmb',   // 會員中心（註冊／我的會員卡）
  liffSdk: 'https://static.line-scdn.net/liff/edge/2/sdk.js',
};
