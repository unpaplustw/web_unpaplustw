// A Plus 天空之城（城堡版）的所有設定。加一個功能區＝在 TILES 加一筆（或把 reserved 改成 empty），不用改程式。
//
// spot：在城裡的位置，對應 scene.js 的 SPOTS
//   castle＝北邊的大城堡｜left＝城堡左側｜right＝城堡右側｜front＝城堡前方｜gate＝南邊城門上方｜plot＝城牆內的空地（用 angle 指定方位）
// rooms：建築裡的教室名牌（只是名牌，點了一樣開這一區的卡片）
// status：
//   full     精神之塔（點了開完整卡片）
//   empty    功能區（點了開小卡片，需要 line 與 link）
//   reserved 城牆內的預留空地（不能點，不進清單）；angle＝方位（0＝正前方、往右為正）

export const TILES = [
  { id: 'aplus',   name: 'APLUS城', status: 'full', spot: 'castle' },
  { id: 'academy', name: '環球致富學院', status: 'empty', spot: 'left', rooms: ['公司', '商品', '制度'],
    line: '自學平台，無期別、隨時進出，自己走。', link: '/academy/' },
  { id: 'lineai',  name: 'LINEAI 顧問',  status: 'empty', spot: 'right',
    line: 'AI 顧問系統。', link: '/lineai/' },
  { id: 'combat',  name: '實戰班',       status: 'empty', spot: 'front',
    line: '有教練陪跑的行動班。', link: '/npcombat/' },
  { id: 'stories', name: '英雄殿',       status: 'empty', spot: 'gate',
    line: '優秀會員的歷程。', link: '/heroes/' },

  { id: 'plot-e', status: 'reserved', angle: 72 },
  { id: 'radar',   name: '雷達站',       status: 'empty', spot: 'plot', angle: -72, landmark: 'radar',
    line: 'A Plus 夥伴的自媒體（整理中）。', link: '/radar/' },
  { id: 'health',  name: '健康檢查站',   status: 'empty', spot: 'plot', angle: 45, landmark: 'clinic',
    line: 'KC 抗氧化力檢測、全能查查。',
    links: [{ label: 'KC 抗氧化力檢測', href: '/kc/' }, { label: '全能查查', href: '/checker/' }] },
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
export const COMPANY = {
  id: 'company', name: '綠佳利島', line: '環貫綠佳利官方：官網、社群、APP、NDS、各地區沙龍、宣傳品下載。', link: '/company/',
  buildings: [
    { id: 'hq',     name: '公司總部',     kind: 'hq',      lon: 121.38, lat: 25.12, line: '環貫綠佳利總部：官方網站，以及各地區沙龍的地址與營業時間。', salons: true,
      links: [{ label: '前往官網', href: 'https://www.naturally-plus.com/tw/zh' }] },
    { id: 'social', name: '官方社群',     kind: 'screen',  lon: 121.50, lat: 23.95, line: '公司 Facebook、YouTube。',
      links: [{ label: 'Facebook', href: 'https://www.facebook.com/NaturallyPlusTW' }, { label: 'YouTube', href: 'https://youtube.com/c/NaturallyPlusTWNo1' }] },
    { id: 'app',    name: '綠佳利 APP',   kind: 'signal',  lon: 121.02, lat: 23.55, line: '環貫綠佳利 APP 下載。',
      links: [{ label: '下載 APP', href: 'http://cms.naturally-plus.com.tw/share/index.html' }] },
    { id: 'nds',    name: 'NDS 會員登錄', kind: 'gate',    lon: 120.95, lat: 24.62, line: 'NDS 會員系統登入。',
      links: [{ label: 'NDS 登入', href: 'https://nds.naturally-plus.com/login' }] },
    { id: 'docs',   name: '宣傳品資料館', kind: 'library', lon: 120.42, lat: 23.45, line: '各地區 DM、小冊子下載。',
      links: [{ label: '前往下載', href: '/company/#downloads' }] },
  ],
};
// ⏳ IG：公司台灣官網頁尾沒有 IG，等 Randoph 提供網址再加進 social

// 衛星：2026-11-06 拿掉（APP、NDS 搬到綠佳利島）
export const SATELLITES = [];


export const TOUR = ['這是 A Plus 天空之城', '點建築看內容', '最高的城堡是 APLUS城'];

// 衛星在進站或操作後繞行多久（毫秒），之後停住並停止重繪，下次操作再繼續。
export const ORBIT_AFTER_ACTIVITY_MS = 15000;
