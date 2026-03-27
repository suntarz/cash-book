/**
 * Cash Book — API สำหรับ GitHub Pages (โหลดด้วย JSONP + บันทึกด้วย POST)
 * ไม่ต้องมีไฟล์ HTML ในโปรเจกต์ Apps Script
 *
 * Deploy > New deployment > Web app
 *   Execute as: Me
 *   Who has access: Anyone (เพื่อให้ GitHub Pages เรียกได้) หรือ Anyone with Google account
 *
 * ตั้งรหัสลับ: Project Settings > Script properties > CASHBOOK_API_SECRET
 * หรือแก้ DEFAULT_API_SECRET ด้านล่าง (อย่า commit รหัสจริงลง repo สาธารณะ)
 */
var SHEET_CAT = "CashBook_Categories";
var SHEET_TX = "CashBook_Transactions";

/** ถ้าไม่ตั้ง Script property ให้ใช้ค่านี้ (ว่าง = บังคับตั้ง property) */
var DEFAULT_API_SECRET = "";

function getApiSecret() {
  var p = PropertiesService.getScriptProperties().getProperty("CASHBOOK_API_SECRET");
  if (p && String(p).trim()) return String(p).trim();
  if (DEFAULT_API_SECRET && String(DEFAULT_API_SECRET).trim()) return String(DEFAULT_API_SECRET).trim();
  throw new Error("ตั้ง CASHBOOK_API_SECRET ใน Script properties หรือ DEFAULT_API_SECRET ใน Code.gs");
}

/**
 * GET ?callback=ชื่อฟังก์ชัน&secret=รหัส — JSONP ส่งข้อมูลจาก Sheet
 * เปิดแค่ /exec โดยไม่มี callback = ข้อความบอกทาง
 */
function doGet(e) {
  var p = e && e.parameter ? e.parameter : {};
  if (p.callback) {
    if (!isValidCallbackName(p.callback)) {
      return ContentService.createTextOutput("invalid callback").setMimeType(ContentService.MimeType.TEXT);
    }
    try {
      if (!p.secret || getApiSecret() !== String(p.secret)) {
        return ContentService.createTextOutput(p.callback + "(null)").setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      var json = loadStateFromServer();
      return ContentService.createTextOutput(p.callback + "(" + json + ")").setMimeType(ContentService.MimeType.JAVASCRIPT);
    } catch (err) {
      return ContentService.createTextOutput(p.callback + "(null)").setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
  }
  return ContentService.createTextOutput(
    "Cash Book API — ใช้จาก GitHub Pages โดยตั้ง js/config.js (webAppUrl + secret)"
  ).setMimeType(ContentService.MimeType.TEXT);
}

/** POST body: {"secret":"...","payload":"<JSON string เดียวกับ saveStateToServer เดิม>"} */
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "no body" })).setMimeType(ContentService.MimeType.JSON);
    }
    var body = JSON.parse(e.postData.contents);
    if (body.secret !== getApiSecret()) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "unauthorized" })).setMimeType(ContentService.MimeType.JSON);
    }
    saveStateToServer(body.payload);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function isValidCallbackName(name) {
  return name && /^[a-zA-Z_$][a-zA-Z0-9_.$]*$/.test(String(name));
}

function loadStateFromServer() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("ไม่พบสเปรดชีต — เปิดสคริปต์จากเมนูสเปรดชีต (Extensions > Apps Script)");
  }
  ensureSheets(ss);
  var categories = readCategories(ss);
  var transactions = readTransactions(ss);
  return JSON.stringify({ categories: categories, transactions: transactions });
}

function saveStateToServer(jsonString) {
  var state = JSON.parse(jsonString);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("ไม่พบสเปรดชีต");
  ensureSheets(ss);
  writeCategories(ss, state.categories || []);
  writeTransactions(ss, state.transactions || []);
}

function ensureSheets(ss) {
  ensureSheet(ss, SHEET_CAT, ["id", "name", "type", "expenseKind"]);
  ensureSheet(ss, SHEET_TX, ["id", "date", "amount", "type", "categoryId", "note", "bookMonth"]);
}

function ensureSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  if (sh.getLastRow() < 1 || String(sh.getRange(1, 1).getValue() || "").trim() === "") {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
}

function readCategories(ss) {
  var sh = ss.getSheetByName(SHEET_CAT);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last, 4).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue;
    var c = {
      id: String(row[0]),
      name: String(row[1] || ""),
      type: row[2] === "income" ? "income" : "expense",
    };
    if (c.type === "expense") {
      c.expenseKind = row[3] === "fixed" ? "fixed" : "general";
    }
    out.push(c);
  }
  return out;
}

function readTransactions(ss) {
  var sh = ss.getSheetByName(SHEET_TX);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last, 7).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue;
    var t = {
      id: String(row[0]),
      date: formatDateCell(row[1]),
      amount: Number(row[2]) || 0,
      type: row[3] === "income" ? "income" : "expense",
      categoryId: String(row[4] || ""),
      note: row[5] ? String(row[5]) : "",
    };
    if (row[6]) t.bookMonth = String(row[6]);
    out.push(t);
  }
  return out;
}

function formatDateCell(v) {
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(v || "");
}

function writeCategories(ss, cats) {
  var sh = ss.getSheetByName(SHEET_CAT);
  var last = sh.getLastRow();
  if (last > 1) {
    sh.getRange(2, 1, last, 4).clearContent();
  }
  if (!cats || cats.length === 0) return;
  var rows = [];
  for (var i = 0; i < cats.length; i++) {
    var c = cats[i];
    rows.push([c.id, c.name, c.type, c.type === "expense" ? (c.expenseKind === "fixed" ? "fixed" : "general") : ""]);
  }
  sh.getRange(2, 1, 1 + rows.length, 4).setValues(rows);
}

function writeTransactions(ss, txs) {
  var sh = ss.getSheetByName(SHEET_TX);
  var last = sh.getLastRow();
  if (last > 1) {
    sh.getRange(2, 1, last, 7).clearContent();
  }
  if (!txs || txs.length === 0) return;
  var rows = [];
  for (var i = 0; i < txs.length; i++) {
    var t = txs[i];
    rows.push([
      t.id,
      t.date,
      t.amount,
      t.type,
      t.categoryId,
      t.note || "",
      t.bookMonth || "",
    ]);
  }
  sh.getRange(2, 1, 1 + rows.length, 7).setValues(rows);
}
