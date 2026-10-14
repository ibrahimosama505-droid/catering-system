import { api } from '../api.js';
import { toast, esc, n, f2, today, buildBar, downloadCSV, debounce, formatHijri } from '../ui.js';

let cache = { expenses: [], contracts: [], kitchens: [], lists: {} };
let search = '';

export async function renderExpenses(main) {
  main.innerHTML = '<div class="empty">جاري التحميل…</div>';
  try { await refresh(); draw(main); }
  catch (e) { main.innerHTML = `<div class="empty" style="color:var(--bad)">خطأ: ${esc(e.message)}</div>`; }
}

async function refresh() {
  const [expenses, contracts, kitchens, lists] = await Promise.all([
    api.data.all('expenses'), api.data.all('contracts'),
    api.data.all('kitchens'), api.lists.all()
  ]);
  cache = { expenses, contracts, kitchens, lists };
}

const kName = id => cache.kitchens.find(k => k.id === id)?.name || '';

function filtered() {
  if (!search) return cache.expenses;
  const q = search.toLowerCase();
  return cache.expenses.filter(x =>
    JSON.stringify(Object.values(x)).toLowerCase().includes(q));
}

function draw(main) {
  const rows = filtered();
  const total = rows.reduce((s, x) => s + n(x.amount), 0);

  const rowsHtml = rows.length
    ? rows.map(x => `
        <tr>
          <td>${x.id}</td>
          <td>${esc(x.date || '')}</td>
          <td class="hijri">${formatHijri(x.date, 'short')}</td>
          <td>${esc(x.cat || '')}</td>
          <td>${esc(x.descr || '')}</td>
          <td>${esc(x.party || '')}</td>
          <td>${f2(x.amount)}</td>
          <td>${esc(x.contract_id || '')}</td>
          <td>${esc(kName(x.kitchen_id))}</td>
          <td>${esc(x.notes || '')}</td>
          <td>
            <button class="ic" data-edit="${x.id}">تعديل</button>
            <button class="ic d" data-del="${x.id}">حذف</button>
          </td>
        </tr>`).join('')
    : '';

  const tableHtml = rows.length
    ? `<table>
        <tr>
          <th>#</th><th>التاريخ</th><th>التاريخ (هـ)</th><th>البند</th>
          <th>الوصف</th><th>الجهة</th><th>المبلغ</th><th>العقد</th>
          <th>المطبخ</th><th>ملاحظات</th><th></th>
        </tr>
        ${rowsHtml}
      </table>`
    : '<div class="empty">لا توجد مصروفات بعد.</div>';

  const extra = `<span class="user-chip" style="background:var(--hl);color:var(--pri-dark);">الإجمالي: ${f2(total)}</span>`;

  main.innerHTML = `${buildBar('المصروفات', { extra })}<div class="box">${tableHtml}</div>`;

  main.querySelector('#ad').onclick = () => openForm(null, main);
  main.querySelector('#ex').onclick = () => exportCSV();
  const q = main.querySelector('#q');
  if (q) q.oninput = debounce(e => { search = e.target.value.trim(); draw(main); }, 200);

  main.querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = () => openForm(+b.dataset.edit, main));
  main.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = async () => {
      if (!confirm('حذف هذا المصروف نهائياً؟')) return;
      try {
        await api.data.remove('expenses', +b.dataset.del, 1);
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
  const x = id ? cache.expenses.find(e => e.id === id) : {};
  const dg = document.getElementById('dg');
  const fm = document.getElementById('fm');

  const catOpts = buildOptions(cache.lists.cat || [], x.cat);
  const contractOpts = buildOptions(cache.contracts, x.contract_id,
    c => c.id + ' — ' + (c.client || ''));
  const kitchenOpts = buildOptions(cache.kitchens, x.kitchen_id, k => k.name);

  fm.innerHTML = `
    <h3 style="grid-column:1/-1;margin:0">${id ? 'تعديل' : 'إضافة'} مصروف</h3>
    <label>التاريخ (ميلادي)<input id="f-date" type="date" value="${x.date || today()}"></label>
    <label>الموافق هجرياً
      <input id="f-hijri" type="text" readonly class="hijri-readonly"
             value="${x.date ? formatHijri(x.date, 'long') : formatHijri(today(), 'long')}">
    </label>
    <label>البند
      <select id="f-cat"><option value=""></option>${catOpts}</select>
    </label>
    <label style="grid-column:1/-1">الوصف<input id="f-descr" value="${esc(x.descr || '')}"></label>
    <label>الجهة<input id="f-party" value="${esc(x.party || '')}"></label>
    <label>المبلغ<input id="f-amount" type="number" step="any" min="0" value="${x.amount || ''}" required></label>
    <label>العقد المرتبط
      <select id="f-contract"><option value=""></option>${contractOpts}</select>
    </label>
    <label>المطبخ
      <select id="f-kitchen"><option value=""></option>${kitchenOpts}</select>
    </label>
    <label style="grid-column:1/-1">ملاحظات<input id="f-notes" value="${esc(x.notes || '')}"></label>
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
      cat: fm.querySelector('#f-cat').value || null,
      descr: fm.querySelector('#f-descr').value.trim() || null,
      party: fm.querySelector('#f-party').value.trim() || null,
      amount: n(fm.querySelector('#f-amount').value),
      contract_id: fm.querySelector('#f-contract').value || null,
      kitchen_id: n(fm.querySelector('#f-kitchen').value) || null,
      notes: fm.querySelector('#f-notes').value.trim() || null
    };
    if (row.amount <= 0) { err.textContent = 'المبلغ يجب أن يكون أكبر من صفر'; return; }
    try {
      if (id) await api.data.update('expenses', id, row, 1);
      else    await api.data.insert('expenses', row, 1);
      toast('تم الحفظ');
      dg.close();
      await refresh();
      draw(main);
    } catch (e) { err.textContent = e.message; }
  };
}

function exportCSV() {
  const rows = filtered().map(x => [
    x.id, x.date || '', formatHijri(x.date, 'short'),
    x.cat || '', x.descr || '', x.party || '',
    x.amount || 0, x.contract_id || '', kName(x.kitchen_id), x.notes || ''
  ]);
  downloadCSV('expenses-' + new Date().toISOString().slice(0, 10) + '.csv',
    ['#', 'التاريخ (م)', 'التاريخ (هـ)', 'البند', 'الوصف', 'الجهة',
     'المبلغ', 'العقد', 'المطبخ', 'ملاحظات'], rows);
  toast('تم التصدير');
}