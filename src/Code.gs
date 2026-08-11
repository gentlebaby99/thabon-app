/**
 * Code.gs — จุดเข้าเว็บแอป + API ที่หน้าเว็บเรียกใช้ (ผ่าน google.script.run)
 *
 * ทุก API รู้ว่าใครเรียกผ่าน Session.getActiveUser() ฝั่งเซิร์ฟเวอร์
 * (ไม่ต้องส่ง token) และคืนรูปแบบมาตรฐาน { ok:true, ... } หรือ { ok:false, code, message }
 */

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('Index');
  t.SCHOOL_NAME = CONFIG.SCHOOL_NAME;
  t.SCHOOL_SUB = CONFIG.SCHOOL_SUB;
  t.ACADEMIC_YEAR = CONFIG.ACADEMIC_YEAR;
  t.LOGO_URL = CONFIG.LOGO_URL;
  return t.evaluate()
    .setTitle('ระบบโรงเรียนท่าบอนมิตรภาพที่ 90')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setFaviconUrl(CONFIG.LOGO_URL);
}

/** ให้ Index.html ดึงไฟล์ HTML อื่นมารวม (CSS/JS) */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** ครอบ API ให้จับ error เป็นรูปแบบเดียวกัน */
function safeApi_(fn) {
  try {
    return fn();
  } catch (err) {
    var code = err && err.code ? err.code : 'ERROR';
    return { ok: false, code: code, message: friendlyError_(code, err) };
  }
}

/** ครอบ API ที่ "เขียนข้อมูล" — ทำงานภายใต้ lock กันบันทึกชนกัน */
function mutApi_(fn) {
  return safeApi_(function () { return withLock_(fn); });
}

function friendlyError_(code, err) {
  var email = err && err.email ? err.email : '';
  switch (code) {
    case 'NOT_LOGGED_IN': return 'กรุณาเข้าสู่ระบบด้วยบัญชี Google ก่อน';
    case 'NOT_MEMBER':    return 'อีเมล ' + email + ' ยังไม่มีสิทธิ์ใช้งานระบบ กรุณาติดต่อผู้ดูแล (ครูเหวิน)';
    case 'DISABLED':      return 'บัญชีนี้ถูกปิดการใช้งาน';
    case 'NO_ACCESS':     return 'คุณไม่มีสิทธิ์เข้าใช้ส่วนนี้';
    default:              return (err && err.message) || 'เกิดข้อผิดพลาด';
  }
}

// ── หน้าแรก (portal) + ตรวจสิทธิ์เข้าใช้งาน ─────────────────────
function apiBootstrap() {
  return safeApi_(function () {
    var user = requireUser_();
    return {
      ok: true,
      user: publicUser_(user),
      apps: appsForUser_(user),
      unread: countUnread_(user.email),
      school: { name: CONFIG.SCHOOL_NAME, sub: CONFIG.SCHOOL_SUB, year: CONFIG.ACADEMIC_YEAR }
    };
  });
}

// ── แจ้งเตือน ──────────────────────────────────────────────────
function apiNotifications() {
  return mutApi_(function () {
    var user = requireUser_();
    return { ok: true, list: listAndReadNotifications_(user) };
  });
}

// ── ระบบเช็คชื่อ ───────────────────────────────────────────────
function apiAttendanceSheet(grade, date) {
  return safeApi_(function () {
    var user = requireUser_();
    return { ok: true, data: getAttendanceSheet_(user, grade, date) };
  });
}

function apiSaveAttendance(grade, date, marks) {
  return mutApi_(function () {
    var user = requireUser_();
    return saveAttendance_(user, grade, date, marks);
  });
}

function apiAttendanceHistory(grade, limit) {
  return safeApi_(function () {
    var user = requireUser_();
    return { ok: true, history: getAttendanceHistory_(user, grade, limit) };
  });
}

function apiAttendanceDashboard() {
  return safeApi_(function () {
    var user = requireUser_();
    return { ok: true, data: getAttendanceDashboard_(user) };
  });
}

function apiAttendanceExport(monthKey) {
  return mutApi_(function () {
    var user = requireUser_();
    var r = exportMonthlyAttendance_(user, monthKey);
    return { ok: true, url: r.url, name: r.name };
  });
}

// ── ระบบลา ─────────────────────────────────────────────────────
function apiLeaveInit() {
  return safeApi_(function () {
    var user = requireUser_();
    return { ok: true, data: leaveInit_(user), me: publicUser_(user) };
  });
}

function apiLeaveSubmit(payload) {
  return mutApi_(function () { return submitLeave_(requireUser_(), payload); });
}

function apiLeaveDecide(id, decision, note) {
  return mutApi_(function () { return decideLeave_(requireUser_(), id, decision, note); });
}

function apiLeaveCancel(id) {
  return mutApi_(function () { return cancelLeave_(requireUser_(), id); });
}

// ── ส่งแผนการสอน ───────────────────────────────────────────────
function apiLessonplanInit() {
  return safeApi_(function () {
    var user = requireUser_();
    return { ok: true, data: lessonplanInit_(user) };
  });
}

function apiLessonplanSubmit(payload) {
  return mutApi_(function () { return submitPlan_(requireUser_(), payload); });
}

function apiLessonplanReview(id, decision, note) {
  return mutApi_(function () { return reviewPlan_(requireUser_(), id, decision, note); });
}

function apiLessonplanCancel(id) {
  return mutApi_(function () { return cancelPlan_(requireUser_(), id); });
}

// ── สารบรรณ E-Office ───────────────────────────────────────────
function apiEofficeInit() {
  return safeApi_(function () {
    var user = requireUser_();
    return { ok: true, data: eofficeInit_(user) };
  });
}

function apiEofficeSave(payload) {
  return mutApi_(function () { return saveEofficeDoc_(requireUser_(), payload); });
}

// ── จัดเก็บเอกสาร ──────────────────────────────────────────────
function apiDocumentsInit() {
  return safeApi_(function () {
    var user = requireUser_();
    return { ok: true, data: documentsInit_(user) };
  });
}

function apiDocumentsSave(payload) {
  return mutApi_(function () { return saveDocument_(requireUser_(), payload); });
}

function apiDocumentsDelete(id) {
  return mutApi_(function () { return deleteDocument_(requireUser_(), id); });
}

// ── ผลสอบ RT/NT/O-NET ──────────────────────────────────────────
function apiExamInit() {
  return safeApi_(function () {
    var user = requireUser_();
    return { ok: true, data: examInit_(user) };
  });
}

function apiExamSave(payload) {
  return mutApi_(function () { return saveExamResult_(requireUser_(), payload); });
}

function apiExamDelete(id) {
  return mutApi_(function () { return deleteExamResult_(requireUser_(), id); });
}

// ── ผู้ดูแลระบบ ────────────────────────────────────────────────
function apiAdminData() {
  return safeApi_(function () {
    var user = requireUser_();
    assertAdmin_(user);
    return { ok: true, users: adminListUsers_(user), students: adminListStudents_(user),
             apps: adminListApps_(user), grades: GRADES, roles: VALID_ROLES };
  });
}

function apiAdminSaveUser(payload) {
  return mutApi_(function () { return adminSaveUser_(requireUser_(), payload); });
}

function apiAdminSaveStudent(payload) {
  return mutApi_(function () { return adminSaveStudent_(requireUser_(), payload); });
}
