#!/usr/bin/env python3
"""
compare_project.py — เปรียบเทียบโค้ด Apps Script 2 โฟลเดอร์
ใช้ตรวจว่าโค้ดบนเครื่อง (src/) ตรงกับที่ pull มาจาก Google (deployed/) หรือไม่

วิธีใช้:
  python compare_project.py <โฟลเดอร์ A> <โฟลเดอร์ B> [--hash-only]

normalize: CRLF -> LF, ตัดช่องว่างท้ายบรรทัด, ตัดบรรทัดว่างสุดท้าย
(กันความต่างจาก encoding/windows line-ending ที่ไม่ใช่ความต่างจริงของโค้ด)
"""
import sys, os, hashlib, difflib

def norm(text: str) -> str:
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    lines = [ln.rstrip() for ln in text.split('\n')]
    while lines and lines[-1] == '':
        lines.pop()
    return '\n'.join(lines) + '\n'

def load(path: str):
    with open(path, 'rb') as f:
        raw = f.read()
    if raw.startswith(b'\xef\xbb\xbf'):
        raw = raw[3:]  # strip BOM
    return norm(raw.decode('utf-8', errors='replace'))

def sha(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()[:12]

def main():
    a_dir, b_dir = sys.argv[1], sys.argv[2]
    hash_only = '--hash-only' in sys.argv

    a_files = {f for f in os.listdir(a_dir) if os.path.isfile(os.path.join(a_dir, f))}
    b_files = {f for f in os.listdir(b_dir) if os.path.isfile(os.path.join(b_dir, f))}

    only_a = sorted(a_files - b_files)
    only_b = sorted(b_files - a_files)
    common = sorted(a_files & b_files)

    print(f'== {a_dir}  (A)  vs  {b_dir}  (B) ==')
    print(f'ไฟล์เฉพาะ A (ไม่มีใน B): {only_a if only_a else "-"}')
    print(f'ไฟล์เฉพาะ B (ไม่มีใน A): {only_b if only_b else "-"}')
    print(f'ไฟล์ร่วม: {len(common)} ไฟล์\n')

    same, diff = [], []
    for f in common:
        ta, tb = load(os.path.join(a_dir, f)), load(os.path.join(b_dir, f))
        if ta == tb:
            same.append(f)
        else:
            diff.append((f, ta, tb))

    print(f'== ไฟล์เหมือนกัน: {len(same)} ==')
    for f in same:
        print(f'  ✓ {f}')

    print(f'\n== ไฟล์ต่างกัน: {len(diff)} ==')
    for f, ta, tb in diff:
        la, lb = ta.count('\n'), tb.count('\n')
        print(f'\n  ✗ {f}  (A: {la} บรรทัด sha={sha(ta)} | B: {lb} บรรทัด sha={sha(tb)})')
        if hash_only:
            continue
        # แสดง diff แบบรวม (สูงสุด 30 บรรทัด)
        dm = difflib.unified_diff(
            ta.splitlines(), tb.splitlines(),
            fromfile=f'  A ({a_dir})', tofile=f'  B ({b_dir})', lineterm='', n=1)
        shown = 0
        for ln in dm:
            if shown >= 30:
                print('  ... (ตัด แสดง 30 บรรทัดแรก)')
                break
            if ln.startswith(('---', '+++', '@@')):
                print('  ' + ln)
            elif ln.startswith('-'):
                print('  ' + ln[:120])
            elif ln.startswith('+'):
                print('  ' + ln[:120])
            else:
                print('  ' + ln[:120])
            shown += 1

    print('\n== สรุป =================================================================')
    if only_a or only_b or diff:
        print('⚠️  โค้ด 2 โฟลเดอร์ไม่ตรงกัน — ต้องหาสาเหตุ (ดูด้านบน)')
    else:
        print('✅ โค้ดทั้งสองโฟลเดอร์ตรงกันทุกไฟล์')

if __name__ == '__main__':
    main()
