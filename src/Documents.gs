/**
 * Documents.gs — ระบบจัดเก็บเอกสาร 4 ฝ่าย
 * คลังเอกสารกลาง แยกตามฝ่าย/หมวดหมู่/ปีการศึกษา ค้นหา-กรองได้
 */

function documentsInit_(user) {
  assertCanAccess_(user, 'documents');
  return {
    departments: DOC_DEPARTMENTS,
    categories: DOC_CATEGORIES,
    docs: listDocuments_(user)
  };
}

function listDocuments_(user) {
  var rows = readTable_(documentsSS_(), SHEETS.DOCUMENTS).map(publicDoc_);
  rows.sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
  return rows;
}

/** เพิ่ม/แก้เอกสาร */
function saveDocument_(user, p) {
  assertCanAccess_(user, 'documents');
  if (!p.name || !String(p.name).trim()) throw new Error('กรุณากรอกชื่อเอกสาร');
  if (DOC_DEPARTMENTS.indexOf(p.department) === -1) throw new Error('ฝ่ายไม่ถูกต้อง');
  if (DOC_CATEGORIES.indexOf(p.category) === -1) throw new Error('หมวดหมู่ไม่ถูกต้อง');
  if (!p.fileUrl || !String(p.fileUrl).trim()) throw new Error('กรุณาแนบลิงก์ไฟล์เอกสาร');

  var ss = documentsSS_();
  var rows = readTable_(ss, SHEETS.DOCUMENTS);
  var existing = null;
  if (p.id) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === p.id) { existing = rows[i]; break; }
    }
    if (!existing) throw new Error('ไม่พบเอกสารที่จะแก้ไข');
  }

  var obj = {
    id: existing ? existing.id : newId_('DOC'),
    name: String(p.name).trim(),
    department: p.department,
    category: p.category,
    academicYear: String(p.academicYear || CONFIG.ACADEMIC_YEAR),
    description: (p.description || '').trim(),
    fileUrl: String(p.fileUrl).trim(),
    createdBy: existing ? existing.createdBy : (user.nickname || user.email),
    createdAt: existing ? existing.createdAt
                        : Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm')
  };

  if (existing) updateRow_(ss, SHEETS.DOCUMENTS, existing._row, obj);
  else appendRow_(ss, SHEETS.DOCUMENTS, obj);

  logAction_(user.email, existing ? 'documents.edit' : 'documents.add', obj.id + ' ' + obj.name);
  return { ok: true, id: obj.id, isNew: !existing };
}

/** ลบเอกสาร (เฉพาะแอดมิน หรือคนที่เพิ่มเอง) */
function deleteDocument_(user, id) {
  var ss = documentsSS_();
  var rows = readTable_(ss, SHEETS.DOCUMENTS);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      var isOwner = rows[i].createdBy === (user.nickname || user.email);
      if (!isAdmin_(user) && !isOwner) throw new Error('ลบได้เฉพาะเอกสารที่ตนเองเพิ่ม');
      deleteRow_(ss, SHEETS.DOCUMENTS, rows[i]._row);
      logAction_(user.email, 'documents.delete', id);
      return { ok: true };
    }
  }
  throw new Error('ไม่พบเอกสาร');
}

function publicDoc_(r) {
  return {
    id: r.id,
    name: r.name || '',
    department: r.department || '',
    category: r.category || '',
    academicYear: String(r.academicYear || ''),
    description: r.description || '',
    fileUrl: r.fileUrl || '',
    createdBy: r.createdBy || '',
    createdAt: fmtDateTime_(r.createdAt)
  };
}
