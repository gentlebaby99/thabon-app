/**
 * Students.gs — ทะเบียนนักเรียนกลาง (ใช้ร่วมทุกระบบ)
 */

/** คืนนักเรียนทั้งหมดที่ยัง active เรียงตามชั้นและเลขที่ */
function getAllStudents_() {
  var rows = readTable_(coreSS_(), SHEETS.STUDENTS).filter(function (s) {
    return s.active === true || s.active === 'TRUE' || s.active === '';
  });
  rows.sort(function (a, b) {
    return (a.gradeOrder || 99) - (b.gradeOrder || 99) || (a.classNo || 0) - (b.classNo || 0);
  });
  return rows;
}

/** คืนนักเรียนเฉพาะชั้นที่ระบุ (เช่น 'ป.3') */
function getStudentsByGrade_(grade) {
  return getAllStudents_().filter(function (s) { return s.grade === grade; });
}

