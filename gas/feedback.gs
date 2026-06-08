/**
 * 保健食品查詢（健康查查）— 回饋機制 GAS Web App
 * ----------------------------------------------------------------------
 * 流程：
 *   業務員前端拍成分表 → doPost 存照片到 Drive + 寫一列 Sheet(狀態=待審)
 *   → 你在 Sheet「狀態」欄填「核可」
 *   → onApprovalEdit 觸發 → 呼叫 Supabase grant_credits 加 5 點
 *   → 「加點狀態」欄記結果，防重複加點
 *
 * 【設定】Apps Script → 專案設定(齒輪) → 指令碼屬性，新增四個：
 *   SHEET_ID            = 試算表 ID（網址 /d/ 後、/edit 前那段）
 *   DRIVE_FOLDER_ID     = 存照片的 Drive 資料夾 ID（資料夾網址 /folders/ 後那段）
 *   MEMBERS_URL         = https://nsgqsopqlkhayuefdout.supabase.co
 *   MEMBERS_SERVICE_KEY = Members 專案 service_role key（見 Supabase Dashboard，勿外流）
 *
 * 【Sheet 標頭】不用手動建！GAS 會自動補（首次回報時，或先在編輯器跑一次 setupSheet）：
 *   A時間  B回報者ID  C姓名  D商品名  E照片連結  F狀態  G加點狀態  H備註
 *   審核：在 F 欄填「核可」→ 自動加點；填「駁回」→ 不加
 *
 * 【部署兩件事】
 *   1) 部署 → 新增部署 → 類型「網頁應用程式」→ 執行身分:我、誰可存取:任何人
 *      → 複製網址，貼到前端 index.html 的 FEEDBACK_GAS_URL
 *   2) 觸發器(時鐘圖示) → 新增觸發器 → 函數:onApprovalEdit、
 *      事件來源:試算表、事件類型:編輯時 → 儲存（這是「可安裝觸發器」，
 *      才能在核可時呼叫外部 API；簡單 onEdit 不能用 UrlFetchApp）
 *   首次執行會要求授權 Drive / Sheet / 外部連線，按同意即可。
 * ----------------------------------------------------------------------
 */

const ADD_POINTS   = 5;        // 核可一次加幾點
const STATUS_COL   = 6;        // F 欄 = 狀態
const CREDIT_COL   = 7;        // G 欄 = 加點狀態
const APPROVE_WORD = '核可';

// ── ① 前端回報進來（Web App POST）──
function doPost(e) {
  try {
    const data  = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();

    // 存照片到 Drive
    let photoUrl = '';
    if (data.photo_base64) {
      const bytes = Utilities.base64Decode(data.photo_base64);
      const blob  = Utilities.newBlob(bytes, 'image/jpeg',
        (data.product_name || 'report') + '_' + new Date().getTime() + '.jpg');
      const folder = DriveApp.getFolderById(props.getProperty('DRIVE_FOLDER_ID'));
      const file   = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photoUrl = file.getUrl();
    }

    // 寫一列 Sheet（狀態=待審）；第一次寫入自動補標頭
    const sheet = SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getSheets()[0];
    ensureHeader_(sheet);
    sheet.appendRow([
      new Date(),
      data.line_user_id || '',
      data.member_name  || '',
      data.product_name || '',
      photoUrl,
      '待審',
      '',
      ''
    ]);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── ② 你在 F 欄填「核可」→ 自動加點（須用可安裝觸發器）──
function onApprovalEdit(e) {
  const range = e.range;
  if (range.getColumn() !== STATUS_COL) return;           // 只看狀態欄
  const row = range.getRow();
  if (row === 1) return;                                   // 跳過標頭
  if (String(e.value).trim() !== APPROVE_WORD) return;     // 只在填「核可」時動作

  const sheet = range.getSheet();
  const creditCell = sheet.getRange(row, CREDIT_COL);
  if (String(creditCell.getValue()).trim()) return;        // 已加過 → 不重複

  const userId  = sheet.getRange(row, 2).getValue();       // B 欄 line_user_id
  const product = sheet.getRange(row, 4).getValue();       // D 欄 商品名
  if (!userId) { creditCell.setValue('⚠️ 無 userId，未加點'); return; }

  const props = PropertiesService.getScriptProperties();
  const url   = props.getProperty('MEMBERS_URL') + '/rest/v1/rpc/grant_credits';
  const key   = props.getProperty('MEMBERS_SERVICE_KEY');
  const payload = {
    p_user_id: String(userId),
    p_amount:  ADD_POINTS,
    p_source:  'contribution',
    p_reason:  '回報建檔:' + product,
    p_ref_id:  'feedback_row_' + row          // 冪等鍵：同一列只加一次
  };

  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      creditCell.setValue('✅ 已加 ' + ADD_POINTS + ' 點 ' + new Date().toLocaleString('zh-TW'));
    } else {
      creditCell.setValue('⚠️ 加點失敗(' + code + ') ' + res.getContentText().slice(0, 120));
    }
  } catch (err) {
    creditCell.setValue('⚠️ 錯誤 ' + String(err).slice(0, 120));
  }
}

// ── 共用：確保第一列有標頭（中文由程式寫入，無 IME 問題）──
function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['時間', '回報者ID', '姓名', '商品名', '照片連結', '狀態', '加點狀態', '備註']);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
  }
}

// ── 手動跑一次即可建好標頭（Apps Script 編輯器選 setupSheet → 執行；順便完成授權）──
function setupSheet() {
  const props = PropertiesService.getScriptProperties();
  const sheet = SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getSheets()[0];
  ensureHeader_(sheet);
}
