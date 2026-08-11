/**
 * SeedUsers.gs — บัญชีผู้ใช้เริ่มต้น (5 คนแรก)
 *
 * เพิ่ม/แก้ผู้ใช้ได้ 2 ทาง:
 *   1) แก้ในแอป หน้า "ผู้ดูแลระบบ" (แนะนำ — ทำได้หลังติดตั้ง)
 *   2) แก้อาเรย์ด้านล่างนี้ แล้วรัน reseedUsers() อีกครั้ง
 *
 * รูปแบบ: { email, nickname, fullName, role, homeroom, active }
 *   role     : 'admin' | 'principal' | 'teacher' | 'staff'
 *   homeroom : ห้องที่เป็นครูประจำชั้น เช่น 'ป.3' (ว่างได้ถ้าไม่ได้ประจำชั้น)
 *
 * หมายเหตุ: อีเมลจะถูกเทียบแบบไม่สนตัวพิมพ์เล็ก-ใหญ่ (ระบบแปลงเป็นตัวพิมพ์เล็กให้เอง)
 */

function SEED_USERS_() {
  return [
    { email: 'gentleboy9@gmail.com',      nickname: 'ครูเหวิน',   fullName: '', role: 'admin',   homeroom: '', active: true },
    { email: 'oppo0936028382@gmail.com',  nickname: 'ครูน้ำ',     fullName: '', role: 'teacher',  homeroom: '', active: true },
    { email: 'Jumza55@gmail.com',         nickname: 'ครูจุ๋ม',    fullName: '', role: 'teacher',  homeroom: '', active: true },
    { email: 'Sunisa2700@gmail.com',      nickname: 'ครูหนูแดง',  fullName: '', role: 'teacher',  homeroom: '', active: true },
    { email: 'urai80308@gmail.com',       nickname: 'ครูไก่',     fullName: '', role: 'teacher',  homeroom: '', active: true }
  ];
}
