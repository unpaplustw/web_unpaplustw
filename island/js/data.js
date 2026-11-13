// A Plus 系統首頁（城堡版）的所有設定。加一個功能區＝在 TILES 加一筆（或把 reserved 改成 empty），不用改程式。
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
    hook: '新人第一站：17 堂課，帶你從零走一遍。',
    line: '每堂都有影片和練習題。沒有開課日、沒有排行榜，照自己的節奏走。綠佳利會員用 LINE 登入就能看，不用申請、不用付費。',
    cta: '看 17 堂課', link: '/academy/' },
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

  { id: 'party',   name: '活動廣場',     status: 'empty', spot: 'plot', landmark: 'stage', angle: 72,
    hook: '上課一起玩的對抗賽。',
    line: '按一下，抽一題最常被問到的問題。各隊搶著回答，答得好就加分。',
    cta: '開始對抗賽', link: '/party/' },

  { id: 'sutra',   name: '藏經閣',       status: 'empty', spot: 'plot', landmark: 'pagoda', angle: -72,
    hook: '心法都收在這裡。',
    line: '要背的內容放這裡，打開就能照著念。綠佳利會員用 LINE 登入就能看。',
    cta: '進藏經閣', link: '/sutra/' },
  // 城牆內兩塊空地都用掉了（72＝活動廣場、-72＝藏經閣）。雷達站 2026-11-06 拿掉，自媒體有內容要放回時得另外開空地（landmark: 'radar', link: '/radar/'）
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

// 綠佳利島（公司）：A Plus 系統首頁右邊的另一座島，放所有「公司官方」的東西。
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

// 獎勵旅遊島：A Plus 系統首頁左邊的另一座島（機場），公布公司的獎勵旅遊。全部公開、不用登入。
// 島上兩個能按的地方：航廈＝即將出發（現在能挑戰的＋快出發的）、地球儀＝已出發（去過的地方）。x／z＝島上的位置。
// 首頁卡片兩邊都是航班看板（時間／目的地／活動／狀態），一趟一列。
// 即將出發的每一列點進去是獨立頁面 /travel/?t=<id>，rows（辦法細節）只在那一頁出現；已出發的不能點，note 直接列在那一列底下。
// 要更新：出發了，就把 trips 那一筆搬到 past（留 when／name／where／note 四欄）；
// 有新活動，在 trips 最前面加一筆（id＝網址用的英文代號、不能重複；when／where＝看板上的時間、目的地，寫短的）。
// 公司辦的：內容一律照展翅月刊原文（src 記期別），月刊沒寫的欄位不要自己補；rows 沒寫的欄位就不顯示。
// 團隊自己辦的：照團隊的報名網頁，只放日期、航班、費用、報名截止這幾項，行程／訂金／取消規定不抄（留在報名網頁，那邊才是正本）；
//   cta＝登機證頁最底下的大按鈕（連到報名網頁）、disclaimer＝頁尾那句但書（沒寫就是「辦法以公司公告為準。」）。
//   code＝登機證頁最上面那行小字（沒寫就是「BOARDING PASS・獎勵旅遊」；團隊辦的寫主辦，例：釜山團「BOARDING PASS・環貫綠佳利 · 奔馳」）。
//   guide＝有加碼活動時多一顆「攻略」按鈕（label／sub＝按鈕上兩行字、href＝攻略頁，每個活動一頁，放在 /travel/<代號>/）。
export const TRAVEL = {
  id: 'travel', name: '獎勵旅遊島',
  hook: '達到分數，公司招待你去。',
  line: '這裡公布現在可以挑戰的獎勵旅遊，還有伙伴們已經去過的地方。辦法以公司公告為準。',
  points: [
    { id: 'travel-now', name: '即將出發', kind: 'terminal', x: 2.4, z: 6.0,
      hook: '現在還能挑戰的、快要出發的，都在這裡。',
      trips: [
        { id: 'busan-2027', name: '冬季戀歌 釜山五日浪漫之旅', code: 'BOARDING PASS・環貫綠佳利 · 奔馳', when: '2027 年 1 月 7～11 日', where: '韓國釜山', badge: '報名中', open: true,
          rows: [
            ['什麼時候', '2027/1/7（四）～1/11（一），五日'],
            ['航空公司', '釜山航空'],
            ['台北出發（桃園機場）', ['去程 BX572：桃園 13:30 → 釜山 16:55', '回程 BX575：釜山 15:00 → 桃園 16:40']],
            ['高雄出發（小港機場）', ['去程 BX586：高雄 15:00 → 釜山 18:25', '回程 BX585：釜山 12:00 → 高雄 14:00']],
            ['費用', '每人 NT$24,600（含導遊、領隊服務費）'],
            ['報名截止', '2026/11/23'],
          ],
          cta: { label: '看完整行程與報名', href: 'https://script.google.com/macros/s/AKfycbxXGd5Zq5g9DbSKjsRB_Qlpzo-_-mzGtha2-9qJCstfldYcZpey90pRJV2MFIJ_GzQT/exec' },
          guide: { label: '奔馳獨家加碼獎勵', sub: '趕緊來瞧瞧', href: '/travel/busan-guide/' },   // 按鈕文字 2026-11-13 Randoph 定：不要寫複雜的語言
          disclaimer: '航班以正式開票資料為準，費用以旅行社確認為準。',
          src: '奔馳報名網頁（2026/11/12 讀取）' },
        { id: 'festa-2027', name: 'GO TO FESTA 2027', when: '2027 年 10 月前後', where: '日本', badge: '挑戰中', open: true,
          rows: [
          ['去哪裡', '日本 FESTA 世界年會'],
          ['包含什麼', '機票、住宿、公司、工廠、年會、晚宴'],
            ['什麼時候', '五天四夜，預計 2027 年 10 月前後'],
            ['挑戰期間', '2026/9/1（二）～2027/2/28（日）'],
            ['怎麼達成', ['2,500 分：全額招待 1 名', '1,500 分：團費補助 30,000 元', '800 分：團費補助 15,000 元']],
            ['分數怎麼來', '推薦創業方案（含 BC）入會，介紹人得分。達成名額沒有上限'],
            ['誰可以挑戰', '介紹人要是「自主創業+Club」成員'],
          ],
          src: '展翅月刊 2026 年 11 月號封底' },
      ] },
    { id: 'travel-past', name: '已出發', kind: 'globe', x: 5.6, z: -6.2,
      hook: '這些地方，伙伴們已經去過了。',
      past: [
        { when: '2026 年 11 月', name: '自主創業家集合 × THE WESTIN', where: 'The Westin（國內）', note: '三天兩夜國內研修' },
        { when: '2026 年 10 月', name: 'GO TO FESTA 2026', where: '日本橫濱', note: '世界年會、總公司參訪、山梨工廠、榮耀晚宴' },
        { when: '2026 年 3 月', name: 'Growing Together', where: '日本北海道', note: '五天四夜，搭網走破冰船' },
        { when: '2024 年', name: 'WLI 環球領袖研討會', where: '美國拉斯維加斯', note: '和美國綠加利 10 週年年會一起辦' },
        { when: '2019 年', name: 'GO GO Hawaii', where: '美國洛杉磯、夏威夷', note: '台灣近 100 人達成' },
        { when: '2019 年 1 月', name: 'TLI 頂尖領袖研討會', where: '法國巴黎', note: '200 多位達成' },
        { when: '2018 年 5 月', name: 'Go Go 北海道', where: '日本北海道', note: '為期 5 天' },
        { when: '2018 年 3 月', name: 'Go Go 民丹島', where: '民丹島', note: '約 1,100 位達成' },
        { when: '2017 年 11 月', name: 'TLI 頂尖領袖研討會', where: '杜拜', note: '八天七夜，台灣、香港、韓國近 300 位' },
        { when: '2017 年', name: 'Go Go 瓏山林', where: '蘇澳冷熱泉度假飯店（國內）' },
        { when: '2016 年 11 月', name: 'TLI 頂尖領袖研討會', where: '關島', note: '第一屆 TLI，6 天' },
        { when: '2016 年 9～10 月', name: 'GO GO JAPAN', where: '日本', note: '研修參訪團，分梯出發' },
        { when: '2010～2015 年', name: 'WLI 環球領袖研討會', where: '澳洲、普吉島、拉斯維加斯、夏威夷、墨西哥、雪梨', note: '2015 年在雪梨歌劇院，全球 1,700 多位伙伴' },
      ] },
  ],
};

// 衛星：2026-11-06 拿掉（APP、NDS 搬到綠佳利島）
export const SATELLITES = [];


export const TOUR = ['這是 A Plus 系統', '點建築看內容', '最高的城堡是 APLUS城'];

// 衛星在進站或操作後繞行多久（毫秒），之後停住並停止重繪，下次操作再繼續。
export const ORBIT_AFTER_ACTIVITY_MS = 15000;

// 首頁會員入口（右上角）。liffId 空白＝還沒建好，按鈕不顯示（預覽：網址加 #preview-member=none｜0｜pending｜rejected｜1）
// 首頁 LIFF：「總會員中心」，在 LINE Developers 的「np-aplus › 會員中心」頻道底下
export const MEMBER = {
  liffId: '2009692859-h2XfVyCT',   // 「總會員中心」LIFF（Endpoint https://unpaplus.com.tw/，2026-11-08 Randoph 建）
  liffSdk: 'https://static.line-scdn.net/liff/edge/2/sdk.js',
};
