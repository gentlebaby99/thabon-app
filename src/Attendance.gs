/**
 * Attendance.gs — ระบบเช็คชื่อมาเรียน (รายคน วันละครั้ง)
 *
 * แนวคิด: เลือกชั้น + วันที่ → แสดงรายชื่อนักเรียน → ติ๊กสถานะรายคน
 *   สถานะ: มา / สาย / ลา / ขาด (ค่าเริ่มต้น = มา)
 * เก็บ 1 แถวต่อ 1 นักเรียนต่อ 1 วัน บันทึกซ้ำได้ (ทับของเดิมของวันนั้น)
 */

/** yyyy-MM-dd ตามเขตเวลาไทย */
function todayKey_() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
}

/** แปลงค่าวันที่ (อาจเป็น Date หรือ string) ให้เป็น 'yyyy-MM-dd' เสมอ */
function toDateKey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd');
  return String(v || '');
}

/**
 * ดึงรายชื่อนักเรียนของชั้น + สถานะที่เคยบันทึกไว้ของวันนั้น (ถ้ามี)
 * @return {Object} { grade, date, alreadySaved, students:[{studentId, no, name, status}] }
 */
function getAttendanceSheet_(user, grade, dateKey) {
  assertCanAccess_(user, 'attendance');
  dateKey = dateKey || todayKey_();
  var students = getStudentsByGrade_(grade);

  // อ่านของเดิมของวันนั้น
  var existing = {};
  var records = readTable_(attendanceSS_(), SHEETS.ATTENDANCE);
  records.forEach(function (r) {
    if (toDateKey_(r.date) === dateKey && r.grade === grade) existing[r.studentId] = r.status;
  });
  var alreadySaved = Object.keys(existing).length > 0;

  var list = students.map(function (s) {
    return {
      studentId: s.studentId,
      no: s.classNo,
      name: s.fullName,
      status: existing[s.studentId] || 'มา'
    };
  });
  return { grade: grade, date: dateKey, alreadySaved: alreadySaved, students: list, statuses: ATTENDANCE_STATUSES };
}

/**
 * บันทึกการเช็คชื่อของชั้น+วัน (ลบของเดิมของวันนั้นก่อน แล้วเขียนใหม่ทั้งชุด)
 * @param {Array} marks [{studentId, status}]
 */
function saveAttendance_(user, grade, dateKey, marks) {
  assertCanAccess_(user, 'attendance');
  if (!grade || !dateKey) throw new Error('ข้อมูลไม่ครบ');
  var ss = attendanceSS_();
  var sh = ss.getSheetByName(SHEETS.ATTENDANCE.name);

  // ── ลบแถวเดิมของ (วัน+ชั้น) นี้ ─────────────────────────────
  var all = readTable_(ss, SHEETS.ATTENDANCE);
  var rowsToDelete = [];
  all.forEach(function (r) {
    if (toDateKey_(r.date) === dateKey && r.grade === grade) rowsToDelete.push(r._row);
  });
  rowsToDelete.sort(function (a, b) { return b - a; }); // ลบจากล่างขึ้นบน
  rowsToDelete.forEach(function (rn) { sh.deleteRow(rn); });

  // ── เตรียมชื่อ-นักเรียน (ไว้เก็บลงแถวเพื่ออ่านง่าย) ──────────
  var nameById = {};
  getStudentsByGrade_(grade).forEach(function (s) { nameById[s.studentId] = s.fullName; });

  // ── เขียนชุดใหม่ ────────────────────────────────────────────
  var now = new Date();
  var rows = (marks || []).map(function (m) {
    return [newId_('ATT'), dateKey, grade, m.studentId, nameById[m.studentId] || '',
            m.status || 'มา', m.note || '', user.email, now];
  });
  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, SHEETS.ATTENDANCE.headers.length).setValues(rows);
  }

  var summary = summarize_(marks);
  logAction_(user.email, 'attendance.save', grade + ' ' + dateKey + ' ' + JSON.stringify(summary));
  return { ok: true, grade: grade, date: dateKey, summary: summary };
}

/** นับจำนวนแต่ละสถานะ */
function summarize_(marks) {
  var s = { total: (marks || []).length };
  ATTENDANCE_STATUSES.forEach(function (st) { s[st] = 0; });
  (marks || []).forEach(function (m) {
    var st = m.status || 'มา';
    if (s[st] === undefined) s[st] = 0;
    s[st]++;
  });
  return s;
}

/**
 * แดชบอร์ดภาพรวมวันนี้ (แสดงในหน้าเลือกชั้น)
 * @return {Object} { date, grades:[{grade,total,checked,summary}], overall }
 */
function getAttendanceDashboard_(user) {
  assertCanAccess_(user, 'attendance');
  var today = todayKey_();
  var students = getAllStudents_();

  // จำนวนนักเรียนต่อชั้น
  var totalByGrade = {};
  students.forEach(function (s) { totalByGrade[s.grade] = (totalByGrade[s.grade] || 0) + 1; });

  // ผลเช็คชื่อของวันนี้ แยกชั้น
  var todayByGrade = {};
  readTable_(attendanceSS_(), SHEETS.ATTENDANCE).forEach(function (r) {
    if (toDateKey_(r.date) !== today) return;
    if (!todayByGrade[r.grade]) todayByGrade[r.grade] = [];
    todayByGrade[r.grade].push({ status: r.status });
  });

  var overall = { total: 0, checkedGrades: 0, gradeCount: 0 };
  ATTENDANCE_STATUSES.forEach(function (st) { overall[st] = 0; });

  var grades = GRADES.filter(function (g) { return totalByGrade[g]; }).map(function (g) {
    var recs = todayByGrade[g] || [];
    var sum = summarize_(recs);
    var checked = recs.length > 0;
    overall.gradeCount++;
    overall.total += totalByGrade[g];
    if (checked) {
      overall.checkedGrades++;
      ATTENDANCE_STATUSES.forEach(function (st) { overall[st] += (sum[st] || 0); });
    }
    return { grade: g, total: totalByGrade[g], checked: checked, summary: sum };
  });

  return { date: today, grades: grades, overall: overall };
}

var THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                   'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

/** '2026-07' → 'กรกฎาคม 2569' */
function thaiMonthLabel_(monthKey) {
  var parts = String(monthKey).split('-');
  var y = parseInt(parts[0], 10) + 543;
  var m = parseInt(parts[1], 10);
  return (THAI_MONTHS[m - 1] || parts[1]) + ' ' + y;
}

/**
 * Export สรุปเช็คชื่อรายเดือนเป็น Google Sheet ใหม่ (1 ชีตต่อชั้น)
 * @param {string} monthKey 'yyyy-MM'
 * @return {Object} { url, name }
 */
function exportMonthlyAttendance_(user, monthKey) {
  assertCanAccess_(user, 'attendance');
  if (!/^\d{4}-\d{2}$/.test(String(monthKey))) throw new Error('รูปแบบเดือนไม่ถูกต้อง');

  var label = thaiMonthLabel_(monthKey);
  var records = readTable_(attendanceSS_(), SHEETS.ATTENDANCE)
    .filter(function (r) { return toDateKey_(r.date).slice(0, 7) === monthKey; });
  if (!records.length) throw new Error('เดือน' + label + ' ยังไม่มีข้อมูลการเช็คชื่อ');

  // จัดกลุ่ม: grade → studentId → {date: status}
  var byGrade = {};
  var datesByGrade = {};
  records.forEach(function (r) {
    var d = toDateKey_(r.date);
    if (!byGrade[r.grade]) { byGrade[r.grade] = {}; datesByGrade[r.grade] = {}; }
    if (!byGrade[r.grade][r.studentId]) byGrade[r.grade][r.studentId] = {};
    byGrade[r.grade][r.studentId][d] = r.status;
    datesByGrade[r.grade][d] = true;
  });

  var mark = { 'มา': '✓', 'สาย': 'ส', 'ลา': 'ล', 'ขาด': 'ข' };
  var out = SpreadsheetApp.create('สรุปเช็คชื่อ ' + label + ' · ' + CONFIG.SCHOOL_NAME);

  GRADES.forEach(function (grade) {
    if (!byGrade[grade]) return;
    var dates = Object.keys(datesByGrade[grade]).sort();
    var students = getStudentsByGrade_(grade);
    var sh = out.insertSheet(grade);

    // หัวตาราง: เลขที่ | ชื่อ-สกุล | วันที่(เอาเฉพาะวัน) ... | มา สาย ลา ขาด
    var header = ['เลขที่', 'ชื่อ-สกุล'].concat(dates.map(function (d) { return d.slice(8); }))
      .concat(['มา', 'สาย', 'ลา', 'ขาด']);
    var rows = [header];

    students.forEach(function (s) {
      var marks = byGrade[grade][s.studentId] || {};
      var counts = { 'มา': 0, 'สาย': 0, 'ลา': 0, 'ขาด': 0 };
      var cells = dates.map(function (d) {
        var st = marks[d];
        if (st && counts[st] !== undefined) counts[st]++;
        return st ? (mark[st] || st) : '';
      });
      rows.push([s.classNo, s.fullName].concat(cells)
        .concat([counts['มา'], counts['สาย'], counts['ลา'], counts['ขาด']]));
    });

    sh.getRange(1, 1, rows.length, header.length).setValues(rows);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#1a3d8f').setFontColor('#fff');
    sh.setFrozenRows(1);
    sh.setFrozenColumns(2);
    sh.autoResizeColumns(1, 2);
  });

  removeDefaultSheet_(out);
  // แถวอธิบายสัญลักษณ์ในชีตแรก
  var first = out.getSheets()[0];
  first.insertRowBefore(1);
  first.getRange(1, 1).setValue(CONFIG.SCHOOL_NAME + ' · สรุปเช็คชื่อ ' + label + ' · ✓=มา ส=สาย ล=ลา ข=ขาด');
  first.setFrozenRows(2);

  logAction_(user.email, 'attendance.export', monthKey);
  return { url: out.getUrl(), name: out.getName() };
}

/**
 * ประวัติการเช็คชื่อของชั้น (ล่าสุดก่อน) — สรุปรายวัน
 * @return {Array} [{date, summary}]
 */
function getAttendanceHistory_(user, grade, limit) {
  assertCanAccess_(user, 'attendance');
  var records = readTable_(attendanceSS_(), SHEETS.ATTENDANCE)
    .filter(function (r) { return r.grade === grade; });
  var byDate = {};
  records.forEach(function (r) {
    var d = toDateKey_(r.date);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push({ status: r.status });
  });
  var out = Object.keys(byDate).sort().reverse().map(function (d) {
    return { date: d, summary: summarize_(byDate[d]) };
  });
  return out.slice(0, limit || 30);
}
