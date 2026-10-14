/* ============================================================
   تنبيهات
   ============================================================ */
export function toast(msg, ms = 2500) {
  const el = document.getElementById('toast');
  if (!el) { console.warn('[toast]', msg); return; }
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, ms);
}

/* ============================================================
   هروب النصوص
   ============================================================ */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ============================================================
   أرقام
   ============================================================ */
export const n = v => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : 0;
};

export const f2 = v => n(v).toLocaleString('en-US', { maximumFractionDigits: 2 });

export const sum = (arr, fn) => (arr || []).reduce((s, x) => s + n(fn(x)), 0);

/* ============================================================
   تواريخ ميلادية
   ============================================================ */
export const today = () => new Date().toISOString().slice(0, 10);

export const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

/* ============================================================
   التقويم الهجري
   ============================================================ */
export const MONTHS_HIJRI = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
  'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
];

export function toHijri(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;

    const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });

    const parts = {};
    fmt.formatToParts(d).forEach(p => {
      if (p.type !== 'literal') parts[p.type] = p.value;
    });

    const month = parseInt(parts.month) || 0;
    return {
      year: parseInt(parts.year) || 0,
      month,
      day: parseInt(parts.day) || 0,
      monthName: MONTHS_HIJRI[month - 1] || ''
    };
  } catch (e) {
    console.error('toHijri error:', e);
    return null;
  }
}

export function formatHijri(date, style = 'long') {
  if (!date) return '';
  const h = toHijri(date);
  if (!h) return '';
  if (style === 'short') return `${h.day}/${h.month}/${h.year} هـ`;
  return `${h.day} ${h.monthName} ${h.year} هـ`;
}

export function todayHijri(style = 'long') {
  return formatHijri(new Date(), style);
}

/* ============================================================
   شريط البحث + الأزرار
   ============================================================ */
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

/* ============================================================
   CSV
   ============================================================ */
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
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ============================================================
   Debounce
   ============================================================ */
export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}