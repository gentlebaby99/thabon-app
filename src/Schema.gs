/**
 * Schema.gs — โครงสร้างตาราง (ชีต) ทั้งหมดของระบบ
 * กำหนดหัวคอลัมน์ไว้ที่เดียว เพื่อให้ตัวติดตั้งและตัวอ่าน-เขียนข้อมูลใช้ตรงกัน
 */

var SHEETS = {
  // ── ไฟล์กลาง (Core) ───────────────────────────────────────────
  USERS: {
    name: 'Users',
    headers: ['email', 'nickname', 'fullName', 'role', 'homeroom', 'extraPerms', 'active', 'createdAt']
  },
  STUDENTS: {
    name: 'Students',
    headers: ['studentId', 'classNo', 'prefix', 'firstName', 'lastName', 'fullName', 'grade', 'gradeOrder', 'active']
  },
  APPS: {
    name: 'Apps',
    headers: ['appId', 'name', 'icon', 'roles', 'status', 'order']
  },
  NOTIFICATIONS: {
    name: 'Notifications',
    headers: ['id', 'toEmail', 'title', 'message', 'link', 'read', 'createdAt']
  },
  CONFIG: {
    name: 'Config',
    headers: ['key', 'value']
  },
  LOG: {
    name: 'Log',
    headers: ['timestamp', 'email', 'action', 'detail']
  },

  // ── ไฟล์ระบบเช็คชื่อ (Attendance) ─────────────────────────────
  ATTENDANCE: {
    name: 'Attendance',
    // 1 แถว = นักเรียน 1 คน ต่อ 1 วัน (เก็บรายคน)
    headers: ['id', 'date', 'grade', 'studentId', 'studentName', 'status', 'note', 'recordedBy', 'createdAt']
  },

  // ── ไฟล์ระบบลา (Leave) ────────────────────────────────────────
  LEAVES: {
    name: 'Leaves',
    headers: ['id', 'userEmail', 'userName', 'type', 'startDate', 'endDate', 'days', 'reason',
              'attachmentUrl', 'status', 'approverEmail', 'approverNote', 'submitDate', 'decidedDate']
  },

  // ── ไฟล์ส่งแผนการสอน (LessonPlan) ─────────────────────────────
  LESSONPLANS: {
    name: 'LessonPlans',
    headers: ['id', 'teacherEmail', 'teacherName', 'monthYear', 'subject', 'fileUrl',
              'status', 'reviewerEmail', 'reviewNote', 'submitDate', 'reviewedDate']
  },

  // ── ไฟล์สารบรรณ (EOffice) ─────────────────────────────────────
  EOFFICE: {
    name: 'EOffice',
    headers: ['id', 'type', 'docNo', 'subject', 'sender', 'receiver', 'docDate', 'priority',
              'status', 'assignedTo', 'deadline', 'remarks', 'fileUrl', 'createdBy', 'createdAt']
  },

  // ── ไฟล์จัดเก็บเอกสาร 4 ฝ่าย (Documents) ─────────────────────
  DOCUMENTS: {
    name: 'Documents',
    headers: ['id', 'name', 'department', 'category', 'academicYear', 'description',
              'fileUrl', 'createdBy', 'createdAt']
  },

  // ── ไฟล์ผลสอบระดับชาติ (Exam) ─────────────────────────────────
  EXAM: {
    name: 'ExamResults',
    // 1 แถว = คะแนน 1 วิชา ของปี+การสอบหนึ่ง (โรงเรียน/เขต/ประเทศ)
    headers: ['id', 'year', 'testType', 'subject', 'scoreSchool', 'scoreArea', 'scoreNational',
              'note', 'createdBy', 'createdAt']
  }
};

var GRADE_ORDER_MAP = {
  'อ.2': 1, 'อ.3': 2, 'ป.1': 3, 'ป.2': 4, 'ป.3': 5, 'ป.4': 6, 'ป.5': 7, 'ป.6': 8
};
