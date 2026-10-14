import { api } from '../api.js';
import { esc, n, f2, sum, MONTHS_AR, MONTHS_HIJRI, formatHijri, todayHijri, toHijri } from '../ui.js';

let _charts = [];

export async function renderDashboard(main) {
  _charts.forEach(c => { try { c.destroy(); } catch(e) {} });
  _charts = [];

  main.innerHTML = '<div class="empty">جاري تحميل البيانات…</div>';

  let contracts = [], payments = [], expenses = [], meals = [], kitchens = [];
  try {
    [contracts, payments, expenses, meals, kitchens] = await Promise.all([
      api.data.all('contracts'), api.data.all('payments'),
      api.data.all('expenses'), api.data.all('meals'), api.data.all('kitchens')
    ]);
  } catch (e) {
    main.innerHTML = `<div class="empty" style="color:var(--bad)">خطأ: ${esc(e.message)}</div>`;
    return;
  }

  const mealsOf = c => n(c.people) * n(c.days) * n(c.mpd);
  const valOf = c => mealsOf(c) * n(c.price);
  const paidOf = c => sum(payments.filter(p => p.contract_id === c.id), p => p.amount);
  const remOf = c => valOf(c) - paidOf(c);
  const commOf = c => valOf(c) * n(c.pct) / 100;

  const totalVal = sum(contracts, valOf);
  const totalPaid = sum(payments, p => p.amount);
  const totalExp = sum(expenses, x => x.amount);
  const totalMeals = sum(contracts, mealsOf);
  const deliveredMeals = sum(meals, m => m.delivered);

  const K = [
    ['عدد العقود', contracts.length],
    ['إجمالي الأفراد', sum(contracts, c => c.people)],
    ['وجبات العقود', totalMeals],
    ['قيمة العقود', totalVal],
    ['المحصّل', totalPaid],
    ['المتبقي على العملاء', totalVal - totalPaid],
    ['المصروفات', totalExp],
    ['صافي التدفق', totalPaid - totalExp],
    ['عمولات المسوّقين', sum(contracts, commOf)],
    ['وجبات مخطّطة', sum(meals, m => m.planned)],
    ['وجبات مسلّمة', deliveredMeals],
    ['نسبة التسليم', totalMeals ? (deliveredMeals / totalMeals * 100).toFixed(1) + '%' : '—']
  ];

  // ===== التقرير الشهري (ميلادي) =====
  const year = new Date().getFullYear();
  const monthly = MONTHS_AR.map((m, i) => {
    const p = String(i + 1).padStart(2, '0');
    const key = year + '-' + p;
    const ok = d => (d || '').slice(0, 7) === key;
    const cs = contracts.filter(c => ok(c.date));
    const a = sum(payments.filter(x => ok(x.date)), x => x.amount);
    const b = sum(expenses.filter(x => ok(x.date)), x => x.amount);
    return {
      m, contracts: cs.length, value: sum(cs, valOf),
      paid: a, exp: b, net: a - b,
      delivered: sum(meals.filter(x => ok(x.date)), x => x.delivered)
    };
  });

  // ===== التقرير الهجري للسنة الحالية =====
  const currentHijriYear = toHijri(new Date())?.year || 1447;
  const monthlyHijri = MONTHS_HIJRI.map((m, i) => {
    const monthNum = i + 1;
    const cs = contracts.filter(c => {
      const h = toHijri(c.date);
      return h && h.year === currentHijriYear && h.month === monthNum;
    });
    const a = sum(payments.filter(p => {
      const h = toHijri(p.date);
      return h && h.year === currentHijriYear && h.month === monthNum;
    }), x => x.amount);
    const b = sum(expenses.filter(e => {
      const h = toHijri(e.date);
      return h && h.year === currentHijriYear && h.month === monthNum;
    }), x => x.amount);
    return {
      m, contracts: cs.length, value: sum(cs, valOf),
      paid: a, exp: b, net: a - b
    };
  });

  const byLoc = {};
  contracts.forEach(c => {
    const k = c.loc || 'غير محدد';
    if (!byLoc[k]) byLoc[k] = { count: 0, val: 0, rem: 0 };
    byLoc[k].count++;
    byLoc[k].val += valOf(c);
    byLoc[k].rem += remOf(c);
  });

  const byStatus = { 'مسدد': 0, 'مسدد جزئياً': 0, 'غير مسدد': 0 };
  contracts.forEach(c => {
    if (!valOf(c)) return;
    const r = remOf(c);
    if (r <= 0.005) byStatus['مسدد']++;
    else if (paidOf(c) > 0) byStatus['مسدد جزئياً']++;
    else byStatus['غير مسدد']++;
  });

  const byCat = {};
  expenses.forEach(x => {
    const k = x.cat || 'أخرى';
    byCat[k] = (byCat[k] || 0) + n(x.amount);
  });

  const kSorted = kitchens.map(k => {
    const cs = contracts.filter(c => c.kitchen_id === k.id);
    const ids = cs.map(c => c.id);
    const delivered = sum(meals.filter(m => ids.includes(m.contract_id)), m => m.delivered);
    return { name: k.name, delivered };
  }).sort((a, b) => b.delivered - a.delivered).slice(0, 5);

  const monthlyRowsHtml = monthly.map(r => {
    const color = r.net < 0 ? 'var(--bad)' : 'var(--ok)';
    return `<tr>
      <td>${r.m}</td><td>${r.contracts}</td><td>${f2(r.value)}</td>
      <td>${f2(r.paid)}</td><td>${f2(r.exp)}</td>
      <td style="color:${color}">${f2(r.net)}</td>
      <td>${f2(r.delivered)}</td>
    </tr>`;
  }).join('');

  const monthlyHijriRowsHtml = monthlyHijri.map(r => {
    const color = r.net < 0 ? 'var(--bad)' : 'var(--ok)';
    return `<tr>
      <td>${r.m}</td><td>${r.contracts}</td><td>${f2(r.value)}</td>
      <td>${f2(r.paid)}</td><td>${f2(r.exp)}</td>
      <td style="color:${color}">${f2(r.net)}</td>
    </tr>`;
  }).join('');

  const locRowsHtml = Object.entries(byLoc).map(([loc, v]) => `
    <tr><td>${esc(loc)}</td><td>${v.count}</td><td>${f2(v.val)}</td><td>${f2(v.rem)}</td></tr>
  `).join('');

  const lastContractsHtml = contracts.slice(-5).reverse().map(c => {
    const rem = remOf(c);
    const color = rem > 0 ? 'var(--bad)' : 'var(--ok)';
    return `<tr>
      <td>${esc(c.id)}</td>
      <td>${esc(c.client || '')}</td>
      <td>${esc(c.date || '')}</td>
      <td class="hijri">${formatHijri(c.date, 'short')}</td>
      <td>${f2(valOf(c))}</td>
      <td style="color:${color}">${f2(rem)}</td>
    </tr>`;
  }).join('');

  main.innerHTML = `
    <div class="bar">
      <h2>لوحة المعلومات</h2>
      <span class="user-chip" style="background:var(--hl);color:var(--pri-dark);">${todayHijri('long')}</span>
    </div>

    <div class="kp">
      ${K.map(([l, v]) => `
        <div class="${typeof v === 'number' && v < 0 ? 'neg' : ''}">
          <small>${l}</small>
          <b>${typeof v === 'number' ? f2(v) : v}</b>
        </div>`).join('')}
    </div>

    <div class="g2">
      <div class="box">
        <h3>التدفق الشهري (ميلادي)</h3>
        <div class="chart-wrap"><canvas id="chart-monthly"></canvas></div>
      </div>
      <div class="box">
        <h3>حسب حالة السداد</h3>
        <div class="chart-wrap"><canvas id="chart-status"></canvas></div>
      </div>
      <div class="box">
        <h3>المصروفات حسب البند</h3>
        <div class="chart-wrap"><canvas id="chart-cat"></canvas></div>
      </div>
      <div class="box">
        <h3>أعلى 5 مطابخ</h3>
        <div class="chart-wrap"><canvas id="chart-kitchens"></canvas></div>
      </div>
    </div>

    <div class="box">
      <h3>التقرير الشهري الميلادي – ${year}</h3>
      <table>
        <tr>
          <th>الشهر</th><th>عقود جديدة</th><th>قيمة العقود</th>
          <th>المحصّل</th><th>المصروفات</th><th>صافي التدفق</th>
          <th>وجبات مسلّمة</th>
        </tr>
        ${monthlyRowsHtml}
      </table>
    </div>

    <div class="box">
      <h3>التقرير الشهري الهجري – ${currentHijriYear} هـ</h3>
      <table>
        <tr>
          <th>الشهر الهجري</th><th>عقود جديدة</th><th>قيمة العقود</th>
          <th>المحصّل</th><th>المصروفات</th><th>صافي التدفق</th>
        </tr>
        ${monthlyHijriRowsHtml}
      </table>
    </div>

    <div class="g2">
      <div class="box">
        <h3>حسب الموقع</h3>
        <table>
          <tr><th>الموقع</th><th>العقود</th><th>القيمة</th><th>المتبقي</th></tr>
          ${locRowsHtml || '<tr><td colspan="4" style="text-align:center;color:var(--mut)">لا توجد بيانات</td></tr>'}
        </table>
      </div>
      <div class="box">
        <h3>آخر 5 عقود</h3>
        <table>
          <tr><th>رقم العقد</th><th>العميل</th><th>التاريخ (م)</th><th>التاريخ (هـ)</th><th>القيمة</th><th>المتبقي</th></tr>
          ${lastContractsHtml || '<tr><td colspan="6" style="text-align:center;color:var(--mut)">لا توجد عقود</td></tr>'}
        </table>
      </div>
    </div>`;

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#e2e8f0' : '#1e293b';

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 200,
    animation: { duration: 400 },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: textColor,
          font: { family: 'Segoe UI, Tahoma', size: 12 },
          padding: 12,
          usePointStyle: true,
          boxWidth: 8
        }
      },
      tooltip: { rtl: true, textDirection: 'rtl' }
    },
    scales: {
      x: {
        ticks: { color: textColor, font: { family: 'Segoe UI, Tahoma', size: 11 } },
        grid: { color: gridColor, drawBorder: false }
      },
      y: {
        ticks: { color: textColor, font: { family: 'Segoe UI, Tahoma', size: 11 } },
        grid: { color: gridColor, drawBorder: false }
      }
    }
  };

  const PALETTE = {
    primary: '#1e40af',
    primarySoft: 'rgba(30,64,175,0.15)',
    light: '#3b82f6',
    lightSoft: 'rgba(59,130,246,0.15)',
    green: '#059669',
    amber: '#d97706',
    red: '#dc2626',
    purple: '#7c3aed',
    purpleSoft: 'rgba(124,58,237,0.65)'
  };

  _charts.push(new Chart(main.querySelector('#chart-monthly'), {
    type: 'line',
    data: {
      labels: MONTHS_AR,
      datasets: [
        {
          label: 'المحصّل',
          data: monthly.map(r => r.paid),
          borderColor: PALETTE.primary,
          backgroundColor: PALETTE.primarySoft,
          tension: 0.35, fill: true,
          pointRadius: 3, pointHoverRadius: 6, borderWidth: 2.5
        },
        {
          label: 'المصروفات',
          data: monthly.map(r => r.exp),
          borderColor: PALETTE.light,
          backgroundColor: PALETTE.lightSoft,
          tension: 0.35, fill: true,
          pointRadius: 3, pointHoverRadius: 6, borderWidth: 2.5
        }
      ]
    },
    options: commonOptions
  }));

  _charts.push(new Chart(main.querySelector('#chart-status'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(byStatus),
      datasets: [{
        data: Object.values(byStatus),
        backgroundColor: [PALETTE.green, PALETTE.amber, PALETTE.red],
        borderColor: isDark ? '#1e293b' : '#fff',
        borderWidth: 3, hoverOffset: 8
      }]
    },
    options: {
      ...commonOptions,
      cutout: '62%',
      scales: {}
    }
  }));

  const catKeys = Object.keys(byCat);
  _charts.push(new Chart(main.querySelector('#chart-cat'), {
    type: 'bar',
    data: {
      labels: catKeys,
      datasets: [{
        label: 'المبلغ',
        data: catKeys.map(k => byCat[k]),
        backgroundColor: PALETTE.purpleSoft,
        borderColor: PALETTE.purple,
        borderWidth: 1.5, borderRadius: 6, borderSkipped: false
      }]
    },
    options: {
      ...commonOptions,
      indexAxis: 'y',
      plugins: { ...commonOptions.plugins, legend: { display: false } },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: 'Segoe UI, Tahoma', size: 11 } },
          grid: { color: gridColor, drawBorder: false }
        },
        y: {
          ticks: { color: textColor, font: { family: 'Segoe UI, Tahoma', size: 11 } },
          grid: { display: false }
        }
      }
    }
  }));

  _charts.push(new Chart(main.querySelector('#chart-kitchens'), {
    type: 'bar',
    data: {
      labels: kSorted.map(x => x.name),
      datasets: [{
        label: 'وجبات مسلّمة',
        data: kSorted.map(x => x.delivered),
        backgroundColor: PALETTE.primary,
        borderColor: PALETTE.light,
        borderWidth: 1.5, borderRadius: 6, borderSkipped: false
      }]
    },
    options: {
      ...commonOptions,
      plugins: { ...commonOptions.plugins, legend: { display: false } }
    }
  }));
}