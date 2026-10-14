/* ============================================================
   محرّك استيراد الملفات (CSV + XLSX)
   ============================================================ */
import { esc, n } from './ui.js';

const COLUMN_MAP = {
  // رقم الاتفاقية
  'رقم الاتفاقية': 'id', 'رقم الإتفاقية': 'id', 'رقم اتفاقية': 'id',
  'رقم الاتفاقيه': 'id', 'رقم العقد': 'id', 'id': 'id',

  // اسم الشركة
  'اسم شركة العمرة': 'client', 'اسم الشركة': 'client', 'الشركة': 'client',
  'اسم الشركة المعززة': 'client', 'العميل': 'client', 'اسم العميل': 'client',
  'client': 'client',

  // منطقة الخدمة
  'منطقة الخدمة': 'loc', 'المنطقة': 'loc', 'الموقع': 'loc', 'loc': 'loc',

  // عدد الأيام
  'عدد أيام الاتفاقية': 'days', 'عدد أيام الإفاقة': 'days',
  'أيام الإفاقة': 'days', 'الأيام': 'days', 'days': 'days',

  // بداية
  'تاريخ بداية الاتفاقية': 'start', 'تاريخ بداية الإفاقة': 'start',
  'بداية الاتفاقية': 'start', 'بدء الخدمة': 'start', 'start': 'start',

  // نهاية
  'تاريخ نهاية الاتفاقية': 'ifaqa_end', 'تاريخ نهاية الإفاقة': 'ifaqa_end',
  'نهاية الاتفاقية': 'ifaqa_end', 'ifaqa_end': 'ifaqa_end',

  // عدد المعتمرين
  'عدد المعتمرين': 'people', 'المعتمرين': 'people',
  'عدد الأفراد': 'people', 'people': 'people',

  // المبلغ الإجمالي
  'المبلغ الإجمالي للمعتمرين': 'total_amount',
  'المبلغ الإجمالي': 'total_amount',
  'اجمالي سعر الاتفاقية': 'total_amount',
  'إجمالي سعر الاتفاقية': 'total_amount',
  'الإجمالي': 'total_amount',
  'total_amount': 'total_amount',

  // سعر الاتفاقية
  'سعر الاتفاقية': 'price', 'السعر': 'price', 'price': 'price',

  // حالة الاتفاقية
  'حالة الاتفاقية': 'agreement_status', 'الحالة': 'agreement_status',
  'agreement_status': 'agreement_status',

  // نوع الاتفاقية
  'نوع الاتفاقية': 'type', 'نوع الخدمة': 'type', 'type': 'type',

  // المسوّق
  'اسم المسوق': 'marketer_name',
  'اسم المسوّق': 'marketer_name',
  'المسوق': 'marketer_name',
  'المسوّق': 'marketer_name',
  'marketer': 'marketer_name',

  // النسبة
  'النسبة': 'pct', 'النسبة %': 'pct', 'العمولة': 'pct',
  'عمولة المسوّق %': 'pct', 'نسبة المسوق': 'pct', 'pct': 'pct',

  // أخرى
  'سبب التعديل': 'amend_reason', 'أيام التعديل': 'amend_days',
  'عدد المعتمرين بعد التعديل': 'pilgrims_after', 'التاريخ': 'date',
  'الموسم': 'season', 'ملاحظات': 'notes'
};

const DATE_FIELDS = ['date', 'start', 'ifaqa_end'];
const NUM_FIELDS = ['days', 'people', 'total_amount', 'amend_days', 'pilgrims_after', 'price', 'mpd', 'pct'];

function normalizeKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildHeaderMap(headers) {
  const normalized = {};
  for (const [k, v] of Object.entries(COLUMN_MAP)) {
    const nk = normalizeKey(k);
    if (!(nk in normalized)) normalized[nk] = v;
  }
  const map = {};
  const unknown = [];
  headers.forEach((h, i) => {
    const norm = normalizeKey(h);
    const key = normalized[norm];
    if (key) {
      map[i] = { key, header: String(h) };
    } else {
      map[i] = { key: null, header: String(h) };
      if (norm) unknown.push({ index: i, header: String(h).trim() });
    }
  });
  return { map, unknown };
}

function parseDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && v > 0) {
    try {
      const d = window.XLSX.SSF.parse_date_code(v);
      if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    } catch (e) {}
  }
  const s = String(v).trim().replace(/[\n\r]/g, '');
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m1) {
    let [, d, mo, y] = m1;
    if (y.length === 2) y = '20' + y;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/)[0];
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let cur = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === sep) { cur.push(field); field = ''; }
      else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (ch === '\r') {}
      else field += ch;
    }
  }
  if (field !== '' || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

export async function readFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    const text = await file.text();
    return { rows: parseCSV(text), kind: 'csv' };
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    if (!window.XLSX) throw new Error('مكتبة xlsx غير محمّلة');
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: 'array', cellDates: false });
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i] || [];
        const hasId = row.some(c => {
          const norm = normalizeKey(c);
          return norm.includes('رقم الاتفاق');
        });
        if (hasId) return { rows, kind: 'xlsx', sheetName };
      }
    }
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    return { rows, kind: 'xlsx', sheetName: wb.SheetNames[0] };
  }
  throw new Error('صيغة الملف غير مدعومة');
}

export function analyzeRows(rows) {
  if (!rows || rows.length < 2) throw new Error('الملف فاضي أو ناقص عنوان الأعمدة');

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!row) continue;
    const nonEmpty = row.filter(c => String(c ?? '').trim() !== '').length;
    if (nonEmpty >= 3) {
      const hasId = row.some(c => normalizeKey(c).includes('رقم الاتفاق'));
      if (hasId || nonEmpty >= 5) { headerRowIndex = i; break; }
    }
  }

  const headers = rows[headerRowIndex].map(h => String(h ?? '').trim());
  const dataRows = rows.slice(headerRowIndex + 1);

  const { map, unknown } = buildHeaderMap(headers);
  const recognizedFields = [...new Set(Object.values(map).filter(x => x.key).map(x => x.key))];

  if (!recognizedFields.includes('id')) {
    throw new Error(
      'لم يتم العثور على عمود "رقم الاتفاقية".\n\nالأعمدة الموجودة:\n' +
      headers.filter(h => h).map((h, i) => `${i + 1}. ${h}`).join('\n')
    );
  }

  const items = [];
  const errors = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const lineNum = headerRowIndex + i + 2;
    if (!row || !row.some(c => String(c ?? '').trim() !== '')) continue;

    const obj = {};
    const unknowns = [];

    Object.entries(map).forEach(([idx, info]) => {
      const idxNum = parseInt(idx);
      const val = row[idxNum];
      if (info.key) {
        if (obj[info.key] === undefined) obj[info.key] = val;
      } else if (info.header && String(val ?? '').trim() !== '') {
        unknowns.push({ header: info.header, value: val });
      }
    });

    if (!obj.id) { errors.push({ line: lineNum, reason: 'رقم الاتفاقية مفقود' }); continue; }
    obj.id = String(obj.id).trim();

    DATE_FIELDS.forEach(f => {
      if (obj[f] !== undefined) obj[f] = parseDate(obj[f]);
    });
    NUM_FIELDS.forEach(f => {
      if (obj[f] !== undefined) obj[f] = n(obj[f]);
    });

    items.push({ line: lineNum, data: obj, unknown: unknowns });
  }

  if (!items.length) {
    throw new Error('لم يتم العثور على صفوف صالحة.\nعدد الصفوف: ' + dataRows.length);
  }

  return { headers, items, errors, recognizedFields, unknownColumns: unknown };
}

export async function importContracts(items, options = {}) {
  const { onDuplicate = 'skip', uid = 1 } = options;
  const { api } = await import('./api.js');

  // جلب المسوّقين
  const marketers = await api.data.all('marketers');
  const marketerByName = {};
  marketers.forEach(m => { marketerByName[m.name.trim()] = m; });

  // جلب روابط الشركات بالمسوّقين
  let companyLinks = {};
  try {
    const links = await api.data.all('company_marketers');
    links.forEach(l => { companyLinks[l.company_name] = l; });
  } catch (e) {}

  const existing = await api.data.all('contracts');
  const existingIds = new Set(existing.map(c => String(c.id)));

  let inserted = 0, updated = 0, skipped = 0, failed = 0;
  const failedDetails = [];

  for (const it of items) {
    const row = { ...it.data };
    const isDup = existingIds.has(row.id);

    // معالجة المسوّق تلقائياً
    // 1) من عمود "اسم المسوق" لو موجود
    if (row.marketer_name) {
      const name = String(row.marketer_name).trim();
      const found = marketerByName[name];
      if (found) {
        row.marketer_id = found.id;
        if (!row.pct && found.default_pct) row.pct = found.default_pct;
      }
      delete row.marketer_name;
    }
    // 2) من ربط الشركة السابق
    else if (row.client && companyLinks[row.client.trim()]) {
      const link = companyLinks[row.client.trim()];
      if (link.marketer_id) {
        row.marketer_id = link.marketer_id;
        if (!row.pct && link.pct) row.pct = link.pct;
      }
    }

    // حدّث الرابط
    if (row.client && row.marketer_id) {
      try {
        const existing = companyLinks[row.client.trim()];
        if (existing) {
          await api.data.update('company_marketers', existing.id, {
            marketer_id: row.marketer_id,
            pct: row.pct || existing.pct || 0
          }, uid);
        } else {
          const newId = await api.data.insert('company_marketers', {
            company_name: row.client.trim(),
            marketer_id: row.marketer_id,
            pct: row.pct || 0
          }, uid);
          companyLinks[row.client.trim()] = { id: newId, marketer_id: row.marketer_id, pct: row.pct };
        }
      } catch (e) {}
    }

    if (isDup) {
      if (onDuplicate === 'skip') { skipped++; continue; }
      if (onDuplicate === 'update') {
        try {
          await api.data.update('contracts', row.id, row, uid);
          updated++;
        } catch (e) {
          failed++;
          failedDetails.push({ id: row.id, reason: e.message });
        }
        continue;
      }
    }

    try {
      await api.data.insert('contracts', row, uid);
      inserted++;
    } catch (e) {
      failed++;
      failedDetails.push({ id: row.id, reason: e.message });
    }
  }

  return { inserted, updated, skipped, failed, failedDetails };
}

export async function openImportDialog(main, onDone) {
  const dg = document.getElementById('dg');
  const fm = document.getElementById('fm');

  fm.innerHTML = `
    <h3 style="grid-column:1/-1;margin:0">📥 استيراد عقود من Excel / CSV</h3>
    <div style="grid-column:1/-1;display:flex;flex-direction:column;gap:10px">
      <p class="import-info">
        <b>الصيغ:</b> .xlsx — .xls — .csv<br>
        <b>عمود مطلوب:</b> رقم الاتفاقية<br>
        <b>أعمدة مدعومة:</b> اسم شركة العمرة، منطقة الخدمة، عدد أيام الاتفاقية،
        تاريخ بداية الاتفاقية، تاريخ نهاية الاتفاقية، عدد المعتمرين،
        المبلغ الإجمالي للمعتمرين، حالة الاتفاقية، سعر الاتفاقية،
        نوع الاتفاقية، اسم المسوق، النسبة.
        <br>
        <b>🔗 ميزة ذكية:</b> إذا كانت الشركة مرتبطة بمسوّق من قبل، سيُعيَّن تلقائياً.
      </p>
      <input type="file" id="imp-file" accept=".csv,.xlsx,.xls">
      <div id="imp-preview"></div>
    </div>
    <div class="err" id="imp-err"></div>
    <div class="f">
      <button class="btn g" type="button" id="imp-cancel">إلغاء</button>
      <button class="btn" type="button" id="imp-run" disabled>استيراد</button>
    </div>`;

  dg.showModal();

  let pendingItems = null;
  const fileInput = fm.querySelector('#imp-file');
  const previewEl = fm.querySelector('#imp-preview');
  const runBtn = fm.querySelector('#imp-run');
  const errEl = fm.querySelector('#imp-err');

  fm.querySelector('#imp-cancel').onclick = () => dg.close();

  fileInput.onchange = async e => {
    errEl.textContent = '';
    previewEl.innerHTML = '';
    runBtn.disabled = true;
    pendingItems = null;

    const file = e.target.files[0];
    if (!file) return;

    try {
      const { rows, kind, sheetName } = await readFile(file);
      if (!rows.length) { errEl.textContent = 'الملف فاضي'; return; }

      const { headers, items, errors, recognizedFields, unknownColumns } = analyzeRows(rows);
      pendingItems = items;

      const sample = items.slice(0, 10);
      const rowsHtml = sample.map(it => `
        <tr>
          <td>${it.line}</td>
          <td>${esc(it.data.id)}</td>
          <td>${esc(it.data.client || '')}</td>
          <td>${esc(it.data.loc || '')}</td>
          <td>${it.data.people || 0}</td>
          <td>${it.data.days || 0}</td>
          <td>${esc(it.data.start || '')}</td>
          <td>${it.data.total_amount || 0}</td>
          <td>${esc(it.data.marketer_name || '')}</td>
        </tr>`).join('');

      const errorsHtml = errors.length
        ? `<div class="import-errors">⚠️ ${errors.length} صف تم تجاهله</div>` : '';
      const unknownHtml = unknownColumns.length
        ? `<div style="margin-top:8px;font-size:12px;color:var(--mut)">
             <b>أعمدة غير معروفة:</b> ${unknownColumns.map(u => esc(u.header)).join(' — ')}
           </div>` : '';

      previewEl.innerHTML = `
        <div class="import-preview">
          <div class="import-preview-header">
            ✅ تم قراءة (${kind.toUpperCase()})${sheetName ? ` — Sheet: "${esc(sheetName)}"` : ''} —
            <b>${items.length}</b> عقد
            ${items.length > 10 ? ` (معاينة أول 10)` : ''}
          </div>
          <div style="font-size:12px;color:var(--mut);margin-bottom:8px">
            <b>الأعمدة المتعرَّف عليها:</b>
            ${recognizedFields.map(f => `<code style="background:var(--hl);padding:1px 6px;border-radius:4px;margin:0 2px">${f}</code>`).join('')}
          </div>
          <table>
            <tr>
              <th>#</th><th>رقم الاتفاقية</th><th>الشركة</th><th>المنطقة</th>
              <th>المعتمرين</th><th>الأيام</th><th>البداية</th><th>الإجمالي</th><th>المسوق</th>
            </tr>
            ${rowsHtml}
          </table>
          ${errorsHtml}${unknownHtml}
        </div>`;

      runBtn.disabled = false;
    } catch (ex) {
      console.error(ex);
      errEl.textContent = ex.message || 'فشل قراءة الملف';
      errEl.style.whiteSpace = 'pre-wrap';
      errEl.style.textAlign = 'start';
      errEl.style.maxHeight = '300px';
      errEl.style.overflow = 'auto';
    }
  };

  runBtn.onclick = async () => {
    errEl.textContent = '';
    if (!pendingItems) return;

    const { api } = await import('./api.js');
    const existing = await api.data.all('contracts');
    const existingIds = new Set(existing.map(c => String(c.id)));
    const duplicates = pendingItems.filter(it => existingIds.has(it.data.id));

    let onDuplicate = 'skip';
    if (duplicates.length) {
      const choice = confirm(
        `يوجد ${duplicates.length} عقد مكرر.\n\n` +
        `OK: تحديث الموجود\nCancel: تخطي المكرر`
      );
      onDuplicate = choice ? 'update' : 'skip';
    }

    runBtn.disabled = true;
    runBtn.textContent = 'جاري…';

    try {
      const res = await importContracts(pendingItems, { onDuplicate, uid: 1 });
      let msg = `تم:\n✅ ${res.inserted} جديد\n`;
      if (res.updated) msg += `🔄 ${res.updated} محدّث\n`;
      if (res.skipped) msg += `⏭️ ${res.skipped} متخطى\n`;
      if (res.failed) msg += `❌ ${res.failed} فشل\n`;
      alert(msg);
      dg.close();
      if (onDone) onDone();
    } catch (ex) {
      console.error(ex);
      errEl.textContent = ex.message || 'فشل الاستيراد';
      runBtn.disabled = false;
      runBtn.textContent = 'استيراد';
    }
  };
}