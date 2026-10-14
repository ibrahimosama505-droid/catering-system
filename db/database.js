const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

let db;

const DEFAULT_LISTS = {
  type:    ["شركة طوافة","شركة عمرة","شركة حجاج الخارج","مؤسسة / جهة","أخرى"],
  season:  ["حج","عمرة"],
  loc:     ["مكة المكرمة","المدينة المنورة","منى","عرفات","مزدلفة","جدة"],
  service: ["وجبات كاملة","إفطار فقط","غداء وعشاء","سناكس ومشروبات"],
  method:  ["نقدي","تحويل بنكي","شيك","بطاقة"],
  cat:     ["مواد خام","عمالة","نقل وتوزيع","إيجار","مرافق","تراخيص ورسوم","تعبئة وتغليف","أخرى"],
  meal:    ["إفطار","غداء","عشاء","سناكس"],
  agreement_status: ["تمت الموافقة","منتهي","نشطة","منتهية","ملغاة","معلقة"],
  pct_options: ["0","5","10","12.5","15","20","25","30"]
};

function init() {
  const dbPath = path.join(app.getPath('userData'), 'catering.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate();
  seedLists();
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_key TEXT NOT NULL,
      value TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      UNIQUE(list_key, value)
    );

    CREATE TABLE IF NOT EXISTS kitchens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      loc TEXT, cap REAL DEFAULT 0, mgr TEXT, phone TEXT,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS marketers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      phone TEXT,
      default_pct REAL DEFAULT 0,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      date TEXT, client TEXT, type TEXT, season TEXT, loc TEXT,
      service TEXT, people REAL, days REAL, mpd REAL, price REAL,
      kitchen_id INTEGER REFERENCES kitchens(id),
      marketer_id INTEGER REFERENCES marketers(id),
      pct REAL, start TEXT, notes TEXT,
      created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT, date TEXT,
      contract_id TEXT REFERENCES contracts(id) ON DELETE CASCADE,
      amount REAL, method TEXT, ref TEXT, notes TEXT,
      created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT, cat TEXT, descr TEXT, party TEXT, amount REAL,
      contract_id TEXT, kitchen_id INTEGER, notes TEXT,
      created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      contract_id TEXT REFERENCES contracts(id) ON DELETE CASCADE,
      meal TEXT, planned REAL, delivered REAL, notes TEXT,
      created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS company_marketers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT UNIQUE NOT NULL,
      marketer_id INTEGER REFERENCES marketers(id) ON DELETE CASCADE,
      pct REAL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER, action TEXT, table_name TEXT,
      row_id TEXT, details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration للأعمدة الجديدة في العقود
  addColumnIfMissing('contracts', 'ifaqa_end', 'TEXT');
  addColumnIfMissing('contracts', 'total_amount', 'REAL');
  addColumnIfMissing('contracts', 'agreement_status', 'TEXT');
  addColumnIfMissing('contracts', 'amend_reason', 'TEXT');
  addColumnIfMissing('contracts', 'amend_days', 'REAL');
  addColumnIfMissing('contracts', 'pilgrims_after', 'REAL');

  // Migration للمسوّقين
  addColumnIfMissing('marketers', 'default_pct', 'REAL DEFAULT 0');
}

function addColumnIfMissing(table, column, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some(c => c.name === column)) return;
  db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  console.log(`[Migration] Added ${table}.${column}`);
}

function seedLists() {
  // نستخدم INSERT OR IGNORE لإضافة قيم جديدة بدون تكرار
  const ins = db.prepare('INSERT OR IGNORE INTO lists (list_key, value, sort_order) VALUES (?,?,?)');
  db.transaction(() => {
    for (const [k, arr] of Object.entries(DEFAULT_LISTS)) {
      // ابحث عن أعلى sort_order موجود في القائمة
      const max = db.prepare('SELECT COALESCE(MAX(sort_order),-1) m FROM lists WHERE list_key=?').get(k).m;
      arr.forEach((v, i) => {
        // حاول الإدخال، لو موجود بالفعل يتجاهل
        try {
          ins.run(k, v, max + 1 + i);
        } catch (e) { /* ignore */ }
      });
    }
  })();
}

// ============ المستخدمون ============
const hasUsers = () => db.prepare('SELECT COUNT(*) c FROM users').get().c > 0;

function register({ username, full_name, password, role }) {
  if (!username || !full_name || !password) throw new Error('بيانات ناقصة');
  if (password.length < 6) throw new Error('كلمة المرور قصيرة (6 أحرف على الأقل)');
  const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username);
  if (exists) throw new Error('اسم المستخدم مسجّل من قبل');

  const isFirst = !hasUsers();
  const finalRole = isFirst ? 'admin' : (role || 'user');
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    'INSERT INTO users (username, full_name, password_hash, role) VALUES (?,?,?,?)'
  ).run(username, full_name, hash, finalRole);
  return { id: info.lastInsertRowid, username, full_name, role: finalRole };
}

function login({ username, password }) {
  const u = db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username);
  if (!u) throw new Error('اسم المستخدم غير موجود أو معطّل');
  if (!bcrypt.compareSync(password, u.password_hash)) throw new Error('كلمة المرور غير صحيحة');
  return { id: u.id, username: u.username, full_name: u.full_name, role: u.role };
}

const listUsers = () =>
  db.prepare('SELECT id, username, full_name, role, active, created_at FROM users ORDER BY id').all();

function updateUser(id, { full_name, role, active }) {
  db.prepare('UPDATE users SET full_name=?, role=?, active=? WHERE id=?')
    .run(full_name, role, active ? 1 : 0, id);
  return true;
}

function deleteUser(id) {
  const u = db.prepare('SELECT username FROM users WHERE id=?').get(id);
  if (!u) throw new Error('مستخدم غير موجود');
  if (u.username === 'admin') throw new Error('لا يمكن حذف حساب admin الأساسي');
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  return true;
}

function changePass(id, oldP, newP) {
  const u = db.prepare('SELECT password_hash FROM users WHERE id=?').get(id);
  if (!u) throw new Error('مستخدم غير موجود');
  if (!bcrypt.compareSync(oldP, u.password_hash)) throw new Error('كلمة المرور الحالية خطأ');
  if (newP.length < 6) throw new Error('كلمة المرور الجديدة قصيرة');
  db.prepare('UPDATE users SET password_hash=? WHERE id=?')
    .run(bcrypt.hashSync(newP, 10), id);
  return true;
}

// ============ استعادة كلمة المرور (بدون تسجيل دخول) ============
function adminResetPassword(username, newPassword) {
  if (!username || !newPassword) throw new Error('بيانات ناقصة');
  if (newPassword.length < 6) throw new Error('كلمة المرور قصيرة (6 أحرف على الأقل)');
  const u = db.prepare('SELECT id FROM users WHERE username=?').get(username);
  if (!u) throw new Error('المستخدم غير موجود');
  db.prepare('UPDATE users SET password_hash=? WHERE id=?')
    .run(bcrypt.hashSync(newPassword, 10), u.id);
  return true;
}

const listUsersForReset = () =>
  db.prepare('SELECT id, username, full_name, role FROM users WHERE active=1 ORDER BY id').all();

// ============ CRUD عام ============
const TABLES = [
  'contracts','payments','expenses','kitchens','marketers','meals',
  'users','lists','company_marketers'
];

const NO_CREATED_BY = ['users', 'lists', 'kitchens', 'marketers', 'company_marketers'];

function getAll(table, filters = {}) {
  if (!TABLES.includes(table)) throw new Error('جدول غير معروف: ' + table);
  let sql = `SELECT * FROM ${table}`;
  const keys = Object.keys(filters);
  if (keys.length) sql += ' WHERE ' + keys.map(k => `${k}=?`).join(' AND ');
  return db.prepare(sql).all(...Object.values(filters));
}

function getOne(table, id) {
  return db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
}

function insert(table, row, uid) {
  if (!TABLES.includes(table)) throw new Error('جدول غير معروف: ' + table);

  if (uid && !('created_by' in row) && !NO_CREATED_BY.includes(table)) {
    row.created_by = uid;
  }

  const cols = Object.keys(row);
  if (!cols.length) throw new Error('لا توجد بيانات للحفظ');

  const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`;
  const info = db.prepare(sql).run(...cols.map(c => row[c]));
  log(uid, 'insert', table, info.lastInsertRowid, row);
  return info.lastInsertRowid;
}

function update(table, id, row, uid) {
  if (!TABLES.includes(table)) throw new Error('جدول غير معروف: ' + table);
  const cols = Object.keys(row);
  if (!cols.length) return true;
  const sql = `UPDATE ${table} SET ${cols.map(c=>`${c}=?`).join(',')} WHERE id=?`;
  db.prepare(sql).run(...cols.map(c => row[c]), id);
  log(uid, 'update', table, id, row);
  return true;
}

function remove(table, id, uid) {
  if (!TABLES.includes(table)) throw new Error('جدول غير معروف: ' + table);
  db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
  log(uid, 'delete', table, id, null);
  return true;
}

function log(uid, action, table_name, row_id, details) {
  try {
    db.prepare(
      'INSERT INTO audit_log (user_id, action, table_name, row_id, details) VALUES (?,?,?,?,?)'
    ).run(uid || null, action, table_name, String(row_id), JSON.stringify(details || {}));
  } catch (e) {}
}

// ============ القوائم ============
function listsAll() {
  const rows = db.prepare('SELECT * FROM lists ORDER BY list_key, sort_order, id').all();
  const out = {};
  rows.forEach(r => {
    (out[r.list_key] ||= []).push({ id: r.id, value: r.value, active: r.active });
  });
  return out;
}

const listsByKey = (key) =>
  db.prepare('SELECT * FROM lists WHERE list_key=? ORDER BY sort_order, id').all(key);

function listAdd(key, value) {
  const max = db.prepare('SELECT COALESCE(MAX(sort_order),-1) m FROM lists WHERE list_key=?').get(key).m;
  const info = db.prepare('INSERT INTO lists (list_key, value, sort_order) VALUES (?,?,?)')
    .run(key, value, max + 1);
  return info.lastInsertRowid;
}
const listUpdate = (id, value) =>
  db.prepare('UPDATE lists SET value=? WHERE id=?').run(value, id);
const listRemove = (id) => db.prepare('DELETE FROM lists WHERE id=?').run(id);

function listIsUsed(key, value) {
  const map = {
    type:    ['contracts','type'],
    season:  ['contracts','season'],
    loc:     ['contracts','loc'],
    service: ['contracts','service'],
    method:  ['payments','method'],
    cat:     ['expenses','cat'],
    meal:    ['meals','meal'],
    agreement_status: ['contracts','agreement_status']
  };
  const m = map[key];
  if (!m) return false;
  const r = db.prepare(`SELECT COUNT(*) c FROM ${m[0]} WHERE ${m[1]}=?`).get(value);
  return r.c > 0;
}

// ============ ربط الشركات بالمسوّقين ============
function getCompanyMarketer(companyName) {
  if (!companyName) return null;
  return db.prepare(
    'SELECT * FROM company_marketers WHERE company_name = ?'
  ).get(String(companyName).trim());
}

function setCompanyMarketer(companyName, marketerId, pct) {
  if (!companyName) return null;
  const name = String(companyName).trim();
  if (!name) return null;

  const existing = getCompanyMarketer(name);
  if (existing) {
    db.prepare(
      'UPDATE company_marketers SET marketer_id=?, pct=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(marketerId || null, pct || 0, existing.id);
    return existing.id;
  }
  const info = db.prepare(
    'INSERT INTO company_marketers (company_name, marketer_id, pct) VALUES (?,?,?)'
  ).run(name, marketerId || null, pct || 0);
  return info.lastInsertRowid;
}

const listCompanyMarketers = () =>
  db.prepare(`
    SELECT cm.*, m.name as marketer_name
    FROM company_marketers cm
    LEFT JOIN marketers m ON m.id = cm.marketer_id
    ORDER BY cm.company_name
  `).all();

module.exports = {
  init,
  hasUsers, register, login, listUsers, updateUser, deleteUser, changePass,
  adminResetPassword, listUsersForReset,
  getAll, getOne, insert, update, remove,
  listsAll, listsByKey, listAdd, listUpdate, listRemove, listIsUsed,
  getCompanyMarketer, setCompanyMarketer, listCompanyMarketers,
  getRaw: () => db
};