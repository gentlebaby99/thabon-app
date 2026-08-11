/**
 * Data.gs — ชั้นเข้าถึงข้อมูล (เปิดไฟล์ Sheet + อ่าน/เขียนตารางแบบทั่วไป)
 *
 * ทุกโมดูลเรียกผ่านฟังก์ชันเหล่านี้ ไม่เปิด SpreadsheetApp ตรง ๆ
 * เพื่อให้เปลี่ยนที่เก็บข้อมูลในอนาคตได้ที่เดียว
 */

/** คืน Spreadsheet ไฟล์กลาง (โยน error ถ้ายังไม่ได้ติดตั้ง) */
function coreSS_() {
  var id = PropertiesService.getScriptProperties().getProperty(CONFIG.PROP_CORE_ID);
  if (!id) throw new Error('ยังไม่ได้ติดตั้งระบบ — กรุณารันฟังก์ชัน setupSystem() ก่อน');
  return SpreadsheetApp.openById(id);
}

/** เปิดไฟล์โมดูลจาก Script Property (โยน error ถ้ายังไม่ติดตั้ง) */
function moduleSS_(propKey) {
  var id = PropertiesService.getScriptProperties().getProperty(propKey);
  if (!id) throw new Error('ยังไม่ได้ติดตั้งไฟล์ข้อมูล (' + propKey + ') — กรุณารัน setupSystem() ก่อน');
  return SpreadsheetApp.openById(id);
}

function attendanceSS_() { return moduleSS_(CONFIG.PROP_ATTENDANCE_ID); }
function leaveSS_()      { return moduleSS_(CONFIG.PROP_LEAVE_ID); }
function lessonplanSS_() { return moduleSS_(CONFIG.PROP_LESSONPLAN_ID); }
function eofficeSS_()    { return moduleSS_(CONFIG.PROP_EOFFICE_ID); }
function documentsSS_()  { return moduleSS_(CONFIG.PROP_DOCUMENTS_ID); }
function examSS_()       { return moduleSS_(CONFIG.PROP_EXAM_ID); }

/**
 * อ่านทั้งตารางเป็นอาเรย์ของ object (คีย์ = หัวคอลัมน์)
 * @param {Spreadsheet} ss
 * @param {Object} sheetDef  เช่น SHEETS.USERS
 */
function readTable_(ss, sheetDef) {
  var sh = ss.getSheetByName(sheetDef.name);
  if (!sh) return [];
  var lastRow = sh.getLastRow();
  var lastCol = sheetDef.headers.length;
  if (lastRow < 2) return [];
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    // ข้ามแถวว่างสนิท
    if (row.join('') === '') continue;
    var obj = {};
    for (var c = 0; c < sheetDef.headers.length; c++) {
      obj[sheetDef.headers[c]] = row[c];
    }
    obj._row = i + 2; // เลขแถวจริงในชีต (ไว้ใช้ตอนอัปเดต)
    out.push(obj);
  }
  return out;
}

/** เพิ่ม 1 แถวต่อท้าย โดยเรียงค่าตามหัวคอลัมน์ */
function appendRow_(ss, sheetDef, obj) {
  var sh = ss.getSheetByName(sheetDef.name);
  var row = sheetDef.headers.map(function (h) {
    return obj[h] === undefined || obj[h] === null ? '' : obj[h];
  });
  sh.appendRow(row);
  return sh.getLastRow();
}

/** อัปเดตแถวที่ระบุ (rowNumber = เลขแถวจริง) ด้วยค่าจาก obj */
function updateRow_(ss, sheetDef, rowNumber, obj) {
  var sh = ss.getSheetByName(sheetDef.name);
  var row = sheetDef.headers.map(function (h) {
    return obj[h] === undefined || obj[h] === null ? '' : obj[h];
  });
  sh.getRange(rowNumber, 1, 1, sheetDef.headers.length).setValues([row]);
}

/** ลบแถวที่ระบุ */
function deleteRow_(ss, sheetDef, rowNumber) {
  ss.getSheetByName(sheetDef.name).deleteRow(rowNumber);
}

/**
 * รันงานเขียนข้อมูลภายใต้ lock กันชนกัน
 * (เช่น ครูหลายคนกดบันทึกเช็คชื่อพร้อมกันตอนเช้า — การลบ/แก้แถวด้วยเลขแถว
 *  โดยไม่มี lock อาจลบผิดแถวได้)
 */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000); // รอสูงสุด 15 วินาที
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/** สร้าง id แบบสุ่มพร้อม prefix (เช่น ATT_xxxxx) */
function newId_(prefix) {
  return prefix + '_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
}

/** บันทึกกิจกรรมลงชีต Log */
function logAction_(email, action, detail) {
  try {
    appendRow_(coreSS_(), SHEETS.LOG, {
      timestamp: new Date(), email: email || '', action: action || '', detail: detail || ''
    });
  } catch (e) { /* ไม่ให้ log ล้มแล้วพังทั้งระบบ */ }
}
