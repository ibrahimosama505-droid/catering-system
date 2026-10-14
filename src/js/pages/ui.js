/* ==================== تنبيهات ==================== */
export function toast(msg, ms = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.style.display = 'none', ms);
}

/* ==================== هروب النصوص ==================== */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ==================== أرقام ==================== */
export const n = v => parseFloat(v) || 0;

export const f2 = v => n(v).toLocaleString('en-US', {
  maximumFractionDigits: 2
});

export const sum = (arr, fn) => arr.reduce((s, x) => s + n(fn(x)), 0);

/* ==================== تواريخ ==================== */
export const today = () => new Date().toISOString().slice(0, 10);

export const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

/* ==================== نافذة تأكيد ==================== */
export function confirmDialog(msg) {
  return confirm(msg);
}

/* ==================== شريط بحث + أزرار ==================== */
export function buildBar(title, opts = {}) {
  const { showSearch = true, showAdd = true, extra = '' } = opts;
  return `
    <div class="bar">
      <h2>${esc(title)}</h2>
      ${extra}
      ${showSearch ? '<input id="q" placeholder="بحث..." type="search">' : ''}
      <button class="btn g" id="ex">تصدير CSV</button>
      ${showAdd ? '<button class="btn" id="ad">+ إضافة</button>' : ''}
    </div>`;
}

/* ==================== جدول عام ==================== */
export function buildTable(headers, rows) {
  if (!rows.length) {
    return '<div class="empty">لا توجد بيانات بعد.</div>';
  }
  return `
    <table>
      <tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>
      ${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}
    </table>`;
}

/* ==================== تصدير CSV ==================== */
export function downloadCSV(filename, headers, rows) {
  const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const content = [headers, ...rows].map(r => r.map(q).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ==================== Debounce ==================== */
export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}