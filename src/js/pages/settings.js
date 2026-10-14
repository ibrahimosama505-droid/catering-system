import { api } from '../api.js';
import { toast, esc } from '../ui.js';

const LIST_LABELS = {
  type:    'أنواع العملاء',
  season:  'المواسم',
  loc:     'المواقع',
  service: 'أنواع الخدمة',
  method:  'طرق الدفع',
  cat:     'بنود المصروفات',
  meal:    'أنواع الوجبات',
  agreement_status: 'حالات الاتفاقية',
  pct_options: 'النسب المتاحة %'
};

export async function renderSettings(main) {
  main.innerHTML = '<div class="empty">جاري التحميل…</div>';
  await draw(main, 'type');
}

async function draw(main, activeKey) {
  const lists = await api.lists.all();
  const items = lists[activeKey] || [];

  const buttonsHtml = Object.entries(LIST_LABELS).map(([k, label]) => {
    const cls = k === activeKey ? '' : 'g';
    const count = (lists[k] || []).length;
    return `<button class="btn ${cls}" data-key="${k}">${label} <span style="opacity:.6;margin-inline-start:auto;">(${count})</span></button>`;
  }).join('');

  const itemsHtml = items.length
    ? items.map((item, i) => {
        const status = item.active
          ? '<span class="b s1">مفعّل</span>'
          : '<span class="b s3">معطّل</span>';
        return `
          <tr>
            <td>${i + 1}</td>
            <td>${esc(item.value)}${activeKey === 'pct_options' ? '%' : ''}</td>
            <td>${status}</td>
            <td>
              <button class="ic" data-edit="${item.id}">تعديل</button>
              <button class="ic d" data-del="${item.id}" data-val="${esc(item.value)}">حذف</button>
            </td>
          </tr>`;
      }).join('')
    : '<tr><td colspan="4" style="text-align:center;color:var(--mut)">لا توجد عناصر</td></tr>';

  main.innerHTML = `
    <div class="bar"><h2>إدارة القوائم المنسدلة</h2></div>
    <div class="g2">
      <div class="box">
        <h3>القوائم المتاحة</h3>
        <div id="list-selector">${buttonsHtml}</div>
      </div>
      <div class="box">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <h3 style="margin:0;margin-inline-end:auto">${LIST_LABELS[activeKey]}</h3>
          <button class="btn" id="add-item">+ إضافة</button>
        </div>
        <table>
          <tr><th style="width:40px">#</th><th>القيمة</th><th>الحالة</th><th style="width:120px"></th></tr>
          ${itemsHtml}
        </table>
      </div>
    </div>`;

  main.querySelectorAll('[data-key]').forEach(b =>
    b.onclick = () => draw(main, b.dataset.key));
  main.querySelector('#add-item').onclick = () => addItem(main, activeKey);
  main.querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = () => editItem(main, activeKey, +b.dataset.edit));
  main.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = () => delItem(main, activeKey, +b.dataset.del, b.dataset.val));
}

function addItem(main, key) {
  const dg = document.getElementById('dg');
  const fm = document.getElementById('fm');
  fm.innerHTML = `
    <h3 style="grid-column:1/-1;margin:0">إضافة عنصر — ${LIST_LABELS[key]}</h3>
    <label style="grid-column:1/-1">القيمة
      <input id="f-val" required autofocus
             ${key === 'pct_options' ? 'type="number" step="any" min="0" max="100"' : ''}>
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
    const value = fm.querySelector('#f-val').value.trim();
    if (!value) { err.textContent = 'القيمة مطلوبة'; return; }
    try {
      await api.lists.add(key, value);
      toast('تمت الإضافة');
      dg.close();
      draw(main, key);
    } catch (e) { err.textContent = e.message; }
  };
}

function editItem(main, key, id) {
  const dg = document.getElementById('dg');
  const fm = document.getElementById('fm');
  fm.innerHTML = `
    <h3 style="grid-column:1/-1;margin:0">تعديل عنصر</h3>
    <label style="grid-column:1/-1">القيمة الجديدة
      <input id="f-val" required autofocus
             ${key === 'pct_options' ? 'type="number" step="any" min="0" max="100"' : ''}>
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
    const value = fm.querySelector('#f-val').value.trim();
    if (!value) { err.textContent = 'القيمة مطلوبة'; return; }
    try {
      await api.lists.update(id, value);
      toast('تم التعديل');
      dg.close();
      draw(main, key);
    } catch (e) { err.textContent = e.message; }
  };
}

async function delItem(main, key, id, value) {
  const used = await api.lists.isUsed(key, value);
  if (used) { toast('لا يمكن الحذف — مستخدمة في البيانات'); return; }
  if (!confirm(`حذف «${value}» نهائياً؟`)) return;
  try {
    await api.lists.remove(id);
    toast('تم الحذف');
    draw(main, key);
  } catch (e) { toast(e.message); }
}