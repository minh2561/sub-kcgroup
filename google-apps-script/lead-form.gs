/**
 * KC EVENT – Nhận lead từ form website → Google Sheet + email thông báo.
 *
 * CÀI ĐẶT (1 lần, ~5 phút):
 *  1. Tạo Google Sheet mới (vd: "KC Event – Leads").
 *  2. Menu Tiện ích mở rộng → Apps Script, xoá code mẫu, dán toàn bộ file này.
 *  3. Sửa NOTIFY_EMAIL bên dưới nếu cần.
 *  4. Bấm Triển khai → Tùy chọn triển khai mới → Loại: Ứng dụng web
 *       - Thực thi với tư cách: Tôi
 *       - Người có quyền truy cập: Bất kỳ ai
 *     → Triển khai, cấp quyền, copy "URL ứng dụng web" (…/exec).
 *  5. Dán URL vào js/config.js → leadEndpoint: "https://script.google.com/macros/s/…/exec"
 */
const NOTIFY_EMAIL = 'truyenthongsukienkcgroup@gmail.com';
const SHEET_NAME = 'Leads';
const FIELDS = ['submittedAt', 'fullname', 'phone', 'email', 'company', 'service', 'guests', 'notes', 'page'];
const HEADERS = ['Thời gian', 'Họ tên', 'SĐT', 'Email', 'Công ty', 'Dịch vụ', 'Số khách', 'Ghi chú', 'Trang'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    if (data.website) return out({ ok: true }); // honeypot
    if (!data.fullname || !data.phone) return out({ ok: false, error: 'missing fields' });

    // Prefix values starting with = + - @ so Sheets won't evaluate them as formulas.
    const clean = v => String(v == null ? '' : v).slice(0, 2000).replace(/^[=+\-@]/, "'$&");
    const now = new Date();
    getSheet().appendRow(FIELDS.map(f => f === 'submittedAt' ? now : clean(data[f])));

    const mail = {
      to: NOTIFY_EMAIL,
      subject: `[KC Event] Lead mới: ${clean(data.company)} – ${clean(data.service)}`,
      body: FIELDS.map((f, i) => `${HEADERS[i]}: ${f === 'submittedAt' ? now.toLocaleString('vi-VN') : clean(data[f])}`).join('\n'),
    };
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) mail.replyTo = data.email;
    MailApp.sendEmail(mail);

    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
