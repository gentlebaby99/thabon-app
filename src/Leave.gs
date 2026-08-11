/**
 * Leave.gs — ระบบลา (ยื่นลา → ผอ./แอดมิน อนุมัติขั้นเดียว)
 *
 * ทุกคนที่ล็อกอินยื่นลาได้ · ผู้อนุมัติ = role principal หรือ admin
 * แจ้งเตือนในแอป + อีเมล ทั้งตอนมีใบลาใหม่ และตอนมีผลอนุมัติ
 */

/** ข้อมูลเริ่มต้นหน้าระบบลา */
function leaveInit_(user) {
  assertCanAccess_(user, 'leave');
  var out = {
    types: LEAVE_TYPES,
    canApprove: canApprove_(user),
    myLeaves: getMyLeaves_(user)
  };
  if (out.canApprove) out.pending = listPending_(user);
  return out;
}

function getMyLeaves_(user) {
  var email = String(user.email).toLowerCase();
  var rows = readTable_(leaveSS_(), SHEETS.LEAVES)
    .filter(function (r) { return String(r.userEmail).toLowerCase() === email; })
    .map(publicLeave_);
  rows.sort(function (a, b) { return (b.submitDate || '').localeCompare(a.submitDate || ''); });
  return rows;
}

/** ใบลาที่รออนุมัติทั้งหมด (เฉพาะผู้อนุมัติ) */
function listPending_(user) {
  if (!canApprove_(user)) return [];
  var rows = readTable_(leaveSS_(), SHEETS.LEAVES)
    .filter(function (r) { return r.status === LEAVE_STATUS.PENDING; })
    .map(publicLeave_);
  rows.sort(function (a, b) { return (a.submitDate || '').localeCompare(b.submitDate || ''); });
  return rows;
}

/** ยื่นใบลา */
function submitLeave_(user, p) {
  assertCanAccess_(user, 'leave');
  if (LEAVE_TYPES.indexOf(p.type) === -1) throw new Error('ประเภทการลาไม่ถูกต้อง');
  var start = String(p.startDate || '').slice(0, 10);
  var end = String(p.endDate || '').slice(0, 10);
  if (!start || !end) throw new Error('กรุณาเลือกวันเริ่มและวันสิ้นสุด');
  if (end < start) throw new Error('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
  if (!p.reason || !String(p.reason).trim()) throw new Error('กรุณากรอกเหตุผลการลา');

  var days = parseFloat(p.days);
  if (!days || days <= 0) days = daysBetween_(start, end);

  var now = new Date();
  var id = newId_('LV');
  appendRow_(leaveSS_(), SHEETS.LEAVES, {
    id: id, userEmail: user.email, userName: user.nickname || user.email,
    type: p.type, startDate: start, endDate: end, days: days,
    reason: String(p.reason).trim(), attachmentUrl: p.attachmentUrl || '',
    status: LEAVE_STATUS.PENDING, approverEmail: '', approverNote: '',
    submitDate: Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), decidedDate: ''
  });

  // แจ้งผู้อนุมัติทุกคน
  var title = 'ใบลาใหม่รออนุมัติ';
  var msg = (user.nickname || user.email) + ' ยื่น' + p.type + ' ' + start +
            (start !== end ? ' ถึง ' + end : '') + ' (' + days + ' วัน)';
  getApprovers_().forEach(function (a) {
    if (String(a.email).toLowerCase() === String(user.email).toLowerCase()) return;
    notify_(a.email, title, msg, '', true);
  });

  logAction_(user.email, 'leave.submit', id + ' ' + p.type);
  return { ok: true, id: id };
}

/** อนุมัติ/ไม่อนุมัติใบลา (เฉพาะผู้อนุมัติ) */
function decideLeave_(user, id, decision, note) {
  if (!canApprove_(user)) { var e = new Error('NO_ACCESS'); e.code = 'NO_ACCESS'; throw e; }
  var status = decision === 'approve' ? LEAVE_STATUS.APPROVED : LEAVE_STATUS.REJECTED;
  var leave = leaveSS_();
  var rows = readTable_(leave, SHEETS.LEAVES);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      if (rows[i].status !== LEAVE_STATUS.PENDING) throw new Error('ใบลานี้ถูกดำเนินการไปแล้ว');
      rows[i].status = status;
      rows[i].approverEmail = user.email;
      rows[i].approverNote = note || '';
      rows[i].decidedDate = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
      updateRow_(leave, SHEETS.LEAVES, rows[i]._row, rows[i]);

      // แจ้งผู้ยื่น
      var title = 'ผลการพิจารณาใบลา: ' + status;
      var msg = 'ใบ' + rows[i].type + ' วันที่ ' + toDateKey_(rows[i].startDate) +
                ' ได้รับการ' + status + 'โดย ' + (user.nickname || user.email) +
                (note ? ' (หมายเหตุ: ' + note + ')' : '');
      notify_(rows[i].userEmail, title, msg, '', true);

      logAction_(user.email, 'leave.decide', id + '=' + status);
      return { ok: true, status: status };
    }
  }
  throw new Error('ไม่พบใบลา');
}

/** ผู้ยื่นยกเลิกใบลาของตัวเอง (เฉพาะที่ยังรออนุมัติ) */
function cancelLeave_(user, id) {
  var leave = leaveSS_();
  var rows = readTable_(leave, SHEETS.LEAVES);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      if (String(rows[i].userEmail).toLowerCase() !== String(user.email).toLowerCase())
        throw new Error('ยกเลิกได้เฉพาะใบลาของตนเอง');
      if (rows[i].status !== LEAVE_STATUS.PENDING) throw new Error('ยกเลิกได้เฉพาะใบลาที่ยังรออนุมัติ');
      rows[i].status = LEAVE_STATUS.CANCELLED;
      rows[i].decidedDate = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
      updateRow_(leave, SHEETS.LEAVES, rows[i]._row, rows[i]);
      logAction_(user.email, 'leave.cancel', id);
      return { ok: true };
    }
  }
  throw new Error('ไม่พบใบลา');
}

// ── ตัวช่วย ────────────────────────────────────────────────────
function daysBetween_(start, end) {
  var a = new Date(start + 'T00:00:00');
  var b = new Date(end + 'T00:00:00');
  return Math.floor((b - a) / 86400000) + 1;
}

function getApprovers_() {
  return readTable_(coreSS_(), SHEETS.USERS)
    .filter(function (u) {
      var active = !(u.active === false || u.active === 'FALSE');
      return active && (u.role === 'principal' || u.role === 'admin');
    })
    .map(function (u) { return { email: String(u.email).toLowerCase(), name: u.nickname || u.email }; });
}

/** แปลงวันเวลาที่อาจเป็น Date ให้เป็น 'yyyy-MM-dd HH:mm' */
function fmtDateTime_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
  return String(v || '');
}

function publicLeave_(r) {
  return {
    id: r.id,
    userEmail: String(r.userEmail).toLowerCase(),
    userName: r.userName || '',
    type: r.type,
    startDate: toDateKey_(r.startDate),
    endDate: toDateKey_(r.endDate),
    days: r.days,
    reason: r.reason || '',
    attachmentUrl: r.attachmentUrl || '',
    status: r.status,
    approverNote: r.approverNote || '',
    submitDate: fmtDateTime_(r.submitDate),
    decidedDate: fmtDateTime_(r.decidedDate)
  };
}
