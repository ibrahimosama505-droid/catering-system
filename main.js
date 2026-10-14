const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./db/database');

let mainWindow = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    title: 'نظام إدارة الإعاشة',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  db.init();
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => app.quit());

function wrap(fn) {
  try {
    return { ok: true, data: fn() };
  } catch (e) {
    console.error('[IPC Error]', e);
    return { ok: false, error: e.message || String(e) };
  }
}

function registerIpcHandlers() {
  // المصادقة
  ipcMain.handle('auth:hasUsers', () => {
    try { return db.hasUsers(); } catch (e) { return false; }
  });
  ipcMain.handle('auth:register', (_, data) => wrap(() => db.register(data)));
  ipcMain.handle('auth:login', (_, data) => wrap(() => db.login(data)));
  ipcMain.handle('auth:listUsers', () => {
    try { return db.listUsers(); } catch (e) { return []; }
  });
  ipcMain.handle('auth:updateUser', (_, id, data) => wrap(() => db.updateUser(id, data)));
  ipcMain.handle('auth:deleteUser', (_, id) => wrap(() => db.deleteUser(id)));
  ipcMain.handle('auth:changePass', (_, id, oldP, newP) => wrap(() => db.changePass(id, oldP, newP)));

  // استعادة كلمة المرور
  ipcMain.handle('auth:listUsersForReset', () => {
    try { return db.listUsersForReset(); } catch (e) { return []; }
  });
  ipcMain.handle('auth:adminReset', (_, username, newPassword) =>
    wrap(() => db.adminResetPassword(username, newPassword))
  );

  // CRUD
  ipcMain.handle('data:all', (_, t, f) => {
    try { return db.getAll(t, f || {}); } catch (e) { console.error(e); return []; }
  });
  ipcMain.handle('data:get', (_, t, id) => {
    try { return db.getOne(t, id); } catch (e) { console.error(e); return null; }
  });
  ipcMain.handle('data:insert', (_, t, r, u) => wrap(() => db.insert(t, r, u)));
  ipcMain.handle('data:update', (_, t, id, r, u) => wrap(() => db.update(t, id, r, u)));
  ipcMain.handle('data:remove', (_, t, id, u) => wrap(() => db.remove(t, id, u)));

  // القوائم
  ipcMain.handle('lists:all', () => {
    try { return db.listsAll(); } catch (e) { console.error(e); return {}; }
  });
  ipcMain.handle('lists:byKey', (_, key) => {
    try { return db.listsByKey(key); } catch (e) { console.error(e); return []; }
  });
  ipcMain.handle('lists:add', (_, key, value) => wrap(() => db.listAdd(key, value)));
  ipcMain.handle('lists:update', (_, id, value) => wrap(() => db.listUpdate(id, value)));
  ipcMain.handle('lists:remove', (_, id) => wrap(() => db.listRemove(id)));
  ipcMain.handle('lists:isUsed', (_, key, value) => {
    try { return db.listIsUsed(key, value); } catch (e) { return false; }
  });

  // النسخ الاحتياطي
  ipcMain.handle('backup:export', () => {
    try {
      const tables = ['users','lists','kitchens','marketers','contracts','payments','expenses','meals','company_marketers'];
      const data = { _meta: { version: 2, exported_at: new Date().toISOString() } };
      tables.forEach(t => { data[t] = db.getAll(t); });
      return { ok: true, data };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('backup:saveToFile', async (_, defaultName) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultName || `catering-backup-${new Date().toISOString().slice(0,10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (canceled || !filePath) return { ok: false, canceled: true };
      return { ok: true, path: filePath };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('backup:import', (_, json) => {
    try {
      const payload = typeof json === 'string' ? JSON.parse(json) : json;
      if (!payload || typeof payload !== 'object') throw new Error('ملف النسخة غير صالح');
      const tables = ['lists','kitchens','marketers','contracts','payments','expenses','meals','company_marketers'];
      const raw = db.getRaw();
      raw.transaction(() => {
        for (const t of [...tables].reverse()) raw.prepare(`DELETE FROM ${t}`).run();
        for (const t of tables) {
          const rows = payload[t] || [];
          for (const row of rows) {
            const cols = Object.keys(row);
            if (!cols.length) continue;
            const sql = `INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`;
            raw.prepare(sql).run(...cols.map(c => row[c]));
          }
        }
      })();
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });
}