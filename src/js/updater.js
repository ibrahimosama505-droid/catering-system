/* ============================================================
   واجهة التحديثات التلقائية
   ============================================================ */
import { esc } from './ui.js';

let currentVersion = '';
let updateInfo = null;
let isBannerVisible = false;

export async function initUpdater() {
  if (!window.api || !window.api.updater) {
    console.warn('[Updater] API غير متاح');
    return;
  }

  // احصل على الإصدار الحالي
  try {
    currentVersion = await window.api.updater.getVersion();
    console.log('[Updater] الإصدار الحالي:', currentVersion);
  } catch (e) {
    console.error('[Updater] فشل الحصول على الإصدار:', e);
  }

  // أنشئ شريط التحديث (مخفي)
  createBanner();

  // ===== أحداث Auto-Updater =====
  window.api.updater.onChecking(() => {
    console.log('[Updater] جاري الفحص...');
  });

  window.api.updater.onAvailable((info) => {
    updateInfo = info;
    showUpdateBanner(info);
  });

  window.api.updater.onNotAvailable(() => {
    console.log('[Updater] لا يوجد تحديث جديد');
  });

  window.api.updater.onError((err) => {
    console.error('[Updater] خطأ:', err);
  });

  window.api.updater.onProgress((progress) => {
    updateProgress(progress.percent);
  });

  window.api.updater.onDownloaded((info) => {
    showInstallBanner(info);
  });

  // ===== الفحص التلقائي بعد 3 ثواني =====
  setTimeout(() => {
    checkForUpdates();
  }, 3000);
}

// الفحص اليدوي
export async function checkForUpdates() {
  try {
    console.log('[Updater] بدء الفحص...');
    await window.api.updater.check();
  } catch (e) {
    console.error('[Updater] فشل الفحص:', e);
  }
}

// إنشاء الشريط
function createBanner() {
  if (document.getElementById('update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner hidden';
  document.body.appendChild(banner);
}

// عرض إشعار "يوجد تحديث"
function showUpdateBanner(info) {
  const banner = document.getElementById('update-banner');
  if (!banner) return;

  banner.innerHTML = `
    <div class="update-banner-inner">
      <div class="update-icon">🎉</div>
      <div class="update-text">
        <b>يوجد تحديث جديد (v${esc(info.version)})</b>
        <span>الإصدار الحالي: v${esc(currentVersion)}</span>
      </div>
      <div class="update-actions">
        <button class="btn update-download" id="upd-download">⬇️ تحميل التحديث</button>
        <button class="btn g update-later" id="upd-later">لاحقاً</button>
      </div>
    </div>`;
  banner.classList.remove('hidden');
  isBannerVisible = true;

  document.getElementById('upd-download').onclick = async () => {
    banner.classList.add('hidden');
    showDownloadProgressBanner(info);
    try {
      await window.api.updater.download();
    } catch (e) {
      console.error('[Updater] فشل التنزيل:', e);
      showErrorBanner(e.message);
    }
  };

  document.getElementById('upd-later').onclick = () => {
    banner.classList.add('hidden');
    isBannerVisible = false;
    // إعادة العرض بعد 30 دقيقة
    setTimeout(() => {
      if (updateInfo && !isBannerVisible) showUpdateBanner(updateInfo);
    }, 30 * 60 * 1000);
  };
}

// عرض شريط التنزيل
function showDownloadProgressBanner(info) {
  const banner = document.getElementById('update-banner');
  banner.innerHTML = `
    <div class="update-banner-inner">
      <div class="update-icon">⬇️</div>
      <div class="update-text">
        <b>جاري تحميل التحديث v${esc(info.version)}...</b>
        <span id="upd-status">0%</span>
      </div>
      <div class="update-progress">
        <div class="update-progress-bar" id="upd-progress-bar" style="width: 0%"></div>
      </div>
    </div>`;
  banner.classList.remove('hidden');
}

function updateProgress(percent) {
  const bar = document.getElementById('upd-progress-bar');
  const status = document.getElementById('upd-status');
  if (bar) bar.style.width = `${percent.toFixed(1)}%`;
  if (status) status.textContent = `${percent.toFixed(1)}%`;
}

// عرض شريط "التحديث جاهز"
function showInstallBanner(info) {
  const banner = document.getElementById('update-banner');
  banner.innerHTML = `
    <div class="update-banner-inner">
      <div class="update-icon">✅</div>
      <div class="update-text">
        <b>التحديث v${esc(info.version)} جاهز للتثبيت</b>
        <span>سيتم إعادة تشغيل البرنامج بعد التثبيت</span>
      </div>
      <div class="update-actions">
        <button class="btn update-install" id="upd-install">🔄 تثبيت الآن</button>
        <button class="btn g update-later" id="upd-later2">تثبيت عند الإغلاق</button>
      </div>
    </div>`;
  banner.classList.remove('hidden');

  document.getElementById('upd-install').onclick = async () => {
    if (!confirm('سيتم إغلاق البرنامج وتثبيت التحديث.\n\nمتابعة؟')) return;
    await window.api.updater.install();
  };

  document.getElementById('upd-later2').onclick = () => {
    banner.classList.add('hidden');
    // سيتم التثبيت تلقائياً عند الإغلاق
  };
}

function showErrorBanner(message) {
  const banner = document.getElementById('update-banner');
  banner.innerHTML = `
    <div class="update-banner-inner">
      <div class="update-icon">⚠️</div>
      <div class="update-text">
        <b>فشل التحديث</b>
        <span>${esc(message || 'خطأ غير معروف')}</span>
      </div>
      <div class="update-actions">
        <button class="btn g" id="upd-close">إغلاق</button>
      </div>
    </div>`;
  banner.classList.remove('hidden');
  document.getElementById('upd-close').onclick = () => banner.classList.add('hidden');
}