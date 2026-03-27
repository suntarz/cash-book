# Cash Book — Deploy (GitHub Pages + Google Sheet)

แอปรันบน **GitHub Pages** (ไฟล์ `index.html` + `css/` + `js/`) ข้อมูลจริงเก็บใน **Google Sheet** ผ่าน **Apps Script แค่ไฟล์ `Code.gs`** — ไม่ต้องอัปโหลด HTML/Client ใน Apps Script อีก

---

## สารบัญ

1. [ภาพรวม](#ภาพรวม)
2. [ฝั่ง Google: Sheet + Apps Script (ครั้งเดียว)](#ฝั่ง-google-sheet--apps-script-ครั้งเดียว)
3. [ฝั่ง GitHub Pages](#ฝั่ง-github-pages)
4. [ตั้งค่า `js/config.js`](#ตั้งค่า-jsconfigjs)
5. [ชีตที่สร้างอัตโนมัติ](#ชีตที่สร้างอัตโนมัติ)
6. [โหมดเก่า (UI ใน Apps Script)](#โหมดเก่า-ui-ใน-apps-script)
7. [ปัญหาที่พบบ่อย](#ปัญหาที่พบบ่อย)

---

## ภาพรวม

| ส่วน | ที่เก็บ / รัน |
|------|----------------|
| หน้าเว็บ | GitHub repo → **Pages** (โฟลเดอร์รากโปรเจกต์) |
| ข้อมูล | Google Sheet (ชีต `CashBook_*`) |
| สะพาน | Apps Script **Web App** URL (`/exec`) — API เท่านั้น (`doGet` JSONP + `doPost`) |

ถ้า **ไม่** ใส่ `webAppUrl` ใน `config.js` แอปใช้ **localStorage** ในเบราว์เซอร์เหมือนเดิม

---

## ฝั่ง Google: Sheet + Apps Script (ครั้งเดียว)

1. สร้าง **Google Sheet** ใหม่ (ชื่ออะไรก็ได้)
2. **Extensions** → **Apps Script**
3. ลบโค้ดเดิม แล้ววางเนื้อหาจาก **`apps-script/Code.gs`** ในโปรเจกต์นี้ (ไฟล์เดียว)
4. ตั้ง **รหัสลับ** (ต้องตรงกับ `config.js` ภายหลัง) อย่างใดอย่างหนึ่ง:
   - **Project Settings** (ไอคอนเกียร์) → **Script properties** → เพิ่ม  
     **Property** = `CASHBOOK_API_SECRET`  
     **Value** = สตริงยาวๆ ที่เดายาก (เก็บไว้ใช้ในขั้นตอน config)
   - หรือแก้ `DEFAULT_API_SECRET` ใน `Code.gs` (ไม่แนะนำถ้า repo สาธารณะ)
5. **Save** → **Deploy** → **New deployment** → type **Web app**
   - **Execute as:** Me  
   - **Who has access:** **Anyone** (แนะนำถ้าใช้ GitHub Pages แบบสาธารณะ) หรือตามที่ต้องการ  
6. **Authorize** ตามขั้นตอน Google  
7. **Copy** URL ลงท้ายด้วย **`/exec`** (ตัวอย่าง: `https://script.google.com/macros/s/.../exec`)

ทุกครั้งที่แก้ **`Code.gs`** ให้ **Deploy** → **Manage deployments** → **New version** → **Deploy**

---

## ฝั่ง GitHub Pages

1. Push โปรเจกต์นี้ขึ้น GitHub (โฟลเดอร์รากมี `index.html`, `css/`, `js/`, ไฟล์ `.nojekyll` มีแล้ว)
2. ที่ repo: **Settings** → **Pages**
3. **Source:** สาขา `main` (หรือ `master`) และโฟลเดอร์ **`/` (root)**  
4. รอสักครู่ แล้วเปิด URL รูปแบบ  
   `https://<user>.github.io/<repo>/`

ถ้าใช้ **Project site** path จะมีชื่อ repo ต่อท้าย — ลิงก์ `css/` / `js/` แบบ relative ใช้ได้ตามปกติ

---

## ตั้งค่า `js/config.js`

1. เปิด **`js/config.js`** (หรือคัดลอกจาก **`js/config.example.js`**)
2. ใส่ค่า:

```javascript
window.CASHBOOK_CONFIG = {
  webAppUrl: "https://script.google.com/macros/s/....../exec",
  secret: "ค่าเดียวกับ CASHBOOK_API_SECRET ใน Apps Script",
};
```

**สำคัญ:** `secret` คือ **ข้อความรหัส** ที่ตั้งใน Script properties — **ห้าม** วาง URL ของ Web App ซ้ำในช่อง `secret` (จะโหลดไม่สำเร็จและได้ข้อความเตือนเรื่อง URL/รหัส)

3. Commit + push — หรือถ้า repo **สาธารณะ** อย่า commit รหัสจริง: ใช้ build แยก / GitHub Actions secrets / เก็บ repo เป็น private

**หมายเหตุ:** การโหลดข้อมูลใช้ **JSONP** (GET พร้อม `secret` ใน URL) — อย่าแชร์ลิงก์ที่มีรหัสในที่สาธารณะหากไม่ต้องการให้คนอื่นดึงข้อมูลได้

---

## ชีตที่สร้างอัตโนมัติ

| ชีต | คอลัมน์ |
|-----|---------|
| `CashBook_Categories` | id, name, type, expenseKind |
| `CashBook_Transactions` | id, date, amount, type, categoryId, note, bookMonth |

---

## โหมดเก่า (UI ใน Apps Script)

เวอร์ชันเดิมที่รัน **Index + Client + Styles** ใน Apps Script เก็บไว้ที่ **`apps-script/legacy-html/`** สำหรับอ้างอิงเท่านั้น — ไม่ต้อง sync ไป deploy อีก

---

## ปัญหาที่พบบ่อย

| อาการ | แนวทาง |
|--------|--------|
| โหลด Sheet ไม่สำเร็จ / ได้ `null` | ตรวจ `webAppUrl` ลงท้าย `/exec`, รหัสลับตรงกับ Script property, Deploy เวอร์ชันล่าสุด |
| บันทึกแล้วไม่ขึ้นใน Sheet | POST ใช้ `mode: no-cors` — เบราว์เซอร์ไม่แสดง error จากเซิร์ฟเวอร์; ตรวจรหัสใน Apps Script และสิทธิ์ Sheet |
| อยากเก็บรหัสไม่ขึ้น Git | ใช้ repo private, หรือ inject `config.js` ตอน build, หรือ GitHub Actions + secret |

เอกสารย่อ: [`apps-script/DEPLOY.txt`](apps-script/DEPLOY.txt)
