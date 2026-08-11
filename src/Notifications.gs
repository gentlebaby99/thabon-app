/**
 * Notifications.gs — แจ้งเตือนในแอป + อีเมล
 * (โครงพื้นฐาน ใช้เต็มรูปแบบเมื่อเริ่มระบบลา/แผนการสอน)
 */

/** สร้างแจ้งเตือนถึงผู้ใช้คนหนึ่ง (ในแอป + ส่งอีเมลถ้า sendEmail=true) */
function notify_(toEmail, title, message, link, sendEmail) {
  appendRow_(coreSS_(), SHEETS.NOTIFICATIONS, {
    id: newId_('NTF'), toEmail: String(toEmail).toLowerCase(), title: title,
    message: message, link: link || '', read: false, createdAt: new Date()
  });
  if (sendEmail) {
    try {
      MailApp.sendEmail({
        to: toEmail,
        subject: '[ระบบโรงเรียนท่าบอน] ' + title,
        htmlBody: '<p>' + message + '</p>' + (link ? '<p><a href="' + link + '">เปิดระบบ</a></p>' : '')
      });
    } catch (e) { /* โควตาอีเมลหมด/ล้มเหลว ไม่ให้กระทบการทำงานหลัก */ }
  }
}

/** นับจำนวนแจ้งเตือนที่ยังไม่อ่านของผู้ใช้ */
function countUnread_(email) {
  email = String(email || '').toLowerCase();
  var rows = readTable_(coreSS_(), SHEETS.NOTIFICATIONS);
  var n = 0;
  rows.forEach(function (r) {
    if (String(r.toEmail).toLowerCase() === email && !(r.read === true || r.read === 'TRUE')) n++;
  });
  return n;
}

/**
 * รายการแจ้งเตือนของผู้ใช้ (ใหม่สุดก่อน สูงสุด 50) + ทำเครื่องหมายอ่านแล้วทั้งหมด
 * เรียกตอนผู้ใช้กดกระดิ่ง
 */
function listAndReadNotifications_(user) {
  var email = String(user.email).toLowerCase();
  var core = coreSS_();
  var rows = readTable_(core, SHEETS.NOTIFICATIONS)
    .filter(function (r) { return String(r.toEmail).toLowerCase() === email; });

  var out = rows.map(function (r) {
    return {
      title: r.title || '',
      message: r.message || '',
      createdAt: fmtDateTime_(r.createdAt),
      unread: !(r.read === true || r.read === 'TRUE')
    };
  });
  out.sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

  // ทำเครื่องหมายว่าอ่านแล้ว
  rows.forEach(function (r) {
    if (!(r.read === true || r.read === 'TRUE')) {
      r.read = true;
      updateRow_(core, SHEETS.NOTIFICATIONS, r._row, r);
    }
  });

  return out.slice(0, 50);
}
