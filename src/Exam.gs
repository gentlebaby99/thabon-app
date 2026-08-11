/**
 * Exam.gs — ระบบบันทึกผลสอบระดับชาติ RT / NT / O-NET
 *
 * เก็บเป็นรายวิชา: 1 แถว = คะแนน 1 วิชา ของปี+ประเภทการสอบ
 * (คะแนนระดับโรงเรียน / เขต / ประเทศ) — ดูเป็นตารางเปรียบเทียบรายปี
 */

function examInit_(user) {
  assertCanAccess_(user, 'exam');
  return {
    types: EXAM_TYPES,
    subjects: EXAM_SUBJECTS,
    canEdit: canEditExam_(user),
    results: listExamResults_(user)
  };
}

/** ครู/ผอ./แอดมิน กรอกผลได้ (ทุก role ที่เข้าระบบนี้ได้) */
function canEditExam_(user) {
  return user.role === 'admin' || user.role === 'principal' || user.role === 'teacher';
}

function listExamResults_(user) {
  var rows = readTable_(examSS_(), SHEETS.EXAM).map(publicExam_);
  // เรียง: ปีล่าสุดก่อน → ประเภท → ลำดับวิชา
  rows.sort(function (a, b) {
    return (b.year || '').localeCompare(a.year || '') ||
           EXAM_TYPES.indexOf(a.testType) - EXAM_TYPES.indexOf(b.testType) ||
           subjectOrder_(a) - subjectOrder_(b);
  });
  return rows;
}

function subjectOrder_(r) {
  var list = EXAM_SUBJECTS[r.testType] || [];
  var i = list.indexOf(r.subject);
  return i === -1 ? 99 : i;
}

/** เพิ่ม/แก้ผลสอบ 1 วิชา (จับคู่ด้วย ปี+ประเภท+วิชา — กรอกซ้ำ = แก้ของเดิม) */
function saveExamResult_(user, p) {
  assertCanAccess_(user, 'exam');
  if (!canEditExam_(user)) { var e = new Error('NO_ACCESS'); e.code = 'NO_ACCESS'; throw e; }
  if (EXAM_TYPES.indexOf(p.testType) === -1) throw new Error('ประเภทการสอบไม่ถูกต้อง');
  var year = String(p.year || '').trim();
  if (!/^25\d{2}$/.test(year)) throw new Error('กรุณากรอกปีการศึกษาเป็น พ.ศ. เช่น 2568');
  if (!p.subject || !String(p.subject).trim()) throw new Error('กรุณาระบุวิชา');

  var ss = examSS_();
  var rows = readTable_(ss, SHEETS.EXAM);
  var existing = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].year) === year && rows[i].testType === p.testType &&
        rows[i].subject === p.subject) { existing = rows[i]; break; }
  }

  var obj = {
    id: existing ? existing.id : newId_('EX'),
    year: year,
    testType: p.testType,
    subject: String(p.subject).trim(),
    scoreSchool: numOrBlank_(p.scoreSchool),
    scoreArea: numOrBlank_(p.scoreArea),
    scoreNational: numOrBlank_(p.scoreNational),
    note: (p.note || '').trim(),
    createdBy: user.nickname || user.email,
    createdAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm')
  };

  if (existing) updateRow_(ss, SHEETS.EXAM, existing._row, obj);
  else appendRow_(ss, SHEETS.EXAM, obj);

  logAction_(user.email, existing ? 'exam.edit' : 'exam.add', year + ' ' + p.testType + ' ' + p.subject);
  return { ok: true, isNew: !existing };
}

/** ลบผล 1 วิชา (เฉพาะแอดมิน) */
function deleteExamResult_(user, id) {
  assertAdmin_(user);
  var ss = examSS_();
  var rows = readTable_(ss, SHEETS.EXAM);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      deleteRow_(ss, SHEETS.EXAM, rows[i]._row);
      logAction_(user.email, 'exam.delete', id);
      return { ok: true };
    }
  }
  throw new Error('ไม่พบข้อมูล');
}

function numOrBlank_(v) {
  var n = parseFloat(v);
  return isNaN(n) ? '' : n;
}

function publicExam_(r) {
  return {
    id: r.id,
    year: String(r.year || ''),
    testType: r.testType || '',
    subject: r.subject || '',
    scoreSchool: r.scoreSchool === '' ? '' : Number(r.scoreSchool),
    scoreArea: r.scoreArea === '' ? '' : Number(r.scoreArea),
    scoreNational: r.scoreNational === '' ? '' : Number(r.scoreNational),
    note: r.note || '',
    createdBy: r.createdBy || ''
  };
}
