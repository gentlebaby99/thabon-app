/**
 * Config.gs — ค่าตั้งค่าส่วนกลางของระบบโรงเรียนท่าบอนมิตรภาพที่ 90
 *
 * ระบบให้แพลตฟอร์ม Apps Script จัดการล็อกอิน Google เอง — ไม่ต้องตั้งค่า OAuth
 * ไฟล์ ID ต่าง ๆ ระบบจะสร้างและบันทึกให้อัตโนมัติเมื่อรัน setupSystem() — ไม่ต้องกรอกเอง
 */

var CONFIG = {
  // ── ข้อมูลโรงเรียน ─────────────────────────────────────────────
  SCHOOL_NAME: 'โรงเรียนท่าบอนมิตรภาพที่ 90',
  SCHOOL_SUB: 'อำเภอระโนด จังหวัดสงขลา · สพป.สงขลา เขต 1',
  ACADEMIC_YEAR: '2568',
  LOGO_URL: 'https://i.postimg.cc/cHTkz8tj/rong-re-ynth-a-bx-nm-tr-phaph-th-90.png',

  // ── บัญชีเจ้าของ/แอดมินเริ่มต้น ────────────────────────────────
  OWNER_EMAIL: 'gentleboy9@gmail.com',

  // ── ชื่อไฟล์ Google Sheet ที่ระบบจะสร้าง ───────────────────────
  CORE_FILE_NAME: 'TBS · ฐานข้อมูลกลาง (ห้ามลบ)',
  ATTENDANCE_FILE_NAME: 'TBS · ระบบเช็คชื่อมาเรียน',
  LEAVE_FILE_NAME: 'TBS · ระบบลา',
  LESSONPLAN_FILE_NAME: 'TBS · ส่งแผนการสอน',
  EOFFICE_FILE_NAME: 'TBS · สารบรรณ E-Office',
  DOCUMENTS_FILE_NAME: 'TBS · จัดเก็บเอกสาร',
  EXAM_FILE_NAME: 'TBS · ผลสอบ RT NT ONET',

  // ── ชื่อ Script Property ที่ใช้เก็บ ID ไฟล์ ────────────────────
  PROP_CORE_ID: 'CORE_SPREADSHEET_ID',
  PROP_ATTENDANCE_ID: 'ATTENDANCE_SPREADSHEET_ID',
  PROP_LEAVE_ID: 'LEAVE_SPREADSHEET_ID',
  PROP_LESSONPLAN_ID: 'LESSONPLAN_SPREADSHEET_ID',
  PROP_EOFFICE_ID: 'EOFFICE_SPREADSHEET_ID',
  PROP_DOCUMENTS_ID: 'DOCUMENTS_SPREADSHEET_ID',
  PROP_EXAM_ID: 'EXAM_SPREADSHEET_ID'
};

/** สถานะการเช็คชื่อที่ระบบรองรับ (แก้ลำดับ/ชื่อได้ที่นี่) */
var ATTENDANCE_STATUSES = ['มา', 'สาย', 'ลา', 'ขาด'];

/** ประเภทการลา (แก้/เพิ่มได้ที่นี่) */
var LEAVE_TYPES = ['ลาป่วย', 'ลากิจส่วนตัว', 'ลาพักผ่อน', 'ไปราชการ'];

/** สถานะใบลา */
var LEAVE_STATUS = { PENDING: 'รออนุมัติ', APPROVED: 'อนุมัติ', REJECTED: 'ไม่อนุมัติ', CANCELLED: 'ยกเลิก' };

/** สถานะแผนการสอน */
var LESSONPLAN_STATUS = { PENDING: 'รอตรวจ', PASSED: 'ผ่าน', REVISE: 'ให้แก้ไข' };

/** สารบรรณ E-Office */
var EOFFICE_TYPES = ['หนังสือรับเข้า', 'หนังสือส่งออก', 'หนังสือเวียน', 'คำสั่ง'];
var EOFFICE_PRIORITIES = ['ปกติ', 'ด่วน', 'ด่วนมาก', 'ด่วนที่สุด'];
var EOFFICE_STATUSES = ['ลงทะเบียน', 'กำลังดำเนินการ', 'เสร็จสิ้น'];

/** จัดเก็บเอกสาร 4 ฝ่าย */
var DOC_DEPARTMENTS = ['ฝ่ายวิชาการ', 'ฝ่ายงบประมาณ', 'ฝ่ายบริหารงานบุคคล', 'ฝ่ายบริหารทั่วไป'];
var DOC_CATEGORIES = ['หนังสือราชการ', 'คำสั่ง', 'รายงาน', 'แบบฟอร์ม', 'แผนงาน', 'ทั่วไป'];

/** ผลสอบระดับชาติ */
var EXAM_TYPES = ['RT', 'NT', 'O-NET'];
var EXAM_SUBJECTS = {
  'RT':    ['อ่านออกเสียง', 'อ่านรู้เรื่อง', 'รวม'],
  'NT':    ['คณิตศาสตร์', 'ภาษาไทย', 'รวม'],
  'O-NET': ['ภาษาไทย', 'คณิตศาสตร์', 'วิทยาศาสตร์', 'ภาษาอังกฤษ', 'รวม']
};

/** ระดับชั้นทั้งหมด เรียงตามลำดับ (ใช้ทำเมนู/รายงาน) */
var GRADES = ['อ.2', 'อ.3', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'];

/**
 * ทะเบียนระบบย่อย (โมดูล) — เพิ่มระบบใหม่ในอนาคตแค่เพิ่มรายการที่นี่
 * roles: บทบาทที่เข้าถึงได้ ('*' = ทุกคนที่ล็อกอิน)
 * status: 'active' = ใช้งานได้, 'soon' = แสดงปุ่มแต่ยังไม่เปิด
 */
var APPS_REGISTRY = [
  { id: 'attendance', name: 'เช็คชื่อมาเรียน', icon: '📋', roles: ['admin', 'teacher', 'principal'], status: 'active' },
  { id: 'leave',      name: 'ระบบลา',          icon: '📝', roles: ['*'],                              status: 'active' },
  { id: 'lessonplan', name: 'ส่งแผนการสอน',    icon: '📚', roles: ['admin', 'teacher', 'principal'], status: 'active' },
  { id: 'eoffice',    name: 'สารบรรณ E-Office', icon: '📨', roles: ['admin', 'staff', 'principal'],   status: 'active' },
  { id: 'documents',  name: 'จัดเก็บเอกสาร',    icon: '🗂️', roles: ['admin', 'staff', 'principal'],   status: 'active' },
  { id: 'exam',       name: 'ผลสอบ RT/NT/ONET', icon: '📊', roles: ['admin', 'teacher', 'principal'], status: 'active' },
  { id: 'admin',      name: 'ผู้ดูแลระบบ',      icon: '⚙️', roles: ['admin'],                        status: 'active' }
];
