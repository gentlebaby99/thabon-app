/**
 * Admin.gs — หน้าผู้ดูแลระบบ (เฉพาะ role = admin)
 * จัดการผู้ใช้ (ครู/บุคลากร/ผอ.) และนักเรียน โดยไม่ต้องแก้ชีตเอง
 */

var VALID_ROLES = ['admin', 'principal', 'teacher', 'staff'];

function assertAdmin_(user) {
  if (user.role !== 'admin') { var e = new Error('NO_ACCESS'); e.code = 'NO_ACCESS'; throw e; }
}

/** รายการระบบย่อยไว้ให้ติ๊กสิทธิ์พิเศษรายคน (ไม่รวมระบบแอดมิน) */
function adminListApps_(user) {
  assertAdmin_(user);
  return readTable_(coreSS_(), SHEETS.APPS)
    .filter(function (a) { return a.appId !== 'admin'; })
    .map(function (a) { return { id: a.appId, name: a.name, icon: a.icon }; });
}

// ── ผู้ใช้ ─────────────────────────────────────────────────────
function adminListUsers_(user) {
  assertAdmin_(user);
  var users = readTable_(coreSS_(), SHEETS.USERS);
  return users.map(function (u) {
    return {
      email: String(u.email).toLowerCase(),
      nickname: u.nickname || '',
      fullName: u.fullName || '',
      role: u.role || 'teacher',
      roleLabel: roleLabel_(u.role),
      homeroom: u.homeroom || '',
      extraPerms: u.extraPerms === '-' ? '' : (u.extraPerms || ''),
      active: !(u.active === false || u.active === 'FALSE')
    };
  });
}

/** เพิ่มหรือแก้ผู้ใช้ (จับคู่ด้วยอีเมล) */
function adminSaveUser_(user, p) {
  assertAdmin_(user);
  var email = String(p.email || '').trim().toLowerCase();
  if (!email || email.indexOf('@') === -1) throw new Error('อีเมลไม่ถูกต้อง');
  if (VALID_ROLES.indexOf(p.role) === -1) throw new Error('บทบาทไม่ถูกต้อง');
  if (p.homeroom && GRADES.indexOf(p.homeroom) === -1) throw new Error('ชั้นเรียนไม่ถูกต้อง');
  // กันแอดมินล็อกตัวเองออกจากระบบ (ปิดบัญชี/ลดสิทธิ์ตัวเอง)
  if (email === String(user.email).toLowerCase()) {
    if (p.active === false) throw new Error('ปิดบัญชีตัวเองไม่ได้');
    if (p.role !== 'admin') throw new Error('ลดสิทธิ์แอดมินของตัวเองไม่ได้ (ให้แอดมินคนอื่นทำแทน)');
  }

  var core = coreSS_();
  var users = readTable_(core, SHEETS.USERS);
  var existing = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase() === email) { existing = users[i]; break; }
  }

  // ถ้าฟอร์มไม่ได้ส่ง extraPerms มา ให้คงค่าเดิมไว้ (ไม่ลบสิทธิ์พิเศษรายคน)
  var extraPerms;
  if (p.extraPerms !== undefined) extraPerms = (p.extraPerms || '').trim() || '-';
  else extraPerms = (existing && existing.extraPerms) ? existing.extraPerms : '-';

  var obj = {
    email: email,
    nickname: p.nickname || email,
    fullName: p.fullName || '',
    role: p.role,
    homeroom: p.homeroom || '',
    extraPerms: extraPerms,
    active: p.active !== false,
    createdAt: existing ? existing.createdAt : new Date()
  };

  var isNew = !existing;
  if (existing) {
    updateRow_(core, SHEETS.USERS, existing._row, obj);
  } else {
    appendRow_(core, SHEETS.USERS, obj);
  }

  // แชร์ไฟล์ให้บัญชีใหม่ (best-effort — ถ้าล้มเหลวให้เจ้าของรัน reshareDataFiles)
  var shareNote = '';
  if (isNew && obj.active) {
    try {
      core.addEditor(email);
      MODULE_FILES_().forEach(function (m) { moduleSS_(m.prop).addEditor(email); });
    } catch (e) { shareNote = ' (แชร์ไฟล์อัตโนมัติไม่สำเร็จ — ให้เจ้าของรัน reshareDataFiles หนึ่งครั้ง)'; }
  }

  logAction_(user.email, isNew ? 'admin.addUser' : 'admin.editUser', email);
  return { ok: true, isNew: isNew, note: shareNote };
}

// ── นักเรียน ───────────────────────────────────────────────────
function adminListStudents_(user) {
  assertAdmin_(user);
  var rows = readTable_(coreSS_(), SHEETS.STUDENTS);
  rows.sort(function (a, b) {
    return (a.gradeOrder || 99) - (b.gradeOrder || 99) || (a.classNo || 0) - (b.classNo || 0);
  });
  return rows.map(function (s) {
    return {
      studentId: s.studentId, classNo: s.classNo, prefix: s.prefix || '',
      firstName: s.firstName || '', lastName: s.lastName || '',
      fullName: s.fullName || '', grade: s.grade,
      active: !(s.active === false || s.active === 'FALSE')
    };
  });
}

/** เพิ่ม/แก้นักเรียน */
function adminSaveStudent_(user, p) {
  assertAdmin_(user);
  if (GRADES.indexOf(p.grade) === -1) throw new Error('ชั้นเรียนไม่ถูกต้อง');
  if (!p.firstName) throw new Error('กรุณากรอกชื่อ');
  var core = coreSS_();
  var rows = readTable_(core, SHEETS.STUDENTS);

  var prefix = p.prefix || '';
  var first = String(p.firstName || '').trim();
  var last = String(p.lastName || '').trim();
  var full = [prefix, first, last].filter(String).join(' ').replace(/\s+/g, ' ').trim();
  var obj = {
    studentId: p.studentId || nextStudentId_(rows),
    classNo: p.classNo || '',
    prefix: prefix, firstName: first, lastName: last, fullName: full,
    grade: p.grade, gradeOrder: GRADE_ORDER_MAP[p.grade] || 99,
    active: p.active !== false
  };

  var existing = null;
  if (p.studentId) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].studentId === p.studentId) { existing = rows[i]; break; }
    }
  }
  if (existing) updateRow_(core, SHEETS.STUDENTS, existing._row, obj);
  else appendRow_(core, SHEETS.STUDENTS, obj);

  logAction_(user.email, existing ? 'admin.editStudent' : 'admin.addStudent', obj.studentId);
  return { ok: true, isNew: !existing, studentId: obj.studentId };
}

/** สร้างรหัสนักเรียนถัดไป STDxxx */
function nextStudentId_(rows) {
  var max = 0;
  rows.forEach(function (s) {
    var m = String(s.studentId || '').match(/STD(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'STD' + String(max + 1).padStart(3, '0');
}
