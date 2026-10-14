import { api } from './api.js';
import { toast, todayHijri, esc } from './ui.js';

export async function initAuth(onSuccess) {
  const screen = document.getElementById('screen-auth');
  if (!screen) return;

  if (!window.api || !window.api.auth) {
    screen.innerHTML = errorCard('فشل تحميل الجسر الآمن',
      'تأكد من تشغيل التطبيق من Electron.');
    return;
  }

  screen.innerHTML = '<div class="auth-card"><h2>جاري التحميل…</h2></div>';

  let has = false;
  try { has = await api.auth.hasUsers(); }
  catch (e) {
    screen.innerHTML = errorCard('فشل الاتصال بقاعدة البيانات', e.message);
    return;
  }

  const hijri = todayHijri('long');
  screen.innerHTML = has ? loginHTML(hijri) : firstUserHTML(hijri);
  bindAuth(screen, has, onSuccess);
}

function loginHTML(hijri) {
  return `
  <div class="auth-card">
    <div class="auth-logo">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="none"
           stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 21h18"/>
        <path d="M5 21V8l7-5 7 5v13"/>
        <path d="M9 21v-6h6v6"/>
      </svg>
    </div>
    <h2>تسجيل الدخول</h2>
    <p class="muted">نظام إدارة الإعاشة – الحج والعمرة</p>
    <p class="hijri-line">${hijri}</p>
    <form id="auth-form" autocomplete="off">
      <div class="field">
        <label for="username">اسم المستخدم</label>
        <input id="username" name="username" type="text" required autofocus
               autocomplete="username" placeholder="اكتب اسم المستخدم">
      </div>
      <div class="field">
        <label for="password">كلمة المرور</label>
        <input id="password" name="password" type="password" required
               autocomplete="current-password" placeholder="اكتب كلمة المرور">
      </div>
      <div class="err" id="err"></div>
      <button class="btn auth-submit" type="submit">دخول</button>
    </form>
    <button type="button" class="forgot-link" id="forgot-btn">
      🔑 نسيت كلمة المرور؟
    </button>
  </div>`;
}

function firstUserHTML(hijri) {
  return `
  <div class="auth-card">
    <div class="auth-logo">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="none"
           stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/>
      </svg>
    </div>
    <h2>إنشاء حساب المدير</h2>
    <p class="muted">أول استخدام — سيُنشأ حساب <b>admin</b> تلقائياً</p>
    <p class="hijri-line">${hijri}</p>
    <form id="auth-form" autocomplete="off">
      <div class="field">
        <label for="full_name">الاسم الكامل</label>
        <input id="full_name" name="full_name" type="text" required autofocus
               placeholder="مثال: أحمد محمد">
      </div>
      <div class="field">
        <label for="username">اسم المستخدم</label>
        <input id="username" name="username" type="text" required
               autocomplete="username" placeholder="admin">
      </div>
      <div class="field">
        <label for="password">كلمة المرور (6 أحرف على الأقل)</label>
        <input id="password" name="password" type="password" required minlength="6"
               autocomplete="new-password" placeholder="••••••••">
      </div>
      <div class="err" id="err"></div>
      <button class="btn auth-submit" type="submit">إنشاء الحساب</button>
    </form>
  </div>`;
}

function errorCard(title, details) {
  return `
  <div class="auth-card">
    <h2 style="color:var(--bad)">${esc(title)}</h2>
    <p class="muted" style="white-space:pre-wrap">${esc(details || '')}</p>
    <button class="btn" onclick="location.reload()">إعادة المحاولة</button>
  </div>`;
}

function bindAuth(screen, isLogin, onSuccess) {
  const form = screen.querySelector('#auth-form');
  if (!form) return;

  form.onsubmit = async e => {
    e.preventDefault();
    const err = screen.querySelector('#err');
    err.textContent = '';
    const d = Object.fromEntries(new FormData(form));
    if (!d.username || !d.password) {
      err.textContent = 'يرجى ملء جميع الحقول';
      return;
    }

    const btn = form.querySelector('.auth-submit');
    btn.disabled = true;
    btn.textContent = 'جاري…';

    try {
      let user = isLogin
        ? await api.auth.login({ username: d.username, password: d.password })
        : await api.auth.register(d);

      if (user && user.data && !user.full_name) user = user.data;
      if (!user || !user.id) throw new Error('فشل تسجيل الدخول');

      toast('مرحباً ' + (user.full_name || user.username));
      onSuccess(user);
    } catch (ex) {
      err.textContent = ex.message || 'حدث خطأ';
      btn.disabled = false;
      btn.textContent = isLogin ? 'دخول' : 'إنشاء الحساب';
    }
  };

  const forgotBtn = screen.querySelector('#forgot-btn');
  if (forgotBtn) {
    forgotBtn.onclick = () => openForgotPasswordDialog();
  }
}

// ============ نافذة استعادة كلمة المرور ============
async function openForgotPasswordDialog() {
  const dg = document.getElementById('dg');
  const fm = document.getElementById('fm');

  let users = [];
  try {
    users = await api.auth.listUsersForReset();
  } catch (e) {
    alert('فشل تحميل المستخدمين: ' + e.message);
    return;
  }

  if (!users.length) {
    alert('لا يوجد مستخدمون في النظام');
    return;
  }

  const usersOptions = users.map(u =>
    `<option value="${esc(u.username)}">${esc(u.full_name)} (${esc(u.username)})</option>`
  ).join('');

  fm.innerHTML = `
    <h3 style="grid-column:1/-1;margin:0;color:var(--pri-dark)">
      🔑 استعادة كلمة المرور
    </h3>
    <p style="grid-column:1/-1;color:var(--mut);font-size:13px;margin:0">
      اختر المستخدم ثم أدخل كلمة مرور جديدة. لا حاجة لكلمة المرور القديمة.
    </p>

    <label style="grid-column:1/-1">المستخدم
      <select id="fp-user" required>
        <option value="">— اختر مستخدم —</option>
        ${usersOptions}
      </select>
    </label>

    <label style="grid-column:1/-1">كلمة المرور الجديدة (6 أحرف على الأقل)
      <input id="fp-pass1" type="password" required minlength="6"
             placeholder="••••••••" autocomplete="new-password">
    </label>

    <label style="grid-column:1/-1">تأكيد كلمة المرور
      <input id="fp-pass2" type="password" required minlength="6"
             placeholder="••••••••" autocomplete="new-password">
    </label>

    <div class="err" id="fp-err"></div>
    <div class="f">
      <button class="btn g" type="button" id="fp-cancel">إلغاء</button>
      <button class="btn" type="button" id="fp-save">تعيين كلمة المرور</button>
    </div>`;

  dg.showModal();

  fm.querySelector('#fp-cancel').onclick = () => dg.close();

  fm.querySelector('#fp-save').onclick = async () => {
    const err = fm.querySelector('#fp-err');
    err.textContent = '';

    const username = fm.querySelector('#fp-user').value;
    const p1 = fm.querySelector('#fp-pass1').value;
    const p2 = fm.querySelector('#fp-pass2').value;

    if (!username) { err.textContent = 'اختر المستخدم'; return; }
    if (!p1 || p1.length < 6) { err.textContent = 'كلمة المرور قصيرة (6 أحرف على الأقل)'; return; }
    if (p1 !== p2) { err.textContent = 'كلمتا المرور غير متطابقتين'; return; }

    try {
      await api.auth.adminReset(username, p1);
      toast('✅ تم تعيين كلمة المرور بنجاح');
      dg.close();
      alert(
        'تم تعيين كلمة المرور بنجاح.\n\n' +
        'المستخدم: ' + username + '\n' +
        'يمكنك الآن تسجيل الدخول بالكلمة الجديدة.'
      );
    } catch (e) {
      console.error(e);
      err.textContent = e.message || 'فشل تعيين كلمة المرور';
    }
  };
}