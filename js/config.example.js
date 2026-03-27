/** คัดลอกเป็น config.js แล้วใส่ค่า — อย่า commit รหัสจริงถ้า repo สาธารณะ */
window.CASHBOOK_CONFIG = {
  webAppUrl: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",
  /** ต้องเป็นข้อความเดียวกับ Script property CASHBOOK_API_SECRET — ห้ามใส่ URL Web App ตรงนี้ */
  secret: "รหัสที่คุณสร้างเองและวางใน Apps Script ด้วย",
};
