/**
 * webAppUrl = URL จาก Deploy Web App (ลงท้าย /exec) แค่บรรทัดเดียว
 * secret    = ข้อความลับที่คุณตั้งใน Apps Script → Script properties → CASHBOOK_API_SECRET
 *             ห้ามใส่ URL ตรงนี้ — ต้องเป็นสตริงรหัสที่ตรงกับใน Apps Script เท่านั้น
 */
window.CASHBOOK_CONFIG = {
  webAppUrl: "https://script.google.com/macros/s/AKfycbxfWxUh_pV8njO_hl8m1U5ZraMpav79Vdfw_nKULeX43FSw88dBB76PrX2Ec6ojYhw5/exec",
  secret: "",
};
