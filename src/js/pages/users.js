import { api } from '../api.js';
import { toast, esc } from '../ui.js';

export async function renderUsers(main, currentUser) {
  let users = [];
  try { users = await api.auth.listUsers(); }
  catch (e) { toast('تعذّر تحميل المستخدمين: ' + e.message); }

  const rowsHtml = users.map(u => {
    const role = roleAr(u.role);
    const status = u.active
      ? '<span class="b s1">مفعّل</span>'
      : '<span class="b s3">معطّل</span>';
    const delBtn = u.username !== 'admin'
      ? `<button class="ic d" data-del="${u.id}">حذف</button>` : '';
    return `
      <tr>
        <td>${u.id}</td>
        <td>${esc(u.full_name)}</td>
        <td>${esc(u.username)}</td>
        <td><span class="b role-${u.role}">${role}</span></td>
        <td>${status}</td>
        <td>${(u.created_at || '').slice(0, 10)}</td>
        <td>
          <button class="ic" data-edit="${u.id}">تعديل</button>
          ${delBtn}
        </td>
      </tr>`;
  }).join('');

  main.innerHTML = `
    <div class="bar">
      <h2>إدارة المستخدمين</h2>
      <button class="btn" id="ad">+ مستخدم جديد</button>
    </div>
    <div class="box">
      <table>
        <tr>
          <th>#</th><th>الاسم</th><th>اسم المستخدم</th><th>الدور</th>
          <th>الحالة</th><th>تاريخ الإنشاء</th><th></th>
        </tr>
        ${rowsHtml}
      </table>
    </div>`;

  main.querySelector('#ad').onclick = () => newUserDialog(main, currentUser);
  main.querySelectorAll('[data-edit]').forEach(b =>
    b.onclick = () => editUserDialog(+b.dataset.edit, users, main, currentUser));
  main.querySelectorAll('[data-del]').forEach(b =>
    b.onclick = async () => {
      if (!confirm('حذف هذا المستخدم نهائياً؟')) return;
      try {
        await api.auth.deleteUser(+b.dataset.del);
        toast('تم الحذف');
        renderUsers(main, currentUser);
      } catch (e) { toast(e.message); }
    });
}

function newUserDialog(main, currentUser) {
  const dg = document.getElementById('dg');
  const fm = document.getElementById('fm');
  fm.innerHTML = `
    <h3 style="grid-column:1/-1;margin:0">إضافة مستخدم جديد</h3>
    <label>الاسم الكامل<input id="u-full" required></label>
    <label>اسم المستخدم<input id="u-username" required></label>
    <label>كلمة المرور (6+)<input id="u-pass" type="password" required minlength="6"></label>
    <label>الدور
      <select id="u-role">
        <option value="user">مستخدم</option>
        <option value="manager">مشرف</option>
        <option value="admin">مدير عام</option>
      </select>
    </label>
    <div class="err" id="u-err"></div>
    <div class="f">
      <button class="btn g" type="button" id="u-cancel">إلغاء</button>
      <button class="btn" type="button" id="u-save">حفظ</button>
    </div>`;
  dg.showModal();

  fm.querySelector('#u-cancel').onclick = () => dg.close();
  fm.querySelector('#u-save').onclick = async () => {
    const err = fm.querySelector('#u-err');
    err.textContent = '';
    const data = {
      full_name: fm.querySelector('#u-full').value.trim(),
      username: fm.querySelector('#u-username').value.trim(),
      password: fm.querySelector('#u-pass').value,
      role: fm.querySelector('#u-role').value
    };
    if (!data.full_name || !data.username || !data.password) {
      err.textContent = 'يرجى ملء جميع الحقول'; return;
    }
    if (data.password.length < 6) {
      err.textContent = 'كلمة المرور قصيرة'; return;
    }
    try {
      await api.auth.register(data);
      toast('تم إنشاء المستخدم');
      dg.close();
      renderUsers(main, currentUser);
    } catch (e) { err.textContent = e.message; }
  };
}

function editUserDialog(id, users, main, currentUser) {
  const u = users.find(x => x.id === id);
  if (!u) return;

  const dg = document.getElementById('dg');
  const fm = document.getElementById('fm');
  fm.innerHTML = `
    <h3 style="grid-column:1/-1;margin:0">تعديل مستخدم: ${esc(u.username)}</h3>
    <label>الاسم الكامل<input id="u-full" value="${esc(u.full_name)}"></label>
    <label>الدور
      <select id="u-role">
        <option value="user" ${u.role === 'user' ? 'selected' : ''}>مستخدم</option>
        <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>مشرف</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>مدير عام</option>
      </select>
    </label>
    <label>الحالة
      <select id="u-active">
        <option value="1" ${u.active ? 'selected' : ''}>مفعّل</option>
        <option value="0" ${!u.active ? 'selected' : ''}>معطّل</option>
      </select>
    </label>
    <div class="err" id="u-err"></div>
    <div class="f">
      <button class="btn g" type="button" id="u-cancel">إلغاء</button>
      <button class="btn" type="button" id="u-save">حفظ</button>
    </div>`;
  dg.showModal();

  fm.querySelector('#u-cancel').onclick = () => dg.close();
  fm.querySelector('#u-save').onclick = async () => {
    const err = fm.querySelector('#u-err');
    err.textContent = '';
    const data = {
      full_name: fm.querySelector('#u-full').value.trim(),
      role: fm.querySelector('#u-role').value,
      active: fm.querySelector('#u-active').value === '1'
    };
    if (!data.full_name) { err.textContent = 'الاسم مطلوب'; return; }
    if (id === currentUser.id && !data.active) {
      err.textContent = 'لا يمكنك تعطيل حسابك الحالي'; return;
    }
    try {
      await api.auth.updateUser(id, data);
      toast('تم التحديث');
      dg.close();
      renderUsers(main, currentUser);
    } catch (e) { err.textContent = e.message; }
  };
}

const roleAr = r => ({ admin: 'مدير عام', manager: 'مشرف', user: 'مستخدم' }[r] || r);