const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  auth: {
    hasUsers:    ()             => ipcRenderer.invoke('auth:hasUsers'),
    register:    (data)         => ipcRenderer.invoke('auth:register', data),
    login:       (data)         => ipcRenderer.invoke('auth:login', data),
    listUsers:   ()             => ipcRenderer.invoke('auth:listUsers'),
    updateUser:  (id, data)     => ipcRenderer.invoke('auth:updateUser', id, data),
    deleteUser:  (id)           => ipcRenderer.invoke('auth:deleteUser', id),
    changePass:  (id, oldP, newP) => ipcRenderer.invoke('auth:changePass', id, oldP, newP),
    listUsersForReset: ()       => ipcRenderer.invoke('auth:listUsersForReset'),
    adminReset:        (u, np)  => ipcRenderer.invoke('auth:adminReset', u, np)
  },
  data: {
    all:    (table, filters)  => ipcRenderer.invoke('data:all', table, filters),
    get:    (table, id)       => ipcRenderer.invoke('data:get', table, id),
    insert: (table, row, uid) => ipcRenderer.invoke('data:insert', table, row, uid),
    update: (table, id, row, uid) => ipcRenderer.invoke('data:update', table, id, row, uid),
    remove: (table, id, uid)  => ipcRenderer.invoke('data:remove', table, id, uid)
  },
  lists: {
    all:      ()            => ipcRenderer.invoke('lists:all'),
    byKey:    (key)         => ipcRenderer.invoke('lists:byKey', key),
    add:      (key, value)  => ipcRenderer.invoke('lists:add', key, value),
    update:   (id, value)   => ipcRenderer.invoke('lists:update', id, value),
    remove:   (id)          => ipcRenderer.invoke('lists:remove', id),
    isUsed:   (key, value)  => ipcRenderer.invoke('lists:isUsed', key, value)
  },
  backup: {
    export: ()         => ipcRenderer.invoke('backup:export'),
    import: (json)     => ipcRenderer.invoke('backup:import', json),
    saveToFile: (name) => ipcRenderer.invoke('backup:saveToFile', name)
  }
});