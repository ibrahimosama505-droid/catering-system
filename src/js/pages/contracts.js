import { api } from '../api.js';
import { toast, esc, n, f2, sum, today, buildBar, downloadCSV, debounce, formatHijri } from '../ui.js';
import { openImportDialog } from '../import.js';

let cache = {
  contracts: [], payments: [], kitchens: [], marketers: [],
  lists: {}, companyLinks: {}
};
let search = '';

export async function renderContracts(main) {
  main.innerHTML = '<div class="empty">جاري التحميل…</div>';
  try { await refresh(); draw(main); }
  catch (e) { console.error(e); main.innerHTML = `<div class="empty" style="color:var(--bad)">خطأ: ${esc(e.message)}</div>`; }
}

async function refresh() {
  const [contracts, payments, kitchens, marketers, lists] = await Promise.all([
    api.data.all('contracts'), api.data.all('payments'),
    api.data.all('kitchens'), api.data.all('marketers'), api.lists.all()
  ]);
  cache.contracts = contracts || [];
  cache.payments = payments || [];
  cache.kitchens = kitchens || [];
  cache.marketers = marketers || [];
  cache.lists = lists || {};

  try {
    const links = await api.data.all('company_marketers');
    cache.companyLinks = {};
    links.forEach(l => {
      cache.companyLinks[l.company_name] = { marketer_id: l.marketer_id, pct: l.pct };
    });
  } catch (e) {
    cache.companyLinks = {};
  }
}

const kName = id => cache.kitchens.find(k => k.id === id)?.name || '';
const mName = id => cache.marketers.find(m => m.id === id)?.name || '';
const mDefaultPct = id => cache.marketers.find(m => m.id === id)?.default_pct || 0;

const meals = c => n(c.people) * n(c.days) * n(c.mpd);
const calcVal = c => meals(c) * n(c.price);
const val = c => n(c.total_amount) || calcVal(c);
const paid = c => sum(cache.payments.filter(p => p.contract_id === c.id), p => p.amount);
const rem = c => val(c) - paid(c);
const comm = c => val(c) * n(c.pct) / 100;

function status(c) {
  if (!val(c)) return c.agreement_status || '';
  if (rem(c) <= 0.005) return 'مسدد';
  if (paid(c) > 0) return 'مسدد جزئياً';
  return 'غير مسدد';
}
const cls = s => ({
  'مسدد': 's1', 'مسدد جزئياً': 's2', 'غير مسدد': 's3',
  'نشطة': 's1', 'منتهية': 's2', 'ملغاة': 's3', 'معلقة': 's2'
}[s] || '');

function filtered() {
  if (!search) return cache.contracts;
  const q = search.toLowerCase();
  return cache.contracts.filter(c =>
    JSON.stringify(Object.values(c)).toLowerCase().includes(q));
}

// بناء خيارات المسوّقين
function buildMarketerOptions(selectedId) {
  return cache.marketers.map(m =>
    `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>${esc(m.name)}</option>`
  ).join('');
}

// بناء خيارات النسب
function buildPctOptions(currentPct) {
  const pctList = (cache.lists.pct_options || []).map(o => o.value);
  if (currentPct && !pctList.includes(String(currentPct))) {
    pctList.push(String(currentPct));
  }
  // تأكد من ترتيب رقمي
  pctList.sort((a, b) => parseFloat(a) - parseFloat(b));
  return pctList.map(p =>
    `<option value="${esc(p)}" ${String(p) === String(currentPct) ? 'selected' : ''}>${esc(p)}</option>`
  ).join('');
}

function draw(main) {
  const rows = filtered();

  const rowsHtml = rows.length
    ? rows.map(c => {
        const st = status(c);
        const stBadge = st ? `<span class="b ${cls(st)}">${st}</span>` : '';

        // خانة المسوّق القابلة للتعديل
        const marketerCell = `
          <select class="inline-edit" data-type="marketer" data-id="${esc(c.id)}"
                  style="padding:3px 6px;font-size:12px;min-width:130px;background:transparent;border:1px dashed var(--line)">
            <option value="">—</option>
            ${buildMarketerOptions(c.marketer_id)}
          </select>`;

        // خانة النسبة القابلة للتعديل
        const pctCell = `
          <select class="inline-edit" data-type="pct" data-id="${esc(c.id)}"
                  style="padding:3px 6px;font-size:12px;min-width:70px;background:transparent;border:1px dashed var(--line)">
            ${buildPctOptions(c.pct)}
          </select>`;

        return `
          <tr>
            <td>${esc(c.id)}</td>
            <td>${esc(c.client || '')}</td>
            <td>${esc(c.loc || '')}</td>
            <td>${f2(c.days)}</td>
            <td>${esc(c.start || '')}</td>
            <td>${esc(c.ifaqa_end || '')}</td>
            <td>${f2(c.people)}</td>
            <td>${f2(val(c))}</td>
            <td>${stBadge}</td>
            <td>${f2(c.amend_days)}</td>
            <td>${f2(c.pilgrims_after)}</td>
            <td>${f2(paid(c))}</td>
            <td>${f2(rem(c))}</td>
            <td>${marketerCell}</td>
            <td>${pctCell}</td>
            <td>${f2(comm(c))}</td>
            <td>
              <button class="ic" data-edit="${esc(c.id)}">تعديل</button>
              <button class="ic d" data-del="${esc(c.id)}">حذف</button>
            </td>
          </tr>`;
      }).join('')
    : '';

  const tableHtml = rows.length
    ? `<table>
        <tr>
          <th>رقم الاتفاقية</th><th>اسم الشركة المعززة</th><th>منطقة الخدمة</th>
          <th>أيام الإفاقة</th><th>بداية الإفاقة</th><th>نهاية الإفاقة</th>
          <th>عدد المعتمرين</th><th>المبلغ الإجمالي</th><th>حالة الاتفاقية</th>
          <th>أيام التعديل</th><th>بعد التعديل</th>
          <th>المدفوع</th><th>المتبقي</th>
          <th>المسوّق</th><th>النسبة</th><th>العمولة</th>
          <th></th>
        </tr>
        ${rowsHtml}
      </table>`
    : '<div class="empty">لا توجد عقود بعد.</div>';

  const extra = '<button class="btn g" id="imp">📥 استيراد</button>';

  main.innerHTML = `${buildBar('العقود', { extra })}<div class="box">${tableHtml}</div>`;

  const adBtn = main.querySelector('#ad');
  const exBtn = main.querySelector('#ex');
  const impBtn = main.querySelector('#imp');
  const qInput = main.querySelector('#q');

  if (adBtn) adBtn.onclick = () => openForm(null, main);
  if (exBtn) exBtn.onclick = () => exportCSV();
  if (impBtn) impBtn.onclick = () =>
    openImportDialog(main, async () => { await refresh(); draw(main); });
  if (qInput) qInput.oninput = debounce(e => {
    search = e.target.value.trim();
    draw(main);
  }, 200);

  // ====== التعديل المباشر داخل الجدول ======
  main.querySelectorAll('.inline-edit').forEach(sel => {
    sel.onchange = async () => {
      const contractId = sel.dataset.id;
      const type = sel.dataset.type;
      const value = sel.value;

      const contract = cache.contracts.find(c => c.id === contractId);
      if (!contract) return;

      try {
        const updateRow = {};

        if (type === 'marketer') {
          updateRow.marketer_id = value ? +value : null;

          // لو النسبة فاضية، عبّيها من النسبة الافتراضية للمسوّق
          if (value && !contract.pct) {
            const pct = mDefaultPct(+value);
            if (pct) updateRow.pct = pct;
          }
        } else if (type === 'pct') {
          updateRow.pct = value ? n(value) : 0;
        }

        await api.data.update('contracts', contractId, updateRow, 1);

        // حدّث الربط بالشركة لو المسوّق اتغير
        if (type === 'marketer' && contract.client) {
          try {
            const links = await api.data.all('company_marketers');
            const existing = links.find(l => l.company_name === contract.client);
            if (existing) {
              await api.data.update('company_marketers', existing.id, {
                marketer_id: value ? +value : null,
                pct: contract.pct || 0
              }, 1);
            } else if (value) {
              await api.data.insert('company_marketers', {
                company_name: contract.client,
                marketer_id: +value,
                pct: contract.pct || 0
              }, 1);
            }
          } catch (e) { console.warn('Link update failed:', e); }
        }

        toast('تم التحديث');
        await refresh();
        draw(main);
      } catch (e) {
        console.error(e);
        toast('فشل التحديث: ' + e.message);
      }
    };
  });

  // ====== الأزرار العادية ======
  main.querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = () => openForm(b.dataset.edit, main));
  main.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = async () => {
      const id = b.dataset.del;
      const pays = cache.payments.filter(p => p.contract_id === id).length;
      if (pays) { toast(`لا يمكن الحذف — مرتبط بـ ${pays} دفعة`); return; }
      if (!confirm(`حذف العقد «${id}» نهائياً؟`)) return;
      try {
        await api.data.remove('contracts', id, 1);
        toast('تم الحذف');
        await refresh();
        draw(main);
      } catch (e) { toast(e.message); }
    });
}

function buildSelect(name, list, currentVal) {
  const opts = list.map(o => {
    const v = o.value ?? o.id ?? o;
    const label = o.label ?? o.name ?? o;
    const selected = String(v) === String(currentVal) ? ' selected' : '';
    return `<option value="${esc(v)}"${selected}>${esc(label)}</option>`;
  }).join('');
  return `<select id="f-${name}"><option value=""></option>${opts}</select>`;
}

function openForm(id, main) {
  const c = id ? cache.contracts.find(x => x.id === id) : {};
  const dg = document.getElementById('dg');
  const fm = document.getElementById('fm');

  const pctList = (cache.lists.pct_options || []).map(o => o.value);
  if (c.pct && !pctList.includes(String(c.pct))) {
    pctList.push(String(c.pct));
  }
  const pctOptionsHtml = pctList.map(p =>
    `<option value="${esc(p)}" ${String(p) === String(c.pct) ? 'selected' : ''}>${esc(p)}%</option>`
  ).join('');

  const marketerOptionsHtml = cache.marketers.map(m =>
    `<option value="${m.id}" ${m.id === c.marketer_id ? 'selected' : ''}>${esc(m.name)}</option>`
  ).join('');

  fm.innerHTML = `
    <h3 style="grid-column:1/-1;margin:0">${id ? 'تعديل' : 'إضافة'} عقد</h3>

    <label>رقم الاتفاقية
      <input id="f-id" value="${esc(c.id || '')}" ${id ? 'readonly' : ''} required>
    </label>
    <label>اسم الشركة المعززة
      <input id="f-client" value="${esc(c.client || '')}" list="companies-list">
      <datalist id="companies-list">
        ${cache.contracts.map(x => `<option value="${esc(x.client || '')}">`).join('')}
      </datalist>
    </label>

    <label>منطقة الخدمة ${buildSelect('loc', cache.lists.loc || [], c.loc)}</label>
    <label>حالة الاتفاقية ${buildSelect('agreement_status', cache.lists.agreement_status || [], c.agreement_status)}</label>
    <label>عدد أيام الإفاقة<input id="f-days" type="number" step="any" min="0" value="${c.days || ''}"></label>
    <label>تاريخ بداية الإفاقة<input id="f-start" type="date" value="${c.start || ''}"></label>
    <label>تاريخ نهاية الإفاقة<input id="f-ifaqa_end" type="date" value="${c.ifaqa_end || ''}"></label>
    <label>عدد المعتمرين<input id="f-people" type="number" step="any" min="0" value="${c.people || ''}"></label>
    <label>المبلغ الإجمالي<input id="f-total_amount" type="number" step="any" min="0" value="${c.total_amount || ''}"></label>
    <label>سبب التعديل<input id="f-amend_reason" value="${esc(c.amend_reason || '')}"></label>
    <label>أيام التعديل<input id="f-amend_days" type="number" step="any" min="0" value="${c.amend_days || ''}"></label>
    <label>عدد المعتمرين بعد التعديل<input id="f-pilgrims_after" type="number" step="any" min="0" value="${c.pilgrims_after || ''}"></label>

    <label style="grid-column:1/-1">المسوّق
      <select id="f-marketer_id">
        <option value="">— اختر مسوّق —</option>
        ${marketerOptionsHtml}
      </select>
    </label>

    <label>النسبة %
      <select id="f-pct">
        <option value="">— اختر نسبة —</option>
        ${pctOptionsHtml}
      </select>
    </label>
    <label>نسبة مخصصة (اختياري)
      <input id="f-pct-custom" type="number" step="any" min="0" max="100" placeholder="اكتب نسبة مخصصة">
    </label>

    <label>التاريخ<input id="f-date" type="date" value="${c.date || today()}"></label>
    <label>الموافق هجرياً
      <input id="f-hijri" type="text" readonly class="hijri-readonly"
             value="${c.date ? formatHijri(c.date, 'long') : formatHijri(today(), 'long')}">
    </label>
    <label>نوع العميل ${buildSelect('type', cache.lists.type || [], c.type)}</label>
    <label>الموسم ${buildSelect('season', cache.lists.season || [], c.season)}</label>
    <label>نوع الخدمة ${buildSelect('service', cache.lists.service || [], c.service)}</label>
    <label>المطبخ ${buildSelect('kitchen_id', cache.kitchens, c.kitchen_id)}</label>
    <label>وجبات/يوم<input id="f-mpd" type="number" step="any" min="0" value="${c.mpd || ''}"></label>
    <label>سعر الوجبة<input id="f-price" type="number" step="any" min="0" value="${c.price || ''}"></label>
    <label style="grid-column:1/-1">ملاحظات<input id="f-notes" value="${esc(c.notes || '')}"></label>

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

  const marketerSel = fm.querySelector('#f-marketer_id');
  const pctSel = fm.querySelector('#f-pct');
  const pctCustom = fm.querySelector('#f-pct-custom');
  const clientInput = fm.querySelector('#f-client');

  marketerSel.onchange = () => {
    const mid = +marketerSel.value;
    if (!mid) return;
    const pct = mDefaultPct(mid);
    if (pct) {
      const exists = [...pctSel.options].some(o => o.value === String(pct));
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = String(pct);
        opt.textContent = pct + '%';
        pctSel.appendChild(opt);
      }
      pctSel.value = String(pct);
      pctCustom.value = '';
    }
  };

  clientInput.onblur = () => {
    const companyName = clientInput.value.trim();
    if (!companyName) return;
    const link = cache.companyLinks[companyName];
    if (link && link.marketer_id) {
      marketerSel.value = String(link.marketer_id);
      if (link.pct) {
        const exists = [...pctSel.options].some(o => o.value === String(link.pct));
        if (!exists) {
          const opt = document.createElement('option');
          opt.value = String(link.pct);
          opt.textContent = link.pct + '%';
          pctSel.appendChild(opt);
        }
        pctSel.value = String(link.pct);
      }
    }
  };

  pctCustom.oninput = () => {
    const v = pctCustom.value.trim();
    if (v) {
      const exists = [...pctSel.options].some(o => o.value === v);
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v + '%';
        pctSel.appendChild(opt);
      }
      pctSel.value = v;
    }
  };

  fm.querySelector('#f-cancel').onclick = () => dg.close();
  fm.querySelector('#f-save').onclick = async () => {
    const err = fm.querySelector('#f-err');
    err.textContent = '';

    let finalPct = n(pctSel.value);
    if (pctCustom.value.trim()) {
      finalPct = n(pctCustom.value);
    }

    const row = {
      id: fm.querySelector('#f-id').value.trim(),
      client: fm.querySelector('#f-client').value.trim() || null,
      loc: fm.querySelector('#f-loc').value || null,
      days: n(fm.querySelector('#f-days').value),
      start: fm.querySelector('#f-start').value || null,
      ifaqa_end: fm.querySelector('#f-ifaqa_end').value || null,
      people: n(fm.querySelector('#f-people').value),
      total_amount: n(fm.querySelector('#f-total_amount').value),
      agreement_status: fm.querySelector('#f-agreement_status').value || null,
      amend_reason: fm.querySelector('#f-amend_reason').value.trim() || null,
      amend_days: n(fm.querySelector('#f-amend_days').value),
      pilgrims_after: n(fm.querySelector('#f-pilgrims_after').value),
      marketer_id: n(fm.querySelector('#f-marketer_id').value) || null,
      pct: finalPct,
      date: fm.querySelector('#f-date').value || null,
      type: fm.querySelector('#f-type').value || null,
      season: fm.querySelector('#f-season').value || null,
      service: fm.querySelector('#f-service').value || null,
      kitchen_id: n(fm.querySelector('#f-kitchen_id').value) || null,
      mpd: n(fm.querySelector('#f-mpd').value),
      price: n(fm.querySelector('#f-price').value),
      notes: fm.querySelector('#f-notes').value.trim() || null
    };

    if (!row.id) { err.textContent = 'رقم الاتفاقية مطلوب'; return; }

    try {
      if (id) await api.data.update('contracts', id, row, 1);
      else    await api.data.insert('contracts', row, 1);

      if (row.client && row.marketer_id) {
        try {
          const links = await api.data.all('company_marketers');
          const existing = links.find(l => l.company_name === row.client);
          if (existing) {
            await api.data.update('company_marketers', existing.id, {
              marketer_id: row.marketer_id,
              pct: finalPct
            }, 1);
          } else {
            await api.data.insert('company_marketers', {
              company_name: row.client,
              marketer_id: row.marketer_id,
              pct: finalPct
            }, 1);
          }
        } catch (e) { console.warn('Link failed:', e); }
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
  const rows = filtered().map(c => [
    c.id, c.client || '', c.loc || '', c.days || 0,
    c.start || '', c.ifaqa_end || '', c.people || 0,
    val(c), c.agreement_status || '', c.amend_reason || '',
    c.amend_days || 0, c.pilgrims_after || 0,
    paid(c), rem(c), status(c),
    mName(c.marketer_id), c.pct || 0, comm(c)
  ]);
  downloadCSV('contracts-' + new Date().toISOString().slice(0, 10) + '.csv',
    ['رقم الاتفاقية', 'اسم الشركة المعززة', 'منطقة الخدمة', 'عدد أيام الإفاقة',
     'تاريخ بداية الإفاقة', 'تاريخ نهاية الإفاقة', 'عدد المعتمرين',
     'المبلغ الإجمالي', 'حالة الاتفاقية', 'سبب التعديل',
     'أيام التعديل', 'عدد المعتمرين بعد التعديل',
     'المدفوع', 'المتبقي', 'الحالة',
     'المسوّق', 'النسبة %', 'العمولة'], rows);
  toast('تم التصدير');
}