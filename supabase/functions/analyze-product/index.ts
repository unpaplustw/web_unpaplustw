import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY') || '';
const CLAUDE_MODEL = 'claude-sonnet-4-6';   // 四刀核心攻擊，要準（舊 claude-sonnet-4-20250514 已下架，2026-06-18 改現役 Sonnet 4.6）
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';   // 法規教育/綠佳利建議：輔助、已去識別化、省錢
const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// ── 點數系統（跨專案：扣點在 Members DB）──
const MEMBERS_URL = Deno.env.get('MEMBERS_URL') || '';
const MEMBERS_SERVICE = Deno.env.get('MEMBERS_SERVICE_KEY') || '';
const LINE_CHANNEL_ID = '2009692859'; // LIFF idToken verify 的 client_id
const CHARGE = { product: 2, text_query: 2, image: 3 }; // 計費表（文字四刀2 / 拍照3），其餘免費

const FORMAT_RULES = `
## 輸出格式
每行一個 JSON 物件，★每個 JSON 必須在同一行（內容換行用 \n，不可真換行）：
{"type":"blade","blade":1,"title":"成分拆解","icon":"📊","content":"內容"}
{"type":"blade","blade":2,"title":"安全風險","icon":"⚠️","content":"內容"}
{"type":"blade","blade":3,"title":"法規檢視","icon":"📖","content":"內容"}
{"type":"blade","blade":4,"title":"廠商信任","icon":"🏭","content":"內容"}
{"type":"tags","tags":[{"name":"成分名","risk":"red","cas":""}]}
{"type":"badge","reviewed":false}
{"type":"verdict","content":"一句話真相總結"}
## content 排版
1. 每個分析點用「① 標題」開頭接一段；點之間 \n\n，同點內不同論點 \n
2. 重點用 **粗體**，禁止整段不換行
## Emoji：問題/風險→⚠️❗❌🚨；中性→🔍📌💡；絕對禁用 ✅
## 鐵則：語氣口語像業務員現場說話；不編造禁令或研究；製造商只用傳入真實資料(有就講、空白才說標示有限、禁止說不敢標示)；content禁出現「攻擊」改用「分析」「檢視」`;

const UNIFIED_PROMPT = `你是保健食品/藥品/化粧品競品分析專家兼綠佳利顧問。先判斷產品類別，再按「通識四層」分析。每層都要有具體內容，依類別填對應角度。★不論資料多寡，必須完整輸出四個 blade（blade 1~4），絕不省略。
★你的使命是揭穿CP值騙局：鐵律「好＋便宜＋有效」不可兼得，便宜必有代價(劣質原料/灌水/掩飾/跨國落差)。把被低價與包裝大字掩蓋的代價揪出來攤在陽光下，讓消費者知道「以為賺到、其實自己就是代價」。

## 先判類別（依商品名+成分判斷）
food=保健食品/一般食品、drug=藥品、cosmetic=化粧品、device=醫療器材

## 通識四層（固定四刀，標題與icon照下方，content依類別填）
① title=成分拆解 icon=📊（有什麼/怎麼排）
   food→排序暴露(添加物排前面=有效成分少)+灌水拆解(成分裡包成分)+原料形式(合成vs天然/吸收率)+劑型矛盾(脂溶性配無油劑型)＋成本透視(這售價用得起好料嗎？如葉黃素游離型vs酯化型原料成本差數倍，賣太便宜＝用劣質型或劑量灌水)＋劑量量化(標出有效成分實際劑量，對比國際建議攝取量RDA/上限UL，算給消費者看「要吃幾顆才夠量」=劑量灌水，或「吃幾顆就過量」=風險)
   drug→主成分、適應症
   cosmetic→成分組成、宣稱了什麼
② title=安全風險 icon=⚠️（成分危險＋★跨國標準落差，這是最強打法）
   ★主動比對台灣vs歐盟/日本/韓國標準，點出「他國已禁用或限更嚴、台灣卻放寬准用」之處——這是事實攻擊、零誹謗風險。如「二氧化鈦歐盟2022禁用於食品，台灣仍准用」
   food→添加物各國禁用落差+毒理(如反式脂肪/特定色素/防腐劑他國早禁)＋成分交互地雷(保健品成分互斥如鈣鐵鋅鎂競爭吸收、與藥物食物交互如紅麴×降膽固醇藥、魚油/銀杏/維E×抗凝血藥、葡萄柚×多種藥；守住不教唆停藥、有疑慮建議諮詢醫師藥師)
   drug→器官毒性+過量風險+藥藥交互(紅麴×statin)+食物地雷(葡萄柚×降壓藥、酒×鎮靜劑)
   cosmetic→禁用成分+成分超標+各國禁用落差
   ※跨國標準須是你確信的事實，不確定就標「據了解，實際請查證」，絕不可編造某國禁令(一查就被拆穿)
③ title=法規檢視 icon=📖（宣稱/標示合不合法）
   food→一般食品不得宣稱保健功效、健康食品才能宣稱13項(看有無小綠人)
   drug→適應症外有無誇大宣稱
   cosmetic→不得宣稱療效、不得宣稱促進膠原蛋白增生等改變生理機能
   ※依台灣食安法28條/化粧品衛生安全管理法10條/健康食品管理法。引用真實法規不編造，無明顯違法就說「標示尚符規範」
④ title=廠商信任 icon=🏭（廠商可不可信）
   製造商身份/規模/GMP、認證有無、代理商、字號
★自相矛盾打臉：若「產品宣稱的目的」與「實際成分」互打，重點點破。如葉黃素主打顧眼睛/專注力，卻加歐盟認定影響兒童專注力的色素——你花錢買的，正在抵消你要的效果。
★分析最後務必輸出一句「真相總結」verdict：用一句話收斂全部分析、點破「這個價格你買到的真相是什麼」，業務員可直接甩給客戶。

## 輸入資料
product_name/brand/regulatory_type/ingredients_raw/ingredients_detail/manufacturer/certifications/regulatory_detail
類別優先用傳入的 regulatory_type，沒有(拍照)才自己判斷。

## 最後輸出
food類輸出 {"type":"category","category":"multivitamin/single_nutrient/cell_repair/antioxidant/probiotics/beauty"}；其他類不輸出category
${FORMAT_RULES}`;

const CLAIM_PROMPT = `你是台灣食品/藥品/化粧品法規專家兼綠佳利業務顧問。業務員會貼上「對方(競品老師/直銷上線)說的一句宣稱話術」，你判定這句話在台灣合不合法，並給業務員當場能用的反擊話術。
## 判定依據
- 食品安全衛生管理法第28條：食品標示/宣傳/廣告不得不實誇張易生誤解，不得涉及醫療效能
- 化粧品衛生安全管理法第10條：化粧品不得醫療效能宣稱、不得宣稱促進膠原蛋白增生等改變生理機能
- 健康食品管理法：未取得健康食品認證(小綠人)不得宣稱13項保健功效；一般食品不得宣稱任何保健功效
## 違法類型：①醫療效能(治療/根治/預防疾病)②誇大不實(最有效/第一/100%)③生理機能(促進XX/排毒/調整體質)
## 輸出(單行JSON)
{"type":"claim","level":"red","verdict":"判定一句話","law":"依據哪條法規","counter":"給業務員的反擊話術"}
level：red=明確違法、yellow=灰色有風險、green=合法
## 規則：引用真實法規不編造條號；不確定判yellow；counter口語化像業務員現場回話、可帶向預防保健/綠佳利但不生硬推銷、守住不教唆停藥；counter換行用 \n`;

function buildSuggestPrompt(npList) {
  let products = '無可用產品資料';
  if (npList && npList.length) {
    products = npList.map(p => `【內部代號：${p.name}（${p.eng_name || ''}）｜角色：${p.health_role || ''}${p.is_star ? '，明星三樣' : ''}】\n- 定位：${p.tagline || ''}\n- 賣點：${p.selling_points || ''}\n- 對打競品：${p.vs_competitor || ''}`).join('\n\n');
  }
  return `你是資深預防保健顧問。根據第一段競品分析，組合「全方位六大保養面向」的最佳搭配建議——六塊缺一不可、每塊都要帶到（全公司商品全方位推薦）。

## 可用產品資料（僅供你內部理解產品與競品的對應關係；其中的產品名稱、品牌、商標一律不可寫進輸出）：
${products}

## ★★ 六大保養面向（每塊一個【固定 icon＋固定代號】，必須【逐字一致】使用——這是業務員與客戶之間的默契：客戶看到中性成分概念，業務員一看代號就秒懂是哪樣產品）
🥬 補營養：固定代號「綜合植化素」（可帶 葉黃素:玉米黃素 5:1、松樹皮與山桑子花青素）
💧 消除自由基：固定代號「高濃度氫水」（可帶 出廠 3.3ppm、能穿透血腦屏障、選擇性還原只中和有害自由基）
🧬 長細胞：固定代號「植萃多酚」（可帶 白藜蘆醇、葡萄籽 OPCs、橄欖葉多酚、大學研究團隊背書）
🌿 腸道保健：固定代號「五種膳食纖維＋5層包埋益生菌配方」（可帶 水溶性:非水溶性 3:1、能過胃酸到大腸定殖）
🫐 吃的美容：固定代號「多元莓果植化素飲」（可帶 貓爪藤皮萃取、液態吸收快 2 倍）
🧴 擦的護膚：固定代號「益生菌微生態護膚」（強調真正的美要從體內養）

★ 同一面向一律用同一個固定 icon＋固定代號，絕不可改寫成同義詞（例如一律寫「💧 高濃度氫水」，不可時而寫「含氫水」「氫水飲品」「水素水」）。措辭飄動就會破壞默契。

## ★★ 去識別化鐵則（違反即失敗，目的＝截圖出去也無法證明是綠佳利）
建議內容裡【絕對禁止】出現下列任何字眼：
- 品牌名與招牌詞：綠佳利、Naturally Plus、NP、健康三角、明星三樣
- 產品名：活美水素水、喚活、識霸明力多、普力活、妍漾、晨星，及其任何英文名／縮寫
- 註冊商標／專利名（含 ® 字樣）：如 Mirtogenol、碧容健、HIF1STEM、FloraGLO、S-Fiber、AC-11、Fibersol、Enovita 等一律不可出現
- 指向單一品牌的行銷標語：如「銷售15年第一」「熱銷N萬瓶」「連續7年金賞」「每3秒2人飲用」這類排名／銷量話術
- 特定大學／計畫／認證機構名稱：只可說「有大學研究團隊背書」「藥廠規格生產」，不可點名

## 輸出規則
1. 開場一句：先點出競品落在哪個保養面向、而且「只做了一半」（攻擊不必客氣）
2. 接著【六大面向逐塊都要帶到】，每塊獨立成一段、段首一律以「icon **固定代號**」開頭（icon 用上面指定的六個）：
   - 與競品同一面向那塊→講深：用固定代號＋成分規格數據正面對決，講清楚為何比這隻競品強
   - 其餘五塊→各一句白話帶過：點出競品沒補到、這塊為何不能少（全方位、缺一塊就是破口）
3. 收尾一句：六大面向是一套完整的預防保健，少一塊就是健康破口
4. 若競品是藥品：另強調「藥是治標、預防保健才是根本，讓身體不需要一直吃藥」
5. 若競品是擦的化粧品：另強調「擦再多只到表皮，真正的美從體內養」
6. 語氣口語化講故事，不列規格表
## ★ 輸出格式：一個JSON物件，整個在同一行：
{"type":"suggest","content":"建議內容"}
規則：六個面向各自獨立成段、段與段之間用 \n\n 隔開；每段段首一律「icon **固定代號**」；六塊都必須出現、缺一不可。`;
}

function extractJsonObjects(text) {
  const results = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      let depth = 0, inString = false, escape = false, j = i;
      for (; j < text.length; j++) {
        const ch = text[j];
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        if (ch === '}') { depth--; if (depth === 0) { j++; break; } }
      }
      if (depth === 0) {
        const raw = text.slice(i, j);
        let o = null;
        try { o = JSON.parse(raw); } catch (_e) {
          try { o = JSON.parse(raw.replace(/\r/g, '').replace(/\n/g, '\\n').replace(/\t/g, '\\t')); } catch (_e2) { o = null; }
        }
        if (o && typeof o === 'object' && o.type) results.push(o);
      }
      i = j;
    } else i++;
  }
  return results;
}

const SSE_HEADERS = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' };

// 用 SSE 回一個錯誤事件（前端讀 stream 才能顯示「點數不足」等友善訊息）
function sseError(message, code, remaining) {
  const enc = new TextEncoder();
  const ev = { type: 'error', code, message };
  if (remaining !== undefined) ev.remaining = remaining;
  const stream = new ReadableStream({ start(c) {
    c.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
    c.enqueue(enc.encode('data: [DONE]\n\n'));
    c.close();
  }});
  return new Response(stream, { headers: SSE_HEADERS });
}

// 驗證 LIFF idToken → 回傳可信 line userId(sub)，失敗回 null
let LAST_VERIFY_DEBUG = '';
async function verifyLineIdToken(idToken) {
  try {
    const body = new URLSearchParams({ id_token: idToken, client_id: LINE_CHANNEL_ID });
    const r = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const d = await r.json();
    LAST_VERIFY_DEBUG = 'http=' + r.status + ' body=' + JSON.stringify(d) + ' tokenLen=' + (idToken ? idToken.length : 0);
    if (!r.ok) return null;
    return d.sub || null;
  } catch (e) { LAST_VERIFY_DEBUG = 'exception=' + (e && e.message ? e.message : String(e)); return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: {
    'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization' }});
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const payload = await req.json();
    let systemPrompt = '';
    let userMessage = '';
    const messages = [];

    if (payload.type === 'product') {
      systemPrompt = UNIFIED_PROMPT;
      const detail = payload.regulatory_detail ? JSON.stringify(payload.regulatory_detail) : '無';
      const ingDetail = payload.ingredients_detail && payload.ingredients_detail.length > 0 ? JSON.stringify(payload.ingredients_detail, null, 2) : '無';
      userMessage = `分析這個產品：\n\n商品名：${payload.product_name}\n品牌/申請商：${payload.brand || '未知'}\n類別(regulatory_type)：${payload.regulatory_type || '請自行判斷'}\n劑型：${payload.dosage_form || '未知'}\n\n原始成分表：\n${payload.ingredients_raw || '無'}\n\n已拆解成分：\n${ingDetail}\n\n製造商：${payload.manufacturer ? JSON.stringify(payload.manufacturer) : '無'}\n認證：${payload.certifications ? JSON.stringify(payload.certifications) : '無'}\n官方登記資料：${detail}`;
      messages.push({ role: 'user', content: userMessage });
    } else if (payload.type === 'image') {
      systemPrompt = UNIFIED_PROMPT;
      userMessage = '這是一張產品成分表照片。先辨識成分表內容、自行判斷產品類別(食品/藥品/化粧品)，再按通識四層分析。★務必完整輸出全部四層blade（成分拆解/安全風險/法規檢視/廠商信任），不可省略任何一刀。★辨識成分時，tags裡每個成分盡量附上你知道的CAS號(cas欄位，如汞=7439-97-6)，不確定就留空字串，這用於比對政府禁用清單。';
      if (payload.image_base64) messages.push({ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: payload.image_base64 } }, { type: 'text', text: userMessage }] });
      else messages.push({ role: 'user', content: userMessage });
    } else if (payload.type === 'text_query') {
      systemPrompt = UNIFIED_PROMPT;
      userMessage = `業務員查詢「${payload.query}」，此商品未建檔（資料庫查無）。★務必完整輸出全部四層blade（成分拆解/安全風險/法規檢視/廠商信任），不可省略任何一刀。即使沒有官方成分表，也要依商品名與你的專業知識（同類成分常識、典型配方、該品類常見問題）盡力分析。唯有某層真的無從判斷，才在該層說「未建檔，建議拍攝成分表更精準」。`;
      messages.push({ role: 'user', content: userMessage });
    } else if (payload.type === 'np_suggest') {
      let npList = [];
      try {
        const sb = createClient(SB_URL, SB_SERVICE);
        const { data } = await sb.from('np_products').select('*').eq('status', 'active').order('sort_order');  // 全公司商品全推：六大面向都帶到（競品 category 由 userMessage 帶給模型判主打）
        npList = data || [];
      } catch (_e) { npList = []; }
      systemPrompt = buildSuggestPrompt(npList);
      userMessage = `競品名稱：${payload.product_name}\n競品類別：${payload.category || '未分類'}\n\n第一段分析結果：\n${payload.attack_summary}\n\n請依去識別化鐵則給出最佳搭配建議。`;
      messages.push({ role: 'user', content: userMessage });
    } else if (payload.type === 'claim_check') {
      systemPrompt = CLAIM_PROMPT;
      userMessage = `對方說的宣稱話術：「${payload.claim}」\n\n請判定合不合法、給依據與反擊話術。`;
      messages.push({ role: 'user', content: userMessage });
    } else {
      return new Response(JSON.stringify({ error: 'Unknown type' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }});
    }

    // ── 點數 gate（時序 A：跑 Claude 前先驗身份+查餘額）──
    // 向下相容：有帶 id_token 才走計費路徑；舊前端沒帶 → 維持原樣免費（待前端更新後再強制）
    const cost = CHARGE[payload.type] || 0;
    let chargeUser = null;
    const requestId = payload.request_id || null;
    if (cost > 0 && payload.id_token) {
      chargeUser = await verifyLineIdToken(payload.id_token);
      if (!chargeUser) return sseError('【除錯】' + LAST_VERIFY_DEBUG, 'auth');
      try {
        const mb = createClient(MEMBERS_URL, MEMBERS_SERVICE);
        const { data: mem, error } = await mb.from('members').select('ai_credits').eq('line_user_id', chargeUser).single();
        if (error || !mem) return sseError('查無會員資料', 'no_member');
        if ((mem.ai_credits || 0) < cost) return sseError(`點數不足（需 ${cost} 點，剩 ${mem.ai_credits || 0} 點）`, 'insufficient', mem.ai_credits || 0);
      } catch (_e) {
        return sseError('點數系統暫時無法使用，請稍後再試', 'credit_down');
      }
    }

    // model 分層：四刀核心用 Sonnet；法規教育(claim_check)／綠佳利建議(np_suggest) 用 Haiku 省錢
    const useModel = (payload.type === 'claim_check' || payload.type === 'np_suggest') ? HAIKU_MODEL : CLAUDE_MODEL;
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: useModel, max_tokens: 4096, system: systemPrompt, messages })
    });
    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return new Response(JSON.stringify({ error: err }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }});
    }
    const claudeData = await claudeRes.json();
    const content = claudeData.content?.[0]?.text || '';
    const tokenUsed = (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0);
    const jsonObjects = extractJsonObjects(content);

    let govHits = [];
    if (payload.type === 'image') {
      try {
        const casList = [];
        for (const o of jsonObjects) {
          if (o.type === 'tags' && Array.isArray(o.tags)) {
            for (const t of o.tags) { if (t && t.cas && String(t.cas).trim()) casList.push(String(t.cas).trim()); }
          }
        }
        if (casList.length) {
          const sb = createClient(SB_URL, SB_SERVICE);
          const { data } = await sb.rpc('match_cosmetic_by_cas', { cas_list: casList });
          if (data && data.length) govHits = data;
        }
      } catch (_e) { govHits = []; }
    }

    // ── Claude 成功後：寫 query_logs(含 token_used) + 扣點 ──
    let remaining = null;
    if (chargeUser && cost > 0) {
      // 1) 寫查詢紀錄（RAG DB），id=request_id 與扣點 ref_id 對齊
      try {
        const rag = createClient(SB_URL, SB_SERVICE);
        const logRow = {
          line_user_id: chargeUser,
          query_type: payload.type,
          query_input: payload.product_name || payload.query || 'image_upload',
          product_id: payload.product_id || null,
          token_used: tokenUsed
        };
        if (requestId) logRow.id = requestId;
        await rag.from('query_logs').insert(logRow);
      } catch (_e) { /* 紀錄失敗不擋使用者 */ }
      // 2) 扣點（Members DB），ref_id=request_id 冪等防重複
      try {
        const mb = createClient(MEMBERS_URL, MEMBERS_SERVICE);
        const reason = payload.type === 'image' ? '拍照辨識' : '品名四刀';
        const { data: ded } = await mb.rpc('deduct_credits', {
          p_user_id: chargeUser, p_amount: cost, p_source: 'checker', p_reason: reason, p_ref_id: requestId
        });
        if (ded && ded[0]) remaining = ded[0].remaining_credits;
      } catch (_e) { /* 扣點失敗：分析已產出，不回收（策略A 容忍） */ }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const obj of jsonObjects) controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        if (govHits.length) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'gov_hit', hits: govHits })}\n\n`));
        if (remaining !== null) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'credit', remaining })}\n\n`));
        controller.enqueue(encoder.encode(`data: {"type":"usage","tokens":${tokenUsed}}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });
    return new Response(stream, { headers: SSE_HEADERS });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }});
  }
});
