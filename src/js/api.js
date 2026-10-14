function unwrap(r) {
  if (r && r.ok === false) throw new Error(r.error || 'خطأ غير معروف');
  return r && typeof r === 'object' && r.data !== undefined ? r.data : r;
}

export const api = {
  auth: {
    hasUsers:   () => window.api.auth.hasUsers(),
    register:   (d) => unwrap(window.api.auth.register(d)),
    login:      (d) => unwrap(window.api.auth.login(d)),
    listUsers:  () => window.api.auth.listUsers(),
    updateUser: (id, d) => unwrap(window.api.auth.updateUser(id, d)),
    deleteUser: (id) => unwrap(window.api.auth.deleteUser(id)),
    changePass: (id, oldP, newP) => unwrap(window.api.auth.changePass(id, oldP, newP)),
    listUsersForReset: () => window.api.auth.listUsersForReset(),
    adminReset: (username, newPassword) =>
      unwrap(window.api.auth.adminReset(username, newPassword))
  },
  data: {
    all:    (t, f) => window.api.data.all(t, f),
    get:    (t, id) => window.api.data.get(t, id),
    insert: (t, r, u) => unwrap(window.api.data.insert(t, r, u)),
    update: (t, id, r, u) => unwrap(window.api.data.update(t, id, r, u)),
    remove: (t, id, u) => unwrap(window.api.data.remove(t, id, u))
  },
  lists: {
    all:     () => window.api.lists.all(),
    byKey:   (k) => window.api.lists.byKey(k),
    add:     (k, v) => unwrap(window.api.lists.add(k, v)),
    update:  (id, v) => unwrap(window.api.lists.update(id, v)),
    remove:  (id) => unwrap(window.api.lists.remove(id)),
    isUsed:  (k, v) => window.api.lists.isUsed(k, v)
  },
  backup: {
    export:     () => window.api.backup.export(),
    import:     (json) => unwrap(window.api.backup.import(json)),
    saveToFile: (name) => window.api.backup.saveToFile(name)
  }
};