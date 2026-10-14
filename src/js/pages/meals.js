import { api } from '../api.js';
import { toast, esc, n, f2, sum, today, buildBar, downloadCSV, debounce, formatHijri } from '../ui.js';

let cache = { meals: [], contracts: [], lists: {} };
let search = '';
let filterDate = '';

export async function renderMeals(main) {
  main.innerHTML = '<div class="empty">جاري التحميل…</div>';
  try { await refresh(); draw(main); }
  catch (e) { main.innerHTML = `<div class="empty" style="color:var(--bad)">خطأ: ${esc(e.message)}</div>`; }
}

async function refresh() {
  const [meals, contracts, lists] = await Promise.all([
    api.data.all('meals'), api.data.all('contracts'), api.lists.all()
  ]);
  cache = { meals, contracts, lists };
}

const cOf = id => cache.contracts.find(c => c.id === id);

function filtered() {
  let rows = cache.meals;
  if (filterDate) rows = rows.filter(m => m.date === filterDate);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(m => JSON.stringify(Object.values(m)).toLowerCase().includes(q));
  }
  return rows;
}

function status(m) {
  if (!n(m.planned)) return '';
  if (n(m.delivered) <= 0) return 'لم يُسلَّم';
  if (n(m.delivered) >= n(m.planned)) return 'مكتمل';
  return 'مسلّم جزئياً';
}
const cls = s => ({ 'مكتمل': 's1', 'مسلّم جزئياً': 's2', 'لم يُسلَّم': 's3' }[s] || '');

function draw(main) {
  const rows = filtered();
  const totalPlanned = sum(rows, m => m.planned);
  const totalDelivered = sum(rows, m => m.delivered);

  const rowsHtml = rows.length
    ? rows.map(m => {
        const st = status(m);
        const stBadge = st ? `<span class="b ${cls(st)}">${st}</span>` : '';
        const client = cOf(m.contract_id)?.client || '';
        return `
          <tr>
            <td>${m.id}</td>
            <td>${esc(m.date || '')}</td>
            <td class="hijri">${formatHijri(m.date, 'short')}</td>
            <td>${esc(m.contract_id || '')}</td>
            <td>${esc(client)}</td>
            <td>${esc(m.meal || '')}</td>
            <td>${f2(m.planned)}</td>
            <td>${f2(m.delivered)}</td>
            <td>${stBadge}</td>
            <td>${esc(m.notes || '')}</td>
            <td>
              <button class="ic" data-edit="${m.id}">تعديل</button>
              <button class="ic d" data-del="${m.id}">حذف</button>
            </td>
          </tr>`;
      }).join('')
    : '';

  const mainTableHtml = rows.length
    ? `<table>
        <tr>
          <th>#</th><th>التاريخ</th><th>التاريخ (هـ)</th>
          <th>رقم العقد</th><th>العميل</th>
          <th>النوع</th><th>المخطّط</th><th>المسلّم</th><th>الحالة</th>
          <th>ملاحظات</th><th></th>
        </tr>
        ${rowsHtml}
      </table>`
    : '<div class="empty">لا توجد وجبات مسجّلة بعد.</div>';

  const mealTypes = cache.lists.meal || [];
  const summaryRowsHtml = mealTypes.map(t => {
    const r = rows.filter(o => o.meal === t.value);
    const p = sum(r, m => m.planned);
    const d = sum(r, m => m.delivered);
    const pct = p ? (d / p * 100).toFixed(1) + '%' : '—';
    return `<tr><td>${esc(t.value)}</td><td>${f2(p)}</td><td>${f2(d)}</td><td>${pct}</td></tr>`;
  }).join('');

  const totalPct = totalPlanned ? (totalDelivered / totalPlanned * 100).toFixed(1) + '%' : '—';
  const summaryHtml = `
    <table>
      <tr><th>النوع</th><th>مخطّط</th><th>مسلّم</th><th>نسبة التنفيذ</th></tr>
      ${summaryRowsHtml}
      <tr style="font-weight:700;background:var(--hl)">
        <td>الإجمالي</td><td>${f2(totalPlanned)}</td><td>${f2(totalDelivered)}</td><td>${totalPct}</td>
      </tr>
    </table>`;

  const extra = `<label style="display:flex;gap:6px;align-items:center;font-size:13px;">اليوم: <input type="date" id="dy" value="${filterDate}"></label>`;

  main.innerHTML = `
    ${buildBar('جدول الوجبات', { extra, showAdd: true })}
    <div class="box">${mainTableHtml}</div>
    <div class="box">
      <h3>ملخص ${filterDate ? filterDate + ' — ' + formatHijri(filterDate, 'long') : 'كل الأيام'}</h3>
      ${summaryHtml}
    </div>`;

  main.querySelector('#ad').onclick = () => openForm(null, main);
  main.querySelector('#ex').onclick = () => exportCSV();
  const q = main.querySelector('#q');
  if (q) q.oninput = debounce(e => { search = e.target.value.trim(); draw(main); }, 200);
  const dy = main.querySelector('#dy');
  if (dy) dy.onchange = e => { filterDate = e.target.value; draw(main); };

  main.querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = () => openForm(+b.dataset.edit, main));
  main.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = async () => {
      if (!confirm('حذف هذا السجل نهائياً؟')) return;
      try {
        await api.data.remove('meals', +b.dataset.del, 1);
        toast('تم الحذف');
        await refresh();
        draw(main);
      } catch (e) { toast(e.message); }
    });
}

function buildOptions(list, currentVal, labelFn) {
  return list.map(o => {
    const v = o.value ?? o.id ?? o;
    const label = labelFn ? labelFn(o) : (o.value ?? o.name ?? o);
    const selected = String(v) === String(currentVal) ? ' selected' : '';
    return `<option value="${esc(v)}"${selected}>${esc(label)}</option>`;
  }).join('');
}

function openForm(id, main) {
  const m = id ? cache.meals.find(x => x.id === id) : {};
  const dg = document.getElementById('dg');
  const fm = document.getElementById('fm');

  const mealOpts = buildOptions(cache.lists.meal || [], m.meal);
  const contractOpts = buildOptions(cache.contracts, m.contract_id,
    c => c.id + ' — ' + (c.client || ''));

  fm.innerHTML = `
    <h3 style="grid-column:1/-1;margin:0">${id ? 'تعديل' : 'إضافة'} سجل وجبة</h3>
    <label>التاريخ (ميلادي)<input id="f-date" type="date" value="${m.date || today()}"></label>
    <label>الموافق هجرياً
      <input id="f-hijri" type="text" readonly class="hijri-readonly"
             value="${m.date ? formatHijri(m.date, 'long') : formatHijri(today(), 'long')}">
    </label>
    <label>نوع الوجبة
      <select id="f-meal"><option value=""></option>${mealOpts}</select>
    </label>
    <label style="grid-column:1/-1">العقد
      <select id="f-contract"><option value=""></option>${contractOpts}</select>
    </label>
    <label>العدد المخطّط<input id="f-planned" type="number" step="any" min="0" value="${m.planned || ''}"></label>
    <label>العدد المسلّم<input id="f-delivered" type="number" step="any" min="0" value="${m.delivered || ''}"></label>
    <label style="grid-column:1/-1">ملاحظات<input id="f-notes" value="${esc(m.notes || '')}"></label>
    <div class="err" id="f-err"></div>
    <div class="f">
      <button class="btn g" type="button" id="f-cancel">إلغاء</button>
      <button class="btn" type="button" id="f-save">حفظ</button>
    </div>`;
  dg.showModal();

  const dateInput = fm.querySelector('#f-date');
  const hijriInput = fm.querySelector('#f-hijri');
  if (dateInput && hijriInput) {
    dateInput.onchange = e => {
      hijriInput.value = e.target.value ? formatHijri(e.target.value, 'long') : '—';
    };
  }

  fm.querySelector('#f-cancel').onclick = () => dg.close();
  fm.querySelector('#f-save').onclick = async () => {
    const err = fm.querySelector('#f-err');
    err.textContent = '';
    const row = {
      date: fm.querySelector('#f-date').value || null,
      meal: fm.querySelector('#f-meal').value || null,
      contract_id: fm.querySelector('#f-contract').value || null,
      planned: n(fm.querySelector('#f-planned').value),
      delivered: n(fm.querySelector('#f-delivered').value),
      notes: fm.querySelector('#f-notes').value.trim() || null
    };
    if (!row.contract_id) { err.textContent = 'يجب اختيار العقد'; return; }
    try {
      if (id) await api.data.update('meals', id, row, 1);
      else    await api.data.insert('meals', row, 1);
      toast('تم الحفظ');
      dg.close();
      await refresh();
      draw(main);
    } catch (e) { err.textContent = e.message; }
  };
}

function exportCSV() {
  const rows = filtered().map(m => [
    m.id, m.date || '', formatHijri(m.date, 'short'),
    m.contract_id || '', cOf(m.contract_id)?.client || '',
    m.meal || '', m.planned || 0, m.delivered || 0, status(m), m.notes || ''
  ]);
  downloadCSV('meals-' + new Date().toISOString().slice(0, 10) + '.csv',
    ['#', 'التاريخ (م)', 'التاريخ (هـ)', 'رقم العقد', 'العميل',
     'النوع', 'مخطط', 'مسلم', 'الحالة', 'ملاحظات'], rows);
  toast('تم التصدير');
}