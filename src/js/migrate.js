import { api } from './api.js';

const OLD_KEY = 'catering_v1';
const MIGRATED_FLAG = 'migrated_v2';

export async function maybeMigrate(currentUser) {
  const raw = localStorage.getItem(OLD_KEY);
  if (!raw) return;
  if (localStorage.getItem(MIGRATED_FLAG) === 'yes') return;
  if (localStorage.getItem(MIGRATED_FLAG) === 'skip') return;

  let old;
  try { old = JSON.parse(raw); }
  catch { localStorage.setItem(MIGRATED_FLAG, 'skip'); return; }

  const hasData = ['contracts','payments','expenses','kitchens','marketers','meals']
    .some(k => Array.isArray(old[k]) && old[k].length);
  if (!hasData) { localStorage.setItem(MIGRATED_FLAG, 'skip'); return; }

  if (!confirm('تم العثور على بيانات النسخة القديمة.\nهل تريد ترحيلها الآن؟')) {
    localStorage.setItem(MIGRATED_FLAG, 'skip');
    return;
  }

  try {
    const kitchenMap = {};
    for (const k of old.kitchens || []) {
      if (!k?.name) continue;
      const existing = (await api.data.all('kitchens')).find(x => x.name === k.name);
      if (existing) { kitchenMap[k.name] = existing.id; continue; }
      const id = await api.data.insert('kitchens', {
        name: k.name, loc: k.loc || null,
        cap: +k.cap || 0, mgr: k.mgr || null, phone: k.phone || null
      }, currentUser.id);
      kitchenMap[k.name] = id;
    }

    const marketerMap = {};
    for (const m of old.marketers || []) {
      if (!m?.name) continue;
      const existing = (await api.data.all('marketers')).find(x => x.name === m.name);
      if (existing) { marketerMap[m.name] = existing.id; continue; }
      const id = await api.data.insert('marketers', {
        name: m.name, phone: m.phone || null
      }, currentUser.id);
      marketerMap[m.name] = id;
    }

    for (const c of old.contracts || []) {
      if (!c?.id) continue;
      try {
        await api.data.insert('contracts', {
          id: String(c.id), date: c.date || null, client: c.client || null,
          type: c.type || null, season: c.season || null, loc: c.loc || null,
          service: c.service || null, people: +c.people || 0, days: +c.days || 0,
          mpd: +c.mpd || 0, price: +c.price || 0,
          kitchen_id: kitchenMap[c.kitchen] || null,
          marketer_id: marketerMap[c.marketer] || null,
          pct: +c.pct || 0, start: c.start || null, notes: c.notes || null
        }, currentUser.id);
      } catch (e) { console.warn('تخطي عقد:', c.id, e.message); }
    }

    for (const p of old.payments || []) {
      try {
        await api.data.insert('payments', {
          code: p.id || null, date: p.date || null, contract_id: p.contract || null,
          amount: +p.amount || 0, method: p.method || null,
          ref: p.ref || null, notes: p.notes || null
        }, currentUser.id);
      } catch (e) { console.warn('تخطي دفعة:', e.message); }
    }

    for (const x of old.expenses || []) {
      try {
        await api.data.insert('expenses', {
          date: x.date || null, cat: x.cat || null, descr: x.desc || null,
          party: x.party || null, amount: +x.amount || 0,
          contract_id: x.contract || null,
          kitchen_id: kitchenMap[x.kitchen] || null,
          notes: x.notes || null
        }, currentUser.id);
      } catch (e) { console.warn('تخطي مصروف:', e.message); }
    }

    for (const m of old.meals || []) {
      try {
        await api.data.insert('meals', {
          date: m.date || null, contract_id: m.contract || null,
          meal: m.meal || null, planned: +m.planned || 0,
          delivered: +m.delivered || 0, notes: m.notes || null
        }, currentUser.id);
      } catch (e) { console.warn('تخطي وجبة:', e.message); }
    }

    localStorage.setItem(MIGRATED_FLAG, 'yes');
    alert('تم ترحيل البيانات بنجاح ✔');
  } catch (e) {
    console.error('Migration failed:', e);
    alert('فشل الترحيل: ' + e.message);
  }
}