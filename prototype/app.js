let submissions = [];
let fileInfo = null;

function toggleTheme() {
  document.body.classList.toggle('dark');
  document.body.classList.toggle('light');
}

function handleFile(input) {
  const status = document.getElementById('upload-status');
  if (!input.files || input.files.length === 0) { status.textContent = ''; status.className = 'upload-status'; return; }
  const f = input.files[0];
  const ok = f.type === 'application/pdf' || f.name.endsWith('.docx') || f.name.endsWith('.pdf');
  if (!ok) {
    status.textContent = 'อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
    status.className = 'upload-status err';
    fileInfo = null; return;
  }
  fileInfo = { name: f.name, size: (f.size / 1024).toFixed(1) + ' KB', type: f.type || 'PDF/DOCX' };
  status.innerHTML = `<i class="ph-fill ph-check-circle"></i> <strong>อัปโหลดไฟล์สำเร็จ!</strong><br>ชื่อไฟล์: ${f.name}<br>ไฟล์พร้อมสำหรับการส่ง`;
  status.className = 'upload-status ok';
}

function submitPlan() {
  const teacher = document.getElementById('teacher').value;
  const month = document.getElementById('month').value;
  const subject = document.getElementById('subject').value;
  if (!teacher || !month || !subject || !fileInfo) {
    alert('กรุณากรอกข้อมูลให้ครบและอัปโหลดไฟล์'); return;
  }
  submissions.push({ id: Date.now(), teacher, month, subject, file: fileInfo, date: new Date().toLocaleDateString('th-TH'), status: 'pending' });
  alert('ส่งแผนการจัดการเรียนรู้เรียบร้อยแล้ว\nครู: ' + teacher + '\nรายวิชา: ' + subject + '\nเดือน: ' + month + '\nไฟล์: ' + fileInfo.name);
  fileInfo = null;
  document.getElementById('upload-status').textContent = '';
  document.getElementById('upload-status').className = 'upload-status';
  document.getElementById('file-input').value = '';
}

function loginDirector() {
  const pwd = document.getElementById('pwd').value;
  if (pwd === 'admin') {
    document.getElementById('login-msg').textContent = '';
    document.getElementById('director-login').classList.add('hidden');
    document.getElementById('teacher-view').classList.add('hidden');
    document.getElementById('director-dash').classList.remove('hidden');
    renderDash();
  } else {
    document.getElementById('login-msg').textContent = 'รหัสผ่านไม่ถูกต้อง';
  }
}

function logout() {
  document.getElementById('director-dash').classList.add('hidden');
  document.getElementById('director-login').classList.remove('hidden');
  document.getElementById('teacher-view').classList.remove('hidden');
  document.getElementById('pwd').value = '';
}

function renderDash() {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  document.getElementById('sum-submitted').textContent = submissions.length;
  document.getElementById('sum-pending').textContent = submissions.filter(s => s.status === 'pending').length;
  document.getElementById('sum-approved').textContent = submissions.filter(s => s.status === 'approved').length;
  document.getElementById('sum-revision').textContent = submissions.filter(s => s.status === 'revision').length;
  submissions.forEach(s => {
    const tr = document.createElement('tr');
    const statusClass = s.status === 'pending' ? 'pending' : s.status === 'approved' ? 'approved' : 'revision';
    const statusText = s.status === 'pending' ? 'รอตรวจ' : s.status === 'approved' ? 'อนุมัติแล้ว' : 'ส่งกลับแก้ไข';
    tr.innerHTML = `<td>${s.teacher}</td><td>${s.subject}</td><td>${s.month}</td><td>${s.date}</td><td>${s.file.name}</td><td><span class="status ${statusClass}">${statusText}</span></td><td><button class="btn-outline" onclick="approve(${s.id})">อนุมัติ</button> <button class="btn-outline" onclick="revise(${s.id})">ส่งกลับแก้ไข</button></td>`;
    tbody.appendChild(tr);
  });
}

function approve(id) {
  const s = submissions.find(x => x.id === id);
  if (s) { s.status = 'approved'; alert('อนุมัติแผนการจัดการเรียนรู้เรียบร้อยแล้ว'); renderDash(); }
}
function revise(id) {
  const s = submissions.find(x => x.id === id);
  if (s) { const reason = prompt('เหตุผลที่ส่งกลับแก้ไข'); if (reason !== null) { s.status = 'revision'; alert('ส่งแผนกลับเพื่อแก้ไขเรียบร้อยแล้ว'); renderDash(); } }
}
