/**
 * Permissions.gs — สิทธิ์การเข้าถึงระบบย่อย
 *
 * โมเดล: ตามบทบาท (role) + ปรับเพิ่มรายคน (extraPerms)
 *   - admin, principal : เห็นทุกระบบ
 *   - teacher, staff   : เห็นเฉพาะระบบที่ระบุบทบาทไว้ในทะเบียน Apps
 *   - extraPerms       : รายชื่อ appId คั่นด้วยจุลภาค ที่ให้สิทธิ์เพิ่มเป็นรายคน
 */

/** คืนรายการระบบย่อยที่ผู้ใช้คนนี้เข้าถึงได้ (พร้อมสถานะ) */
function appsForUser_(user) {
  var apps = readTable_(coreSS_(), SHEETS.APPS);
  var extra = String(user.extraPerms || '').split(',').map(function (s) { return s.trim(); });
  var out = [];
  apps.sort(function (a, b) { return (a.order || 99) - (b.order || 99); });
  apps.forEach(function (a) {
    if (canAccessApp_(user, a, extra)) {
      out.push({ id: a.appId, name: a.name, icon: a.icon, status: a.status });
    }
  });
  return out;
}

function canAccessApp_(user, app, extra) {
  var roles = String(app.roles || '').split(',').map(function (s) { return s.trim(); });
  if (roles.indexOf('*') !== -1) return true;
  if (roles.indexOf(user.role) !== -1) return true;
  if (extra && extra.indexOf(app.appId) !== -1) return true;
  // admin เห็นทุกระบบ · ผอ. เห็นทุกระบบ "ยกเว้น" ระบบเฉพาะแอดมิน
  if (user.role === 'admin') return true;
  if (user.role === 'principal' && roles.indexOf('admin') === -1) return true;
  return false;
}

/** ตรวจสิทธิ์เข้าระบบใดระบบหนึ่ง (โยน error ถ้าไม่มีสิทธิ์) */
function assertCanAccess_(user, appId) {
  var apps = appsForUser_(user);
  for (var i = 0; i < apps.length; i++) {
    if (apps[i].id === appId) return true;
  }
  var e = new Error('NO_ACCESS'); e.code = 'NO_ACCESS'; throw e;
}

function isAdmin_(user) { return user.role === 'admin'; }
function isPrincipal_(user) { return user.role === 'principal'; }
function canApprove_(user) { return user.role === 'admin' || user.role === 'principal'; }
