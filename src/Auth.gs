/**
 * Auth.gs — การยืนยันตัวตน (ให้แพลตฟอร์ม Apps Script จัดการล็อกอิน Google เอง)
 *
 * เว็บแอปตั้งค่า "execute as: ผู้ใช้ที่เข้าถึง" + "ต้องเข้าสู่ระบบด้วยบัญชี Google"
 * ดังนั้นทุกครั้งที่หน้าเว็บเรียกเซิร์ฟเวอร์ ระบบรู้ได้ทันทีว่าเป็นอีเมลใคร
 * ผ่าน Session.getActiveUser() — ปลอมไม่ได้ ไม่ต้องตั้งค่า OAuth เพิ่ม
 */

/** อีเมลของผู้ใช้ที่กำลังเข้าใช้งาน (ตัวพิมพ์เล็ก) หรือ '' ถ้าไม่ทราบ */
function currentEmail_() {
  var email = '';
  try { email = Session.getActiveUser().getEmail(); } catch (e) {}
  return String(email || '').toLowerCase();
}

/** ค้นผู้ใช้จากอีเมล — คืน object หรือ null */
function getUserByEmail_(email) {
  email = String(email || '').toLowerCase();
  if (!email) return null;
  var users = readTable_(coreSS_(), SHEETS.USERS);
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase() === email) return users[i];
  }
  return null;
}

/**
 * ตัวช่วยหลัก: คืน user object ที่ยัง active ของผู้ใช้ปัจจุบัน
 * โยน error รหัสต่าง ๆ เพื่อให้หน้าเว็บแสดงข้อความที่เหมาะสม
 */
function requireUser_() {
  var email = currentEmail_();
  if (!email) { var e = new Error('NOT_LOGGED_IN'); e.code = 'NOT_LOGGED_IN'; throw e; }
  var user = getUserByEmail_(email);
  if (!user) { var e2 = new Error('NOT_MEMBER'); e2.code = 'NOT_MEMBER'; e2.email = email; throw e2; }
  if (user.active === false || user.active === 'FALSE') {
    var e3 = new Error('DISABLED'); e3.code = 'DISABLED'; throw e3;
  }
  return user;
}

/** แปลง user (แถวชีต) เป็นข้อมูลที่ส่งให้หน้าเว็บ */
function publicUser_(user) {
  return {
    email: user.email,
    nickname: user.nickname || user.email,
    fullName: user.fullName || '',
    role: user.role || 'teacher',
    homeroom: user.homeroom || '',
    roleLabel: roleLabel_(user.role)
  };
}

function roleLabel_(role) {
  return ({ admin: 'ผู้ดูแลระบบ', principal: 'ผู้อำนวยการ', teacher: 'ครู', staff: 'บุคลากร' })[role] || 'ครู';
}
