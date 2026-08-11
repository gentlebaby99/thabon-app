/**
 * Setup.gs — ตัวติดตั้งระบบอัตโนมัติ
 *
 * รัน setupSystem() เพียงครั้งเดียวหลังวางโค้ดครบ ระบบจะ:
 *   1) สร้างไฟล์ Google Sheet 2 ไฟล์ (ฐานข้อมูลกลาง + ระบบเช็คชื่อ)
 *   2) สร้างชีตและหัวคอลัมน์ทั้งหมดตาม Schema.gs
 *   3) นำเข้านักเรียน 83 คน + ผู้ใช้ 5 คน + ทะเบียนระบบ
 *   4) บันทึก ID ไฟล์ไว้ใน Script Properties (ไม่ต้องกรอกเอง)
 *
 * รันซ้ำได้อย่างปลอดภัย — ถ้าไฟล์มีอยู่แล้วจะไม่สร้างซ้ำ
 */

function setupSystem() {
  var props = PropertiesService.getScriptProperties();
  var report = [];

  // ── 1) ไฟล์กลาง ───────────────────────────────────────────────
  var coreId = props.getProperty(CONFIG.PROP_CORE_ID);
  var core;
  if (coreId && safeOpen_(coreId)) {
    core = SpreadsheetApp.openById(coreId);
    report.push('พบไฟล์กลางเดิม: ' + core.getName());
  } else {
    core = SpreadsheetApp.create(CONFIG.CORE_FILE_NAME);
    props.setProperty(CONFIG.PROP_CORE_ID, core.getId());
    report.push('สร้างไฟล์กลางใหม่: ' + core.getName());
  }
  ensureSheet_(core, SHEETS.USERS);
  ensureSheet_(core, SHEETS.STUDENTS);
  ensureSheet_(core, SHEETS.APPS);
  ensureSheet_(core, SHEETS.NOTIFICATIONS);
  ensureSheet_(core, SHEETS.CONFIG);
  ensureSheet_(core, SHEETS.LOG);
  removeDefaultSheet_(core);

  // ── 2) ไฟล์โมดูลทุกระบบ (สร้างเฉพาะที่ยังไม่มี) ────────────────
  var moduleFiles = [core];
  MODULE_FILES_().forEach(function (m) {
    var id = props.getProperty(m.prop);
    var ss;
    if (id && safeOpen_(id)) {
      ss = SpreadsheetApp.openById(id);
      report.push('พบไฟล์เดิม: ' + ss.getName());
    } else {
      ss = SpreadsheetApp.create(m.name);
      props.setProperty(m.prop, ss.getId());
      report.push('สร้างไฟล์ใหม่: ' + ss.getName());
    }
    m.sheets.forEach(function (def) { ensureSheet_(ss, def); });
    removeDefaultSheet_(ss);
    moduleFiles.push(ss);
  });

  // ── 3) นำเข้าข้อมูลเริ่มต้น (เฉพาะเมื่อยังว่าง) ────────────────
  report.push(seedStudentsIfEmpty_(core));
  report.push(seedUsersIfEmpty_(core));
  report.push(syncApps_(core));
  seedConfig_(core);

  // ── 4) แชร์ไฟล์ข้อมูลให้บัญชีผู้ใช้ (จำเป็น เพราะแอปรันในนามผู้ใช้) ──
  report.push(shareDataFiles_(core, moduleFiles));

  logAction_(CONFIG.OWNER_EMAIL, 'setup', report.join(' | '));

  var msg = '✅ ติดตั้งสำเร็จ\n\n' + report.join('\n') +
    '\n\nไฟล์กลาง: ' + core.getUrl();
  moduleFiles.slice(1).forEach(function (ss) { msg += '\n' + ss.getName() + ': ' + ss.getUrl(); });
  Logger.log(msg);
  return msg;
}

/** ทะเบียนไฟล์โมดูลทั้งหมด — เพิ่มโมดูลใหม่ในอนาคตแค่เพิ่มรายการที่นี่ */
function MODULE_FILES_() {
  return [
    { prop: CONFIG.PROP_ATTENDANCE_ID, name: CONFIG.ATTENDANCE_FILE_NAME, sheets: [SHEETS.ATTENDANCE] },
    { prop: CONFIG.PROP_LEAVE_ID,      name: CONFIG.LEAVE_FILE_NAME,      sheets: [SHEETS.LEAVES] },
    { prop: CONFIG.PROP_LESSONPLAN_ID, name: CONFIG.LESSONPLAN_FILE_NAME, sheets: [SHEETS.LESSONPLANS] },
    { prop: CONFIG.PROP_EOFFICE_ID,    name: CONFIG.EOFFICE_FILE_NAME,    sheets: [SHEETS.EOFFICE] },
    { prop: CONFIG.PROP_DOCUMENTS_ID,  name: CONFIG.DOCUMENTS_FILE_NAME,  sheets: [SHEETS.DOCUMENTS] },
    { prop: CONFIG.PROP_EXAM_ID,       name: CONFIG.EXAM_FILE_NAME,       sheets: [SHEETS.EXAM] }
  ];
}

/** เปิดไฟล์เพื่อทดสอบว่ายังมีอยู่จริงไหม */
function safeOpen_(id) {
  try { SpreadsheetApp.openById(id); return true; } catch (e) { return false; }
}

/** สร้างชีตถ้ายังไม่มี + ใส่หัวคอลัมน์ + ตรึงแถวหัว */
function ensureSheet_(ss, sheetDef) {
  var sh = ss.getSheetByName(sheetDef.name);
  if (!sh) sh = ss.insertSheet(sheetDef.name);
  var first = sh.getRange(1, 1, 1, sheetDef.headers.length).getValues()[0];
  if (first.join('') === '') {
    sh.getRange(1, 1, 1, sheetDef.headers.length).setValues([sheetDef.headers]);
    sh.getRange(1, 1, 1, sheetDef.headers.length)
      .setFontWeight('bold').setBackground('#1a3d8f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** ลบชีตเปล่าชื่อเริ่มต้น (Sheet1 / ชีต1) ที่ Google สร้างให้ */
function removeDefaultSheet_(ss) {
  ['Sheet1', 'ชีต1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && ss.getSheets().length > 1) {
      try { ss.deleteSheet(sh); } catch (e) {}
    }
  });
}

function seedStudentsIfEmpty_(core) {
  if (readTable_(core, SHEETS.STUDENTS).length > 0) return 'นักเรียน: มีข้อมูลอยู่แล้ว (ข้าม)';
  var rows = SEED_STUDENTS_();
  var sh = core.getSheetByName(SHEETS.STUDENTS.name);
  var out = rows.map(function (r) {
    var prefix = r[2], first = r[3], last = r[4], grade = r[5];
    var full = [prefix, first, last].filter(String).join(' ').replace(/\s+/g, ' ').trim();
    return [r[0], r[1], prefix, first, last, full, grade, GRADE_ORDER_MAP[grade] || 99, true];
  });
  sh.getRange(2, 1, out.length, SHEETS.STUDENTS.headers.length).setValues(out);
  return 'นักเรียน: นำเข้า ' + out.length + ' คน';
}

function seedUsersIfEmpty_(core) {
  if (readTable_(core, SHEETS.USERS).length > 0) return 'ผู้ใช้: มีข้อมูลอยู่แล้ว (ข้าม)';
  var users = SEED_USERS_();
  var now = new Date();
  var sh = core.getSheetByName(SHEETS.USERS.name);
  var out = users.map(function (u) {
    return [String(u.email).toLowerCase(), u.nickname, u.fullName || '', u.role,
            u.homeroom || '', '-', u.active !== false, now];
  });
  sh.getRange(2, 1, out.length, SHEETS.USERS.headers.length).setValues(out);
  return 'ผู้ใช้: นำเข้า ' + out.length + ' คน';
}

/**
 * เขียนทะเบียนระบบใหม่จาก APPS_REGISTRY ทุกครั้งที่รัน setup
 * (ชีต Apps เป็นข้อมูลระบบ ไม่ใช่ข้อมูลผู้ใช้ — sync ทับได้เสมอ
 *  ทำให้เพิ่ม/เปิดโมดูลใหม่แล้วแค่รัน setupSystem() ซ้ำก็อัปเดต)
 */
function syncApps_(core) {
  var sh = core.getSheetByName(SHEETS.APPS.name);
  var lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, SHEETS.APPS.headers.length).clearContent();
  var out = APPS_REGISTRY.map(function (a, i) {
    return [a.id, a.name, a.icon, a.roles.join(','), a.status, i + 1];
  });
  sh.getRange(2, 1, out.length, SHEETS.APPS.headers.length).setValues(out);
  return 'ทะเบียนระบบ: sync ' + out.length + ' รายการ';
}

function seedConfig_(core) {
  var sh = core.getSheetByName(SHEETS.CONFIG.name);
  if (readTable_(core, SHEETS.CONFIG).length > 0) return;
  var kv = [
    ['schoolName', CONFIG.SCHOOL_NAME],
    ['schoolSub', CONFIG.SCHOOL_SUB],
    ['academicYear', CONFIG.ACADEMIC_YEAR],
    ['ownerEmail', CONFIG.OWNER_EMAIL]
  ];
  sh.getRange(2, 1, kv.length, 2).setValues(kv);
}

/**
 * แชร์ไฟล์ข้อมูลทั้งสอง (แก้ไขได้) ให้กับบัญชีผู้ใช้ทุกคนในชีต Users
 * จำเป็นเพราะเว็บแอปรัน "ในนามผู้ใช้ที่เข้าถึง" จึงต้องเปิดไฟล์ด้วยสิทธิ์ของผู้ใช้เอง
 * เจ้าของยังเป็นบัญชีที่รัน setup อยู่ (ไฟล์ไม่เปิดสาธารณะ)
 */
function shareDataFiles_(core, files) {
  var emails = readTable_(core, SHEETS.USERS)
    .filter(function (u) { return u.active === true || u.active === 'TRUE' || u.active === ''; })
    .map(function (u) { return String(u.email).toLowerCase(); })
    .filter(function (e) { return e && e.indexOf('@') !== -1; });

  var owner = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  var added = 0;
  emails.forEach(function (email) {
    if (email === owner) return;
    added++;
    files.forEach(function (f) { try { f.addEditor(email); } catch (e) {} });
  });
  return 'แชร์ไฟล์ให้ผู้ใช้: ' + added + ' บัญชี';
}

/** แชร์ไฟล์ให้ผู้ใช้อีกครั้ง (รันหลังเพิ่มผู้ใช้ใหม่) */
function reshareDataFiles() {
  var files = [coreSS_()];
  MODULE_FILES_().forEach(function (m) {
    try { files.push(moduleSS_(m.prop)); } catch (e) {}
  });
  var msg = shareDataFiles_(coreSS_(), files);
  Logger.log(msg);
  return msg;
}

/** นำเข้าผู้ใช้ใหม่จาก SEED_USERS_() อีกครั้ง (เพิ่มเฉพาะอีเมลที่ยังไม่มี) */
function reseedUsers() {
  var core = coreSS_();
  var existing = {};
  readTable_(core, SHEETS.USERS).forEach(function (u) {
    existing[String(u.email).toLowerCase()] = true;
  });
  var added = 0, now = new Date();
  SEED_USERS_().forEach(function (u) {
    var email = String(u.email).toLowerCase();
    if (existing[email]) return;
    appendRow_(core, SHEETS.USERS, {
      email: email, nickname: u.nickname, fullName: u.fullName || '', role: u.role,
      homeroom: u.homeroom || '', extraPerms: '-', active: u.active !== false, createdAt: now
    });
    added++;
  });
  var msg = 'เพิ่มผู้ใช้ใหม่ ' + added + ' คน';
  Logger.log(msg);
  return msg;
}
