import { initAuth } from './auth.js';
import { maybeMigrate } from './migrate.js';
import { esc, todayHijri } from './ui.js';
import { renderUsers } from './pages/users.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderKitchens } from './pages/kitchens.js';
import { renderMarketers } from './pages/marketers.js';
import { renderContracts } from './pages/contracts.js';
import { renderPayments } from './pages/payments.js';
import { renderExpenses } from './pages/expenses.js';
import { renderMeals } from './pages/meals.js';
import { renderSettings } from './pages/settings.js';

let CURRENT_USER = null;

async function boot() {
  await initAuth(user => {
    CURRENT_USER = user;
    onLoggedIn();
  });
}

async function onLoggedIn() {
  if (CURRENT_USER && CURRENT_USER.data && !CURRENT_USER.full_name) {
    CURRENT_USER = CURRENT_USER.data;
  }

  document.getElementById('screen-auth').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');

  const fullName = CURRENT_USER?.full_name || CURRENT_USER?.username || 'مستخدم';
  const role = CURRENT_USER?.role || 'user';
  document.getElementById('user-info').textContent = `${fullName} (${roleAr(role)})`;

  const hijriEl = document.getElementById('hijri-header');
  if (hijriEl) hijriEl.textContent = todayHijri('long');

  try { await maybeMigrate(CURRENT_USER); }
  catch (e) { console.error('Migration error:', e); }

  renderNav();
  showPage('dash');

  document.getElementById('btn-logout').onclick = () => {
    if (confirm('تسجيل الخروج؟')) location.reload();
  };
}

const TABS = [
  ['dash',      'الرئيسية',     ['admin', 'manager', 'user']],
  ['contracts', 'العقود',       ['admin', 'manager', 'user']],
  ['payments',  'المدفوعات',    ['admin', 'manager', 'user']],
  ['expenses',  'المصروفات',    ['admin', 'manager', 'user']],
  ['kitchens',  'المطابخ',      ['admin', 'manager', 'user']],
  ['marketers', 'المسوّقون',    ['admin', 'manager', 'user']],
  ['meals',     'جدول الوجبات', ['admin', 'manager', 'user']],
  ['settings',  'الإعدادات',    ['admin', 'manager']],
  ['users',     'المستخدمون',   ['admin']]
];

function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = TABS
    .filter(([, , roles]) => roles.includes(CURRENT_USER?.role))
    .map(([k, l]) => `<button data-t="${k}">${l}</button>`).join('');
  nav.onclick = e => {
    const t = e.target.dataset.t;
    if (t) showPage(t);
  };
}

const RENDERERS = {
  dash:      main => renderDashboard(main),
  contracts: main => renderContracts(main),
  payments:  main => renderPayments(main),
  expenses:  main => renderExpenses(main),
  kitchens:  main => renderKitchens(main),
  marketers: main => renderMarketers(main),
  meals:     main => renderMeals(main),
  settings:  main => renderSettings(main),
  users:     main => renderUsers(main, CURRENT_USER)
};

async function showPage(key) {
  document.querySelectorAll('#nav button').forEach(b =>
    b.classList.toggle('on', b.dataset.t === key));

  const main = document.getElementById('main');
  main.innerHTML = '<div class="empty">جاري التحميل…</div>';

  try {
    const renderer = RENDERERS[key];
    if (renderer) return renderer(main);
    main.innerHTML = `<div class="empty">شاشة غير معروفة: ${esc(key)}</div>`;
  } catch (e) {
    console.error('showPage error:', e);
    main.innerHTML = `<div class="empty" style="color:var(--bad)">خطأ: ${esc(e.message)}</div>`;
  }
}

const roleAr = r => ({ admin: 'مدير عام', manager: 'مشرف', user: 'مستخدم' }[r] || r);

boot();