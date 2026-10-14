import { api } from '../api.js';
import { toast, esc, n, f2, today, buildBar, downloadCSV, debounce, formatHijri } from '../ui.js';

let cache = { payments: [], contracts: [], lists: {} };
let search = '';

export async function renderPayments(main) {
  main.innerHTML = '<div class="empty">جاري التحميل…</div>';
  try { await refresh(); draw(main); }
  catch (e) { main.innerHTML = `<div class="empty" style="color:var(--bad)">خطأ: ${esc(e.message)}</div>`; }
}

async function refresh() {
  const [payments, contracts, lists] = await Promise.all([
    api.data.all('payments'), api.data.all('contracts'), api.lists.all()
  ]);
  cache = { payments, contracts, lists };
}

const cOf = id => cache.contracts.find(c => c.id === id);

function filtered() {
  if (!search) return cache.payments;
  const q = search.toLowerCase();
  return cache.payments.filter(p =>
    JSON.stringify(Object.values(p)).toLowerCase().includes(q));
}

function draw(main) {
  const rows = filtered();

  const rowsHtml = rows.length
    ? rows.map(p => {
        const client = cOf(p.contract_id)?.client || '';
        return `
          <tr>
            <td>${p.id}</td>
            <td>${esc(p.code || '')}</td>
            <td>${esc(p.date || '')}</td>
            <td class="hijri">${formatHijri(p.date, 'short')}</td>
            <td>${esc(p.contract_id || '')}</td>
            <td>${esc(client)}</td>
            <td>${f2(p.amount)}</td>
            <td>${esc(p.method || '')}</td>
            <td>${esc(p.ref || '')}</td>
            <td>${esc(p.notes || '')}</td>
            <td>
              <button class="ic" data-edit="${p.id}">تعديل</button>
              <button class="ic d" data-del="${p.id}">حذف</button>
            </td>
          </tr>`;
      }).join('')
    : '';

  const tableHtml = rows.length
    ? `<table>
        <tr>
          <th>#</th><th>رقم الدفعة</th><th>التاريخ</th><th>التاريخ (هـ)</th>
          <th>رقم العقد</th><th>العميل</th><th>المبلغ</th>
          <th>طريقة الدفع</th><th>المرجع</th><th>ملاحظات</th>
          <th></th>
        </tr>
        ${rowsHtml}
      </table>`
    : '<div class="empty">لا توجد مدفوعات بعد.</div>';

  main.innerHTML = `${buildBar('المدفوعات')}<div class="box">${tableHtml}</div>`;

  main.querySelector('#ad').onclick = () => openForm(null, main);
  main.querySelector('#ex').onclick = () => exportCSV();
  const q = main.querySelector('#q');
  if (q) q.oninput = debounce(e => { search = e.target.value.trim(); draw(main); }, 200);

  main.querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = () => openForm(+b.dataset.edit, main));
  main.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = async () => {
      if (!confirm('حذف هذه الدفعة نهائياً؟')) return;
      try {
        await api.data.remove('payments', +b.dataset.del, 1);
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
  const p = id ? cache.payments.find(x => x.id === id) : {};
  const dg = document.getElementById('dg');
  const fm = document.getElementById('fm');

  const methodOpts = buildOptions(cache.lists.method || [], p.method);
  const contractOpts = buildOptions(cache.contracts, p.contract_id,
    c => c.id + ' — ' + (c.client || ''));

  fm.innerHTML = `
    <h3 style="grid-column:1/-1;margin:0">${id ? 'تعديل' : 'إضافة'} دفعة</h3>
    <label>رقم الدفعة<input id="f-code" value="${esc(p.code || '')}"></label>
    <label>التاريخ (ميلادي)<input id="f-date" type="date" value="${p.date || today()}"></label>
    <label>الموافق هجرياً
      <input id="f-hijri" type="text" readonly class="hijri-readonly"
             value="${p.date ? formatHijri(p.date, 'long') : formatHijri(today(), 'long')}">
    </label>
    <label style="grid-column:1/-1">العقد
      <select id="f-contract"><option value=""></option>${contractOpts}</select>
    </label>
    <label>المبلغ<input id="f-amount" type="number" step="any" min="0" value="${p.amount || ''}" required></label>
    <label>طريقة الدفع
      <select id="f-method"><option value=""></option>${methodOpts}</select>
    </label>
    <label>المرجع<input id="f-ref" value="${esc(p.ref || '')}"></label>
    <label style="grid-column:1/-1">ملاحظات<input id="f-notes" value="${esc(p.notes || '')}"></label>
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
      code: fm.querySelector('#f-code').value.trim() || null,
      date: fm.querySelector('#f-date').value || null,
      contract_id: fm.querySelector('#f-contract').value || null,
      amount: n(fm.querySelector('#f-amount').value),
      method: fm.querySelector('#f-method').value || null,
      ref: fm.querySelector('#f-ref').value.trim() || null,
      notes: fm.querySelector('#f-notes').value.trim() || null
    };
    if (!row.contract_id) { err.textContent = 'يجب اختيار العقد'; return; }
    if (row.amount <= 0) { err.textContent = 'المبلغ يجب أن يكون أكبر من صفر'; return; }
    try {
      if (id) await api.data.update('payments', id, row, 1);
      else    await api.data.insert('payments', row, 1);
      toast('تم الحفظ');
      dg.close();
      await refresh();
      draw(main);
    } catch (e) { err.textContent = e.message; }
  };
}

function exportCSV() {
  const rows = filtered().map(p => [
    p.id, p.code || '', p.date || '', formatHijri(p.date, 'short'),
    p.contract_id || '', cOf(p.contract_id)?.client || '',
    p.amount || 0, p.method || '', p.ref || '', p.notes || ''
  ]);
  downloadCSV('payments-' + new Date().toISOString().slice(0, 10) + '.csv',
    ['#', 'رقم الدفعة', 'التاريخ (م)', 'التاريخ (هـ)', 'رقم العقد',
     'العميل', 'المبلغ', 'طريقة', 'المرجع', 'ملاحظات'], rows);
  toast('تم التصدير');
}