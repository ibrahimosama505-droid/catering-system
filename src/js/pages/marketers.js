import { api } from '../api.js';
import { toast, esc, n, f2, sum, buildBar, downloadCSV, debounce } from '../ui.js';

let cache = { marketers: [], contracts: [] };
let search = '';

export async function renderMarketers(main) {
  main.innerHTML = '<div class="empty">جاري التحميل…</div>';
  try {
    await refresh();
    draw(main);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="empty" style="color:var(--bad)">خطأ: ${esc(e.message)}</div>`;
  }
}

async function refresh() {
  const [marketers, contracts] = await Promise.all([
    api.data.all('marketers'),
    api.data.all('contracts')
  ]);
  cache.marketers = marketers || [];
  cache.contracts = contracts || [];
}

const mealsOf = c => n(c.people) * n(c.days) * n(c.mpd);
const valOf = c => n(c.total_amount) || (mealsOf(c) * n(c.price));
const commOf = c => valOf(c) * n(c.pct) / 100;

function filtered() {
  if (!search) return cache.marketers;
  const q = search.toLowerCase();
  return cache.marketers.filter(m =>
    JSON.stringify(Object.values(m)).toLowerCase().includes(q));
}

function draw(main) {
  const rows = filtered();

  const rowsHtml = rows.length
    ? rows.map(m => {
        const cs = cache.contracts.filter(c => c.marketer_id === m.id);
        return `
          <tr>
            <td>${m.id}</td>
            <td>${esc(m.name)}</td>
            <td>${esc(m.phone || '')}</td>
            <td>${f2(m.default_pct)}%</td>
            <td>${cs.length}</td>
            <td>${f2(sum(cs, valOf))}</td>
            <td>${f2(sum(cs, commOf))}</td>
            <td>
              <button class="ic" data-edit="${m.id}">تعديل</button>
              <button class="ic d" data-del="${m.id}">حذف</button>
            </td>
          </tr>`;
      }).join('')
    : '';

  const tableHtml = rows.length
    ? `<table>
        <tr>
          <th>#</th><th>اسم المسوّق</th><th>الهاتف</th>
          <th>النسبة الافتراضية</th>
          <th>العقود</th><th>قيمة العقود</th><th>العمولات</th>
          <th></th>
        </tr>
        ${rowsHtml}
      </table>`
    : '<div class="empty">لا يوجد مسوّقون بعد. اضغط «+ إضافة» لإضافة أول مسوّق.</div>';

  main.innerHTML = `${buildBar('المسوّقون')}<div class="box">${tableHtml}</div>`;

  const adBtn = main.querySelector('#ad');
  const exBtn = main.querySelector('#ex');
  const qInput = main.querySelector('#q');

  if (adBtn) adBtn.onclick = () => openForm(null, main);
  if (exBtn) exBtn.onclick = () => exportCSV();
  if (qInput) qInput.oninput = debounce(e => {
    search = e.target.value.trim();
    draw(main);
  }, 200);

  main.querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = () => openForm(+b.dataset.edit, main));
  main.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = async () => {
      const id = +b.dataset.del;
      const m = cache.marketers.find(x => x.id === id);
      const used = cache.contracts.filter(c => c.marketer_id === id).length;
      if (used) {
        toast(`لا يمكن الحذف — مرتبط بـ ${used} عقد`);
        return;
      }
      if (!confirm(`حذف المسوّق «${m.name}» نهائياً؟`)) return;
      try {
        await api.data.remove('marketers', id, 1);
        toast('تم الحذف');
        await refresh();
        draw(main);
      } catch (e) { toast(e.message); }
    });
}

function openForm(id, main) {
  const m = id ? cache.marketers.find(x => x.id === id) : {};
  const dg = document.getElementById('dg');
  const fm = document.getElementById('fm');

  fm.innerHTML = `
    <h3 style="grid-column:1/-1;margin:0">${id ? 'تعديل' : 'إضافة'} مسوّق</h3>
    <label>اسم المسوّق
      <input id="f-name" value="${esc(m.name || '')}" required autofocus>
    </label>
    <label>الهاتف
      <input id="f-phone" value="${esc(m.phone || '')}">
    </label>
    <label style="grid-column:1/-1">النسبة الافتراضية %
      <input id="f-default_pct" type="number" step="any" min="0" max="100"
             value="${m.default_pct ?? ''}" placeholder="مثال: 10">
    </label>
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
      phone: fm.querySelector('#f-phone').value.trim() || null,
      default_pct: n(fm.querySelector('#f-default_pct').value)
    };

    if (!row.name) { err.textContent = 'اسم المسوّق مطلوب'; return; }

    try {
      if (id) {
        await api.data.update('marketers', id, row, 1);
      } else {
        await api.data.insert('marketers', row, 1);
      }
      toast('تم الحفظ');
      dg.close();
      await refresh();
      draw(main);
    } catch (e) {
      console.error(e);
      err.textContent = e.message || 'فشل الحفظ';
    }
  };
}

function exportCSV() {
  const rows = filtered().map(m => {
    const cs = cache.contracts.filter(c => c.marketer_id === m.id);
    return [m.id, m.name, m.phone || '', m.default_pct || 0,
            cs.length, sum(cs, valOf), sum(cs, commOf)];
  });
  downloadCSV('marketers-' + new Date().toISOString().slice(0, 10) + '.csv',
    ['#', 'الاسم', 'الهاتف', 'النسبة الافتراضية %',
     'العقود', 'قيمة العقود', 'العمولات'], rows);
  toast('تم التصدير');
}