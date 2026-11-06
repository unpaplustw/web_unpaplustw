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
    line: '宣傳品下載、官方連結、自媒體。', link: '/radar/' },
  { id: 'health',  name: '健康檢查站',   status: 'empty', spot: 'plot', angle: 45, landmark: 'clinic',
    line: 'KC 抗氧化力檢測、全能查查。',
    links: [{ label: 'KC 抗氧化力檢測', href: '/kc/' }, { label: '全能查查', href: '/checker/' }] },
];

// 地區沙龍：蓋在城牆上的沙龍塔。angle＝在城牆上的方位（度，0＝正前方城門、往右為正；後方 ±40° 是山，不放）
// salon：塔上的名牌；source：island/data/service.txt 裡的標題，地址與營業時間由此對應。
export const PORTS = [
  { id: 'taipei',    name: '台北總公司', salon: '台北總公司', angle: 135,  source: '台北總公司／台北服務中心' },
  { id: 'yilan',     name: '宜蘭',       salon: '宜蘭沙龍',   angle: 100,  source: '宜蘭服務中心' },
  { id: 'zhongli',   name: '中壢',       salon: '中壢沙龍',   angle: -135, source: '中壢服務中心' },
  { id: 'taichung',  name: '台中',       salon: '台中沙龍',   angle: -105, source: '台中服務中心' },
  { id: 'tainan',    name: '台南',       salon: '台南沙龍',   angle: -75,  source: '台南服務中心' },
  { id: 'kaohsiung', name: '高雄',       salon: '高雄沙龍',   angle: -45,  source: '高雄服務中心' },
];

export const SATELLITES = [
  { id: 'app', name: '環貫綠佳利 APP', link: 'http://cms.naturally-plus.com.tw/share/index.html', phase: 0.6 },
  { id: 'nds', name: 'NDS 會員登錄',   link: 'https://nds.naturally-plus.com/login', phase: 3.74 },
];

export const TOUR = ['這是 A Plus 天空之城', '點建築看內容', '最高的城堡是 APLUS城'];

// 衛星在進站或操作後繞行多久（毫秒），之後停住並停止重繪，下次操作再繼續。
export const ORBIT_AFTER_ACTIVITY_MS = 15000;
