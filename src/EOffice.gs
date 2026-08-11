/**
 * EOffice.gs — ระบบสารบรรณอิเล็กทรอนิกส์ (ทะเบียนหนังสือรับเข้า/ส่งออก/เวียน/คำสั่ง)
 *
 * ธุรการ/แอดมิน/ผอ. ลงทะเบียนหนังสือ ติดตามสถานะ มอบหมายผู้รับผิดชอบ
 * ถ้ามอบหมาย (assignedTo) → แจ้งเตือนคนนั้นในแอป + อีเมล
 */

function eofficeInit_(user) {
  assertCanAccess_(user, 'eoffice');
  return {
    types: EOFFICE_TYPES,
    priorities: EOFFICE_PRIORITIES,
    statuses: EOFFICE_STATUSES,
    users: listUserNames_(),
    docs: listEofficeDocs_(user)
  };
}

/** รายชื่อผู้ใช้ (ไว้เลือกมอบหมาย) */
function listUserNames_() {
  return readTable_(coreSS_(), SHEETS.USERS)
    .filter(function (u) { return !(u.active === false || u.active === 'FALSE'); })
    .map(function (u) { return { email: String(u.email).toLowerCase(), name: u.nickname || u.email }; });
}

function listEofficeDocs_(user) {
  var rows = readTable_(eofficeSS_(), SHEETS.EOFFICE).map(publicEDoc_);
  rows.sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
  return rows;
}

/** เพิ่ม/แก้หนังสือ (จับคู่ด้วย id) */
function saveEofficeDoc_(user, p) {
  assertCanAccess_(user, 'eoffice');
  if (EOFFICE_TYPES.indexOf(p.type) === -1) throw new Error('ประเภทหนังสือไม่ถูกต้อง');
  if (!p.subject || !String(p.subject).trim()) throw new Error('กรุณากรอกเรื่อง');
  if (p.priority && EOFFICE_PRIORITIES.indexOf(p.priority) === -1) throw new Error('ชั้นความเร็วไม่ถูกต้อง');
  if (p.status && EOFFICE_STATUSES.indexOf(p.status) === -1) throw new Error('สถานะไม่ถูกต้อง');

  var ss = eofficeSS_();
  var rows = readTable_(ss, SHEETS.EOFFICE);
  var existing = null;
  if (p.id) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === p.id) { existing = rows[i]; break; }
    }
    if (!existing) throw new Error('ไม่พบหนังสือที่จะแก้ไข');
  }

  var obj = {
    id: existing ? existing.id : newId_('EO'),
    type: p.type,
    docNo: (p.docNo || '').trim(),
    subject: String(p.subject).trim(),
    sender: (p.sender || '').trim(),
    receiver: (p.receiver || '').trim(),
    docDate: String(p.docDate || '').slice(0, 10),
    priority: p.priority || 'ปกติ',
    status: p.status || 'ลงทะเบียน',
    assignedTo: String(p.assignedTo || '').toLowerCase(),
    deadline: String(p.deadline || '').slice(0, 10),
    remarks: (p.remarks || '').trim(),
    fileUrl: (p.fileUrl || '').trim(),
    createdBy: existing ? existing.createdBy : (user.nickname || user.email),
    createdAt: existing ? existing.createdAt
                        : Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm')
  };

  if (existing) updateRow_(ss, SHEETS.EOFFICE, existing._row, obj);
  else appendRow_(ss, SHEETS.EOFFICE, obj);

  // แจ้งเตือนผู้รับมอบหมาย (เฉพาะเมื่อเพิ่งถูกมอบหมาย/เปลี่ยนคน)
  var prevAssigned = existing ? String(existing.assignedTo || '').toLowerCase() : '';
  if (obj.assignedTo && obj.assignedTo !== prevAssigned &&
      obj.assignedTo !== String(user.email).toLowerCase()) {
    notify_(obj.assignedTo, 'มีหนังสือมอบหมายถึงคุณ',
      obj.type + (obj.docNo ? ' เลขที่ ' + obj.docNo : '') + ' เรื่อง: ' + obj.subject +
      (obj.deadline ? ' (กำหนดเสร็จ ' + obj.deadline + ')' : ''), '', true);
  }

  logAction_(user.email, existing ? 'eoffice.edit' : 'eoffice.add', obj.id + ' ' + obj.subject);
  return { ok: true, id: obj.id, isNew: !existing };
}

function publicEDoc_(r) {
  return {
    id: r.id,
    type: r.type,
    docNo: String(r.docNo || ''),
    subject: r.subject || '',
    sender: r.sender || '',
    receiver: r.receiver || '',
    docDate: toDateKey_(r.docDate),
    priority: r.priority || 'ปกติ',
    status: r.status || 'ลงทะเบียน',
    assignedTo: String(r.assignedTo || '').toLowerCase(),
    deadline: toDateKey_(r.deadline),
    remarks: r.remarks || '',
    fileUrl: r.fileUrl || '',
    createdBy: r.createdBy || '',
    createdAt: fmtDateTime_(r.createdAt)
  };
}
