/**
 * LessonPlan.gs — ระบบส่งแผนการสอน
 *
 * ครูส่งแผนรายเดือน (แนบลิงก์ไฟล์) → ผอ./แอดมิน ตรวจ: ผ่าน / ให้แก้ไข
 * แจ้งเตือนอีเมลสองทางเหมือนระบบลา
 */

function lessonplanInit_(user) {
  assertCanAccess_(user, 'lessonplan');
  var out = {
    canReview: canApprove_(user),
    statuses: LESSONPLAN_STATUS,
    mySubmissions: getMySubmissions_(user)
  };
  if (out.canReview) out.pendingReview = listPendingPlans_(user);
  return out;
}

function getMySubmissions_(user) {
  var email = String(user.email).toLowerCase();
  var rows = readTable_(lessonplanSS_(), SHEETS.LESSONPLANS)
    .filter(function (r) { return String(r.teacherEmail).toLowerCase() === email; })
    .map(publicPlan_);
  rows.sort(function (a, b) { return (b.submitDate || '').localeCompare(a.submitDate || ''); });
  return rows;
}

function listPendingPlans_(user) {
  if (!canApprove_(user)) return [];
  var rows = readTable_(lessonplanSS_(), SHEETS.LESSONPLANS)
    .filter(function (r) { return r.status === LESSONPLAN_STATUS.PENDING; })
    .map(publicPlan_);
  rows.sort(function (a, b) { return (a.submitDate || '').localeCompare(b.submitDate || ''); });
  return rows;
}

/** ครูส่งแผนการสอน */
function submitPlan_(user, p) {
  assertCanAccess_(user, 'lessonplan');
  if (!p.monthYear) throw new Error('กรุณาเลือกเดือน');
  if (!p.fileUrl || !String(p.fileUrl).trim()) throw new Error('กรุณาแนบลิงก์ไฟล์แผนการสอน');

  var id = newId_('LP');
  appendRow_(lessonplanSS_(), SHEETS.LESSONPLANS, {
    id: id, teacherEmail: user.email, teacherName: user.nickname || user.email,
    monthYear: String(p.monthYear), subject: (p.subject || '').trim(),
    fileUrl: String(p.fileUrl).trim(),
    status: LESSONPLAN_STATUS.PENDING, reviewerEmail: '', reviewNote: '',
    submitDate: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), reviewedDate: ''
  });

  var msg = (user.nickname || user.email) + ' ส่งแผนการสอนเดือน ' + p.monthYear +
            (p.subject ? ' วิชา' + p.subject : '');
  getApprovers_().forEach(function (a) {
    if (String(a.email).toLowerCase() === String(user.email).toLowerCase()) return;
    notify_(a.email, 'แผนการสอนใหม่รอตรวจ', msg, '', true);
  });

  logAction_(user.email, 'lessonplan.submit', id + ' ' + p.monthYear);
  return { ok: true, id: id };
}

/** ผอ./แอดมิน ตรวจแผน */
function reviewPlan_(user, id, decision, note) {
  if (!canApprove_(user)) { var e = new Error('NO_ACCESS'); e.code = 'NO_ACCESS'; throw e; }
  var status = decision === 'pass' ? LESSONPLAN_STATUS.PASSED : LESSONPLAN_STATUS.REVISE;
  var ss = lessonplanSS_();
  var rows = readTable_(ss, SHEETS.LESSONPLANS);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      if (rows[i].status !== LESSONPLAN_STATUS.PENDING) throw new Error('แผนนี้ถูกตรวจไปแล้ว');
      rows[i].status = status;
      rows[i].reviewerEmail = user.email;
      rows[i].reviewNote = note || '';
      rows[i].reviewedDate = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
      updateRow_(ss, SHEETS.LESSONPLANS, rows[i]._row, rows[i]);

      var msg = 'แผนการสอนเดือน ' + rows[i].monthYear + ' ผลการตรวจ: ' + status +
                (note ? ' (หมายเหตุ: ' + note + ')' : '');
      notify_(rows[i].teacherEmail, 'ผลการตรวจแผนการสอน: ' + status, msg, '', true);

      logAction_(user.email, 'lessonplan.review', id + '=' + status);
      return { ok: true, status: status };
    }
  }
  throw new Error('ไม่พบแผนการสอน');
}

/** ครูส่งแผนแก้ไขแล้วส่งใหม่ได้ — ยกเลิกของเดิมที่ยังรอตรวจ */
function cancelPlan_(user, id) {
  var ss = lessonplanSS_();
  var rows = readTable_(ss, SHEETS.LESSONPLANS);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      if (String(rows[i].teacherEmail).toLowerCase() !== String(user.email).toLowerCase())
        throw new Error('ยกเลิกได้เฉพาะของตนเอง');
      if (rows[i].status !== LESSONPLAN_STATUS.PENDING) throw new Error('ยกเลิกได้เฉพาะที่ยังรอตรวจ');
      deleteRow_(ss, SHEETS.LESSONPLANS, rows[i]._row);
      logAction_(user.email, 'lessonplan.cancel', id);
      return { ok: true };
    }
  }
  throw new Error('ไม่พบแผนการสอน');
}

function publicPlan_(r) {
  return {
    id: r.id,
    teacherEmail: String(r.teacherEmail).toLowerCase(),
    teacherName: r.teacherName || '',
    monthYear: String(r.monthYear || ''),
    subject: r.subject || '',
    fileUrl: r.fileUrl || '',
    status: r.status,
    reviewNote: r.reviewNote || '',
    submitDate: fmtDateTime_(r.submitDate),
    reviewedDate: fmtDateTime_(r.reviewedDate)
  };
}
