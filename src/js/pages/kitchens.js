import { api } from '../api.js';
import { toast, esc, n, f2, sum, buildBar, downloadCSV, debounce } from '../ui.js';

let cache = { kitchens: [], contracts: [], expenses: [], meals: [] };
let search = '';

export async function renderKitchens(main) {
  main.innerHTML = '<div class="empty">جاري التحميل…</div>';
  try { await refresh(); draw(main); }
  catch (e) { main.innerHTML = `<div class="empty" style="color:var(--bad)">خطأ: ${esc(e.message)}</div>`; }
}

async function refresh() {
  const [kitchens, contracts, expenses, meals] = await Promise.all([
    api.data.all('kitchens'), api.data.all('contracts'),
    api.data.all('expenses'), api.data.all('meals')
  ]);
  cache = { kitchens, contracts, expenses, meals };
}

function mealsOf(kid, field) {
  const ids = cache.contracts.filter(c => c.kitchen_id === kid).map(c => c.id);
  return sum(cache.meals.filter(m => ids.includes(m.contract_id)), m => m[field]);
}
function expOf(kid) {
  return sum(cache.expenses.filter(x => x.kitchen_id === kid), x => x.amount);
}

function filtered() {
  if (!search) return cache.kitchens;
  const q = search.toLowerCase();
  return cache.kitchens.filter(k =>
    JSON.stringify(Object.values(k)).toLowerCase().includes(q));
}

function draw(main) {
  const rows = filtered();

  const rowsHtml = rows.length
    ? rows.map(k => {
        const cCount = cache.contracts.filter(c => c.kitchen_id === k.id).length;
        const delivered = mealsOf(k.id, 'delivered');
        const exp = expOf(k.id);
        const cpu = delivered ? exp / delivered : 0;
        return `
          <tr>
            <td>${k.id}</td>
            <td>${esc(k.name)}</td>
            <td>${esc(k.loc || '')}</td>
            <td>${f2(k.cap)}</td>
            <td>${esc(k.mgr || '')}</td>
            <td>${esc(k.phone || '')}</td>
            <td>${cCount}</td>
            <td>${f2(delivered)}</td>
            <td>${f2(exp)}</td>
            <td>${f2(cpu)}</td>
            <td>
              <button class="ic" data-edit="${k.id}">تعديل</button>
              <button class="ic d" data-del="${k.id}">حذف</button>
            </td>
          </tr>`;
      }).join('')
    : '';

  const tableHtml = rows.length
    ? `<table>
        <tr>
          <th>#</th><th>اسم المطبخ</th><th>الموقع</th>
          <th>الطاقة اليومية</th><th>المسؤول</th><th>الهاتف</th>
          <th>العقود</th><th>مسلّم</th><th>المصروفات</th><th>تكلفة الوجبة</th>
          <th></th>
        </tr>
        ${rowsHtml}
      </table>`
    : '<div class="empty">لا توجد مطابخ بعد.</div>';

  main.innerHTML = `${buildBar('المطابخ')}<div class="box">${tableHtml}</div>`;

  main.querySelector('#ad').onclick = () => openForm(null, main);
  main.querySelector('#ex').onclick = () => exportCSV();
  const q = main.querySelector('#q');
  if (q) q.oninput = debounce(e => { search = e.target.value.trim(); draw(main); }, 200);

  main.querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = () => openForm(+b.dataset.edit, main));
  main.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = async () => {
      const kid = +b.dataset.del;
      const k = cache.kitchens.find(x => x.id === kid);
      const used = cache.contracts.filter(c => c.kitchen_id === kid).length;
      if (used) { toast(`لا يمكن الحذف — مرتبط بـ ${used} عقد`); return; }
      if (!confirm(`حذف المطبخ «${k.name}» نهائياً؟`)) return;
      try {
        await api.data.remove('kitchens', kid, 1);
        toast('تم الحذف');
        await refresh();
        draw(main);
      } catch (e) { toast(e.message); }
    });
}

function openForm(id, main) {
  const k = id ? cache.kitchens.find(x => x.id === id) : {};
  const dg = document.getElementById('dg');
  const fm = document.getElementById('fm');
  fm.innerHTML = `
    <h3 style="grid-column:1/-1;margin:0">${id ? 'تعديل' : 'إضافة'} مطبخ</h3>
    <label>اسم المطبخ<input id="f-name" value="${esc(k.name || '')}" required></label>
    <label>الموقع<input id="f-loc" value="${esc(k.loc || '')}"></label>
    <label>الطاقة اليومية<input id="f-cap" type="number" step="any" min="0" value="${k.cap || ''}"></label>
    <label>المسؤول<input id="f-mgr" value="${esc(k.mgr || '')}"></label>
    <label>الهاتف<input id="f-phone" value="${esc(k.phone || '')}"></label>
    <div class="err" id="f-err"></div>
    <div class="f">
      <button class="btn g" type="button" id="f-cancel">إلغاء</button>
      <button class="btn" type="button" id="f-save">حفظ</button>
    </div>`;
  dg.showModal();

  fm.querySelector('#f-cancel').onclick = () => dg.close();
  fm.querySelector('#f-save').onclick = async () => {
    const err = fm.querySelector('#f-err');
    err.textContent = '';
    const row = {
      name: fm.querySelector('#f-name').value.trim(),
      loc: fm.querySelector('#f-loc').value.trim() || null,
      cap: n(fm.querySelector('#f-cap').value),
      mgr: fm.querySelector('#f-mgr').value.trim() || null,
      phone: fm.querySelector('#f-phone').value.trim() || null
    };
    if (!row.name) { err.textContent = 'اسم المطبخ مطلوب'; return; }
    try {
      if (id) await api.data.update('kitchens', id, row, 1);
      else    await api.data.insert('kitchens', row, 1);
      toast('تم الحفظ');
      dg.close();
      await refresh();
      draw(main);
    } catch (e) { err.textContent = e.message; }
  };
}

function exportCSV() {
  const rows = filtered().map(k => {
    const cCount = cache.contracts.filter(c => c.kitchen_id === k.id).length;
    return [k.id, k.name, k.loc || '', k.cap || 0, k.mgr || '',
            k.phone || '', cCount, mealsOf(k.id, 'delivered'), expOf(k.id)];
  });
  downloadCSV('kitchens-' + new Date().toISOString().slice(0, 10) + '.csv',
    ['#', 'اسم المطبخ', 'الموقع', 'الطاقة', 'المسؤول', 'الهاتف',
     'العقود', 'مسلّم', 'المصروفات'], rows);
  toast('تم التصدير');
}