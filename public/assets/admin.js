console.info('[product-review] admin site-data guard v1 loaded');
console.info("product-review admin version: 20260720-site-data-guard-v1");
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const loginView = $('#loginView');
const appView = $('#appView');
const loginForm = $('#loginForm');
const loginMessage = $('#loginMessage');
const logoutBtn = $('#logoutBtn');
const messageBox = $('#message');
const styleForm = $('#styleForm');
const styleFormTitle = $('#styleFormTitle');
const cancelStyleEditBtn = $('#cancelStyleEditBtn');
const stylesBody = $('#stylesBody');
const styleSearchForm = $('#styleSearchForm');
const scoreSearchForm = $('#scoreSearchForm');
const deleteAllStylesBtn = $('#deleteAllStylesBtn');
const deleteAllScoresBtn = $('#deleteAllScoresBtn');
const scoresHead = $('#scoresHead');
const scoresBody = $('#scoresBody');
const statsGrid = $('#statsGrid');
const historyPanel = $('#historyPanel');
const historyList = $('#historyList');
const scoreEditPanel = $('#scoreEditPanel');
const scoreEditForm = $('#scoreEditForm');
const cancelScoreEditBtn = $('#cancelScoreEditBtn');
const scoreFieldList = $('#scoreFieldList');
const addScoreFieldBtn = $('#addScoreFieldBtn');
const saveScoreFieldsBtn = $('#saveScoreFieldsBtn');
const scoreTypeList = $('#scoreTypeList');
const addScoreTypeBtn = $('#addScoreTypeBtn');
const imageStorageForm = $('#imageStorageForm');
const saveImageSettingsBtn = $('#saveImageSettingsBtn');
const gradeRuleForm = $('#gradeRuleForm');
const saveGradeRulesBtn = $('#saveGradeRulesBtn');
const styleDropZone = $('#styleDropZone');
const styleImageFile = $('#styleImageFile');
const stylePreview = $('#stylePreview');
const STYLE_IMPORT_ACCEPT = '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLSX_CDN_URLS = [
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];
let styleImportFileInput = null;
let xlsxLoaderPromise = null;
let pendingStyleImportRecords = null;
let pendingStyleImportMeta = null;
const STYLE_IMPORT_TEMPLATE_URL = '/assets/templates/style-import-template.xlsx';

let styles = [];
let scores = [];
let scoreGroups = [];
let selectedScoreGroupKey = null;
let scoreFields = [];
let scoreTypes = [];
let gradeRules = null;
let currentImageSettings = { image_key_prefix: 'review-images', public_image_base_url: '', public_image_path_prefix: '', s3_endpoint: '', s3_bucket: '' };
let editingStyleId = null;
let inlineEditingStyleId = null;
let editingScoreId = null;
let editingScoreMeta = null;
let sessionGuardStarted = false;
let sessionIdleTimer = null;
let sessionLastRefreshAt = 0;
let sessionLocalExpireAt = 0;
let sessionSiteDataTimer = null;
const SESSION_LOGIN_MARKER_STORAGE_KEY = 'product_review_admin_login_marker';
const SESSION_EXPIRE_STORAGE_KEY = 'product_review_admin_session_expire_at';
const sessionIdleMinutes = Number(window.__SESSION_IDLE_MINUTES__ || 120);
const sessionIdleMs = Math.max(1, sessionIdleMinutes) * 60 * 1000;
const sessionRefreshIntervalMs = Math.min(5 * 60 * 1000, Math.max(30 * 1000, sessionIdleMs / 3));

function instantButtonFeedback(button) {
  if (!button || button.disabled) return;
  button.classList.add('instant-tap');
  window.setTimeout(() => button.classList.remove('instant-tap'), 120);
}
function setButtonBusy(button, busy, text = '处理中...') {
  if (!button) return;
  if (busy) {
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
    button.textContent = text;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.classList.add('is-busy');
  } else {
    if (button.dataset.originalText) button.textContent = button.dataset.originalText;
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.classList.remove('is-busy');
    delete button.dataset.originalText;
  }
}
document.addEventListener('click', (event) => {
  const control = event.target.closest('button, a.ghost');
  instantButtonFeedback(control);
}, { passive: true });


function ensureDialogHost() {
  let host = document.getElementById('dialogHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'dialogHost';
    document.body.appendChild(host);
  }
  return host;
}

function showConfirmDialog(options = {}) {
  const {
    title = '请确认操作',
    message = '',
    details = [],
    contentHtml = '',
    confirmText = '确认',
    cancelText = '取消',
    danger = true,
    icon = '!' 
  } = options;
  return new Promise(resolve => {
    const host = ensureDialogHost();
    const detailList = Array.isArray(details) && details.length
      ? `<ul class="confirm-detail-list">${details.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '';
    host.innerHTML = `
      <div class="modal-backdrop" data-dialog-backdrop>
        <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmDialogTitle">
          <div class="confirm-icon ${danger ? 'danger' : 'info'}">${escapeHtml(icon)}</div>
          <div class="confirm-body">
            <h3 id="confirmDialogTitle">${escapeHtml(title)}</h3>
            ${message ? `<p>${escapeHtml(message)}</p>` : ''}
            ${detailList}
            ${contentHtml || ''}
          </div>
          <div class="confirm-actions">
            <button class="ghost" type="button" data-dialog-cancel>${escapeHtml(cancelText)}</button>
            <button class="${danger ? 'danger-solid' : 'primary'}" type="button" data-dialog-confirm>${escapeHtml(confirmText)}</button>
          </div>
        </div>
      </div>`;

    const backdrop = host.querySelector('[data-dialog-backdrop]');
    const confirmBtn = host.querySelector('[data-dialog-confirm]');
    const cancelBtn = host.querySelector('[data-dialog-cancel]');
    const close = (value) => {
      document.removeEventListener('keydown', onKeyDown);
      host.innerHTML = '';
      resolve(value);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close(false);
      if (event.key === 'Enter' && document.activeElement !== cancelBtn) close(true);
    };
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(false);
    });
    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    document.addEventListener('keydown', onKeyDown);
    window.setTimeout(() => confirmBtn.focus(), 20);
  });
}

const defaultScoreTypes = [
  { id: 'main', label: '综合评分' },
  { id: 'independent', label: '独立评分' }
];
const defaultScoreFields = [
  { id: 'appearance', label: '外观设计', max_score: 10, score_type: 'main', score_type_label: '综合评分' },
  { id: 'material', label: '材质触感', max_score: 10, score_type: 'main', score_type_label: '综合评分' },
  { id: 'craftsmanship', label: '工艺细节', max_score: 10, score_type: 'main', score_type_label: '综合评分' },
  { id: 'capacity', label: '容量收纳', max_score: 10, score_type: 'main', score_type_label: '综合评分' },
  { id: 'comfort', label: '背负舒适度', max_score: 10, score_type: 'main', score_type_label: '综合评分' }
];


const defaultGradeRules = {
  description: '评分项和满分由后台配置；80%以上大单，60%以上中单，40%以上小单试水，40%以下建议不下',
  rules: [
    { label: '大单', min_percent: 80 },
    { label: '中单', min_percent: 60 },
    { label: '小单试水', min_percent: 40 },
    { label: '建议不下', min_percent: 0 }
  ]
};

function today() { return new Date().toISOString().slice(0, 10); }
function stripImageProxyValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, window.location.origin);
    if (url.pathname === '/api/public/image-proxy') return url.searchParams.get('url') || raw;
  } catch (_) {}
  return raw;
}
function trimBaseUrl(value) { return String(value || '').trim().replace(/\/+$/, ''); }
function cleanPathPrefix(value) { return String(value || '').trim().replace(/^\/+|\/+$/g, ''); }
function encodePath(value) { return String(value || '').split('/').filter(Boolean).map(encodeURIComponent).join('/'); }
function decodePath(value) {
  return String(value || '').split('/').filter(Boolean).map(part => {
    try { return decodeURIComponent(part); } catch (_) { return part; }
  }).join('/');
}
function looksLikeManagedKey(path, settings = {}) {
  const clean = cleanPathPrefix(path);
  if (!clean || clean.includes('..')) return false;
  const prefix = cleanPathPrefix(settings.image_key_prefix || 'review-images');
  return !prefix || clean === prefix || clean.startsWith(`${prefix}-`) || clean.startsWith(`${prefix}/`);
}
function buildPublicImageUrlFromKey(key, settings = {}) {
  const base = trimBaseUrl(settings.public_image_base_url);
  if (!base || !key) return '';
  const prefix = cleanPathPrefix(settings.public_image_path_prefix);
  const keyPath = encodePath(key);
  return prefix ? `${base}/${encodePath(prefix)}/${keyPath}` : `${base}/${keyPath}`;
}
function normalizeImageUrlToCurrentPublicDomain(value, settings = currentImageSettings || {}) {
  const raw = stripImageProxyValue(value);
  if (!raw || !/^https?:\/\//i.test(raw)) return raw;
  const publicBase = trimBaseUrl(settings.public_image_base_url);
  if (!publicBase) return raw;
  const pathPrefix = cleanPathPrefix(settings.public_image_path_prefix);
  let url;
  let base;
  try { url = new URL(raw); base = new URL(publicBase); } catch (_) { return raw; }
  let key = '';
  const rawPath = decodePath(url.pathname);
  const path = cleanPathPrefix(rawPath);
  if (url.origin === base.origin) {
    const basePath = cleanPathPrefix(base.pathname);
    let relative = path;
    if (basePath && relative === basePath) relative = '';
    else if (basePath && relative.startsWith(`${basePath}/`)) relative = relative.slice(basePath.length + 1);
    if (pathPrefix && looksLikeManagedKey(relative, settings)) {
      return buildPublicImageUrlFromKey(relative, settings);
    }
    return raw;
  }
  if (pathPrefix && path.startsWith(`${pathPrefix}/`)) {
    key = path.slice(pathPrefix.length + 1);
  }
  const endpoint = trimBaseUrl(settings.s3_endpoint);
  const bucket = String(settings.s3_bucket || '').trim();
  if (!key && endpoint && bucket) {
    try {
      const ep = new URL(endpoint);
      if (url.hostname === ep.hostname) {
        let relative = path;
        if (relative.startsWith(`${bucket}/`)) relative = relative.slice(bucket.length + 1);
        if (pathPrefix && relative.startsWith(`${pathPrefix}/`)) relative = relative.slice(pathPrefix.length + 1);
        if (looksLikeManagedKey(relative, settings)) key = relative;
      } else if (url.hostname === `${bucket}.${ep.hostname}`) {
        let relative = path;
        if (pathPrefix && relative.startsWith(`${pathPrefix}/`)) relative = relative.slice(pathPrefix.length + 1);
        if (looksLikeManagedKey(relative, settings)) key = relative;
      }
    } catch (_) {}
  }
  if (!key && looksLikeManagedKey(path, settings)) key = path;
  if (!key) {
    const managedPrefix = cleanPathPrefix(settings.image_key_prefix || 'review-images');
    const marker = managedPrefix ? `${managedPrefix}-` : '';
    if (marker) {
      const parts = path.split('/');
      const index = parts.findIndex(part => part.startsWith(marker));
      if (index >= 0) key = parts.slice(index).join('/');
    }
  }
  return key ? buildPublicImageUrlFromKey(key, settings) : raw;
}
function displayImageUrl(value) {
  const normalized = normalizeImageUrlToCurrentPublicDomain(value);
  if (/^http:\/\//i.test(normalized)) {
    return `/api/public/image-proxy?url=${encodeURIComponent(normalized)}`;
  }
  return normalized;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function normalizeMaxScore(value) {
  const n = Number.parseInt(value ?? 10, 10);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.max(1, Math.min(100, n));
}

function makeScoreTypeId(value, index = 0) {
  const raw = String(value || '').trim();
  const lowered = raw.toLowerCase();
  if (['main', 'general', 'total', '综合', '综合评分', '计入总分'].includes(lowered)) return 'main';
  if (['independent', 'standalone', 'single', 'extra', 'separate', '独立', '独立评分', '不计入总分'].includes(lowered)) return 'independent';
  return raw.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || `type_${index + 1}`;
}
function normalizeScoreType(value) { return makeScoreTypeId(value, 0); }
function normalizeBool(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on', '计入', '计入总分'].includes(text)) return true;
  if (['false', '0', 'no', 'off', '不计入', '不计入总分'].includes(text)) return false;
  return fallback;
}
function normalizeScoreTypesLocal(types) {
  const list = Array.isArray(types) ? types : defaultScoreTypes;
  const used = new Set();
  const normalized = list.map((type, index) => {
    const label = String(type?.label || type?.name || '').trim();
    if (!label) return null;
    let id = makeScoreTypeId(type.id || type.key || label, index);
    let suffix = 2;
    const base = id;
    while (used.has(id)) id = `${base}_${suffix++}`;
    used.add(id);
    return { id, label };
  }).filter(Boolean);
  return normalized.length ? normalized : defaultScoreTypes.map(item => ({ ...item }));
}
function scoreTypeMeta(value, fallback = {}) {
  const id = normalizeScoreType(value || fallback.score_type || fallback.type || 'main');
  const found = normalizeScoreTypesLocal(scoreTypes).find(item => item.id === id);
  if (found) return found;
  return {
    id,
    label: String(fallback.score_type_label || fallback.type_label || id || '综合评分')
  };
}
function isMainScoreField(field) {
  // 保留旧函数名兼容旧数据；新版中每个评分类型都是独立评分体系。
  return true;
}
function scoreTypeLabel(value, field = {}) {
  return scoreTypeMeta(value, field).label;
}

function normalizeGradeRulesLocal(value = defaultGradeRules) {
  let input = value;
  if (typeof value === 'string') {
    try { input = JSON.parse(value); } catch { input = defaultGradeRules; }
  }
  if (!input || typeof input !== 'object') input = defaultGradeRules;
  const description = String(input.description ?? input.text ?? defaultGradeRules.description).trim() || defaultGradeRules.description;
  const rawRules = Array.isArray(input.rules) && input.rules.length ? input.rules : defaultGradeRules.rules;
  const rules = rawRules.map((rule, index) => {
    const label = String(rule?.label ?? rule?.name ?? '').trim();
    if (!label) return null;
    let min = Number(rule?.min_percent ?? rule?.min ?? 0);
    if (!Number.isFinite(min)) min = 0;
    min = Math.max(0, Math.min(100, Math.round(min * 10) / 10));
    return { label, min_percent: min, order: index };
  }).filter(Boolean).sort((a, b) => b.min_percent - a.min_percent || a.order - b.order).slice(0, 20)
    .map(({ label, min_percent }) => ({ label, min_percent }));
  return { description, rules: rules.length ? rules : defaultGradeRules.rules.map(item => ({ ...item })) };
}
function fillGradeRulesForm(value = defaultGradeRules) {
  if (!gradeRuleForm) return;
  const data = normalizeGradeRulesLocal(value);
  gradeRuleForm.elements.description.value = data.description;
  for (let i = 0; i < 4; i += 1) {
    const rule = data.rules[i] || defaultGradeRules.rules[i] || { label: '', min_percent: 0 };
    if (gradeRuleForm.elements[`rule_label_${i}`]) gradeRuleForm.elements[`rule_label_${i}`].value = rule.label || '';
    if (gradeRuleForm.elements[`rule_min_${i}`]) gradeRuleForm.elements[`rule_min_${i}`].value = Number(rule.min_percent ?? 0);
  }
}
function readGradeRulesForm() {
  if (!gradeRuleForm) return normalizeGradeRulesLocal(gradeRules || defaultGradeRules);
  const description = gradeRuleForm.elements.description?.value?.trim() || defaultGradeRules.description;
  const rules = [];
  for (let i = 0; i < 4; i += 1) {
    const label = gradeRuleForm.elements[`rule_label_${i}`]?.value?.trim() || '';
    const min = gradeRuleForm.elements[`rule_min_${i}`]?.value;
    if (label) rules.push({ label, min_percent: Number(min) });
  }
  const currentRules = normalizeGradeRulesLocal(gradeRules || defaultGradeRules).rules;
  return normalizeGradeRulesLocal({ description, rules: rules.length ? rules : currentRules });
}
function gradeByScore(total, maxTotal = 50) {
  const max = Number(maxTotal);
  if (!Number.isFinite(max) || max <= 0) return '不参与评级';
  const percent = (Number(total || 0) / max) * 100;
  const config = normalizeGradeRulesLocal(gradeRules || defaultGradeRules);
  const matched = config.rules.find(rule => percent >= Number(rule.min_percent || 0));
  return matched?.label || config.rules[config.rules.length - 1]?.label || '建议不下';
}

function scoreSystemSummariesFromItems(items = []) {
  const groups = new Map();
  for (const item of items || []) {
    const typeId = normalizeScoreType(item.score_type || item.type || 'main');
    const label = scoreTypeLabel(typeId, item);
    if (!groups.has(typeId)) groups.set(typeId, { id: typeId, label, total: 0, max: 0, items: [] });
    const group = groups.get(typeId);
    const score = Number(item.score || 0);
    const max = normalizeMaxScore(item.max_score);
    group.total += score;
    group.max += max;
    group.items.push(item);
  }
  return Array.from(groups.values()).map(group => ({ ...group, grade: gradeByScore(group.total, group.max) }));
}
function renderScoreSystemSummary(score) {
  const groups = scoreSystemSummariesFromItems(getScoreItems(score));
  if (!groups.length) return '-';
  return `<div class="score-system-summary">${groups.map(group => `<span><strong>${escapeHtml(group.label)}</strong>：${group.total} / ${group.max}<em>${escapeHtml(group.grade)}</em></span>`).join('')}</div>`;
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '';
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}
function showMessage(text, type = 'success') {
  const target = (loginView && !loginView.classList.contains('hidden') && loginMessage) ? loginMessage : messageBox;
  if (!target) {
    if (type === 'error') window.alert(text);
    return;
  }
  target.textContent = text;
  target.classList.toggle('error', type === 'error');
  target.classList.remove('hidden');
  window.clearTimeout(showMessage.timer);
  showMessage.timer = window.setTimeout(() => target.classList.add('hidden'), 6000);
}
function normalizeScoreFieldsLocal(fields) {
  if (!Array.isArray(fields)) return defaultScoreFields.map(item => ({ ...item }));
  scoreTypes = normalizeScoreTypesLocal(scoreTypes);
  const used = new Set();
  const normalized = fields.map((field, index) => {
    const label = String(field.label || '').trim();
    if (!label) return null;
    let id = String(field.id || label || `field_${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || `field_${index + 1}`;
    let suffix = 2;
    const base = id;
    while (used.has(id)) id = `${base}_${suffix++}`;
    used.add(id);
    const typeId = normalizeScoreType(field.score_type ?? field.type ?? field.group ?? field.category);
    const meta = scoreTypeMeta(typeId, field);
    return {
      id,
      label,
      max_score: normalizeMaxScore(field.max_score ?? field.maxScore ?? field.max ?? field.score_max ?? 10),
      score_type: typeId,
      score_type_label: String(field.score_type_label || field.type_label || meta.label || typeId)
    };
  }).filter(Boolean);
  return normalized.length ? normalized : defaultScoreFields.map(item => ({ ...item }));
}
function makeScoreFieldId() {
  return `field_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
function storageAvailable(kind = 'localStorage') {
  try {
    const storage = window[kind];
    const key = '__product_review_storage_test__';
    storage.setItem(key, '1');
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
const localSessionMarkerSupported = storageAvailable('localStorage');
const sessionStorageSupported = storageAvailable('sessionStorage');
function setClientSessionMarker() {
  if (!localSessionMarkerSupported) return;
  try {
    localStorage.setItem(SESSION_LOGIN_MARKER_STORAGE_KEY, `${Date.now()}_${Math.random().toString(36).slice(2)}`);
  } catch {}
}
function clearClientSessionMarker() {
  try { localStorage.removeItem(SESSION_LOGIN_MARKER_STORAGE_KEY); } catch {}
  try { sessionStorage.removeItem(SESSION_EXPIRE_STORAGE_KEY); } catch {}
}
function hasClientSessionMarker() {
  if (!localSessionMarkerSupported) return true;
  try { return !!localStorage.getItem(SESSION_LOGIN_MARKER_STORAGE_KEY); } catch { return true; }
}
function showLogin() {
  clearClientSessionMarker();
  stopSessionIdleGuard();
  appView.classList.add('hidden');
  loginView.classList.remove('hidden');
}
function showApp() {
  markSessionActivityLocal();
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  startSessionIdleGuard();
}
function startSessionIdleGuard() {
  if (sessionGuardStarted) { resetSessionIdleTimer(false); return; }
  sessionGuardStarted = true;
  sessionLastRefreshAt = Date.now();
  ['click', 'input', 'keydown', 'touchstart', 'mousemove'].forEach(name => document.addEventListener(name, handleSessionActivity, { passive: true }));
  window.addEventListener('storage', handleClientStorageChange);
  window.clearInterval(sessionSiteDataTimer);
  sessionSiteDataTimer = window.setInterval(checkClientSessionMarker, 2000);
  resetSessionIdleTimer(false);
}
function stopSessionIdleGuard() {
  if (!sessionGuardStarted) return;
  sessionGuardStarted = false;
  window.clearTimeout(sessionIdleTimer);
  window.clearInterval(sessionSiteDataTimer);
  sessionSiteDataTimer = null;
  ['click', 'input', 'keydown', 'touchstart', 'mousemove'].forEach(name => document.removeEventListener(name, handleSessionActivity));
  window.removeEventListener('storage', handleClientStorageChange);
}
function markSessionActivityLocal() {
  sessionLocalExpireAt = Date.now() + sessionIdleMs;
  if (sessionStorageSupported) {
    try { sessionStorage.setItem(SESSION_EXPIRE_STORAGE_KEY, String(sessionLocalExpireAt)); } catch {}
  }
}
function getStoredSessionExpireAt() {
  if (!sessionStorageSupported) return sessionLocalExpireAt || 0;
  try { return Number(sessionStorage.getItem(SESSION_EXPIRE_STORAGE_KEY) || 0); } catch { return sessionLocalExpireAt || 0; }
}
async function expireSessionNow(message = '长时间未操作，请重新登录') {
  window.clearTimeout(sessionIdleTimer);
  window.clearInterval(sessionSiteDataTimer);
  await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
  showLogin();
  showMessage(message, 'error');
}
function checkClientSessionMarker() {
  if (loginView && !loginView.classList.contains('hidden')) return false;
  if (!hasClientSessionMarker()) {
    expireSessionNow('浏览器网站数据已被清除，请重新登录');
    return false;
  }
  return true;
}
function handleClientStorageChange(event) {
  if (!event || event.key === SESSION_LOGIN_MARKER_STORAGE_KEY || event.key === null) {
    checkClientSessionMarker();
  }
}
function checkLocalSessionExpiry() {
  if (loginView && !loginView.classList.contains('hidden')) return;
  if (!checkClientSessionMarker()) return;
  const expiresAt = getStoredSessionExpireAt();
  if (expiresAt && Date.now() >= expiresAt) {
    expireSessionNow('长时间未操作，请重新登录');
  }
}
function handleSessionActivity() {
  if (loginView && !loginView.classList.contains('hidden')) return;
  if (!checkClientSessionMarker()) return;
  markSessionActivityLocal();
  resetSessionIdleTimer(true);
}
function resetSessionIdleTimer(shouldRefresh) {
  if (!checkClientSessionMarker()) return;
  checkLocalSessionExpiry();
  window.clearTimeout(sessionIdleTimer);
  sessionIdleTimer = window.setTimeout(() => {
    expireSessionNow('长时间未操作，请重新登录');
  }, sessionIdleMs);
  if (!shouldRefresh) { markSessionActivityLocal(); return; }
  const now = Date.now();
  if (now - sessionLastRefreshAt < sessionRefreshIntervalMs) return;
  sessionLastRefreshAt = now;
  fetch('/api/me', { credentials: 'include' }).then(response => {
    if (response.status === 401) {
      showLogin();
      showMessage('登录已过期，请重新登录', 'error');
    } else if (response.ok) {
      markSessionActivityLocal();
    }
  }).catch(() => null);
}
async function requestJson(path, options = {}) {
  const response = await fetch(path, { credentials: 'include', ...options, headers: options.headers || {} });
  const data = await response.json().catch(() => null);
  if (response.status === 401) {
    // 登录接口 401 代表账号/密码不匹配；其他接口 401 才代表需要重新登录。
    if (path !== '/api/login') showLogin();
    throw new Error(data?.message || (path === '/api/login' ? '账号或密码错误' : '请先登录'));
  }
  if (!response.ok || data?.ok === false) throw new Error(data?.message || '请求失败');
  return data;
}
async function uploadImageFile(file) {
  if (!file) return '';
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');
  const form = new FormData();
  form.append('file', file);
  const response = await fetch('/api/upload-image', { method: 'POST', credentials: 'include', body: form });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(data?.message || '图片上传失败');
  return data.url || data.image?.url || '';
}
function setActiveTab(targetId) {
  $$('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.target === targetId));
  $('#styleSection').classList.toggle('hidden', targetId !== 'styleSection');
  $('#scoreSection').classList.toggle('hidden', targetId !== 'scoreSection');
  const settingsSection = $('#settingsSection');
  if (settingsSection) settingsSection.classList.toggle('hidden', targetId !== 'settingsSection');
}
function renderStats() {
  const activeStyles = styles.filter(s => Number(s.active ?? 1) === 1).length;
  const scoreCount = scores.length;
  const avg = scoreCount ? (scores.reduce((sum, row) => sum + Number(row.total_score || 0), 0) / scoreCount).toFixed(1) : '0';
  const reviewerCount = new Set(scores.map(s => String(s.reviewer || '').trim()).filter(Boolean)).size;
  statsGrid.innerHTML = `
    <div class="stat-card"><span>启用款式</span><strong>${activeStyles}</strong></div>
    <div class="stat-card"><span>评分记录</span><strong>${scoreCount}</strong></div>
    <div class="stat-card"><span>评分人数</span><strong>${reviewerCount}</strong></div>
    <div class="stat-card"><span>平均分</span><strong>${avg}</strong></div>
  `;
}
function renderScoreTypeEditor() {
  if (!scoreTypeList) return;
  scoreTypes = normalizeScoreTypesLocal(scoreTypes);
  scoreTypeList.innerHTML = scoreTypes.map((type, index) => `
    <div class="score-type-editor-row score-type-system-row" data-index="${index}" data-id="${escapeHtml(type.id)}">
      <span class="score-field-order type-order">${index + 1}</span>
      <input data-score-type-label value="${escapeHtml(type.label)}" placeholder="例如 价格竞争力 / 设计师宣讲 / 陈列建议" />
      <span class="score-system-hint">独立累计</span>
      <button class="danger-light" type="button" data-score-type-action="delete">删除</button>
    </div>
  `).join('');
}

function renderScoreFieldEditor() {
  scoreTypes = normalizeScoreTypesLocal(scoreTypes);
  scoreFields = normalizeScoreFieldsLocal(scoreFields);
  const typeOptions = (selectedId) => scoreTypes.map(type => `<option value="${escapeHtml(type.id)}" ${type.id === selectedId ? 'selected' : ''}>${escapeHtml(type.label)}</option>`).join('');
  scoreFieldList.innerHTML = scoreFields.map((field, index) => {
    const meta = scoreTypeMeta(field.score_type, field);
    return `
      <div class="score-field-editor-row" data-index="${index}" data-id="${escapeHtml(field.id)}">
        <span class="score-field-order">${index + 1}</span>
        <input data-score-field-label value="${escapeHtml(field.label)}" placeholder="评分项名称" />
        <label class="score-type-editor"><span>类型</span><select class="pretty-select" data-score-field-type>${typeOptions(meta.id)}</select></label>
        <label class="score-max-editor"><span>满分</span><input data-score-field-max type="number" min="1" max="100" step="1" value="${normalizeMaxScore(field.max_score)}" /></label>
        <button class="danger-light" type="button" data-score-field-action="delete">删除</button>
      </div>
    `;
  }).join('');
}

function normalizeImageSettingsLocal(settings = {}) {
  return {
    driver: String(settings.driver || 'url').trim().toLowerCase() || 'url',
    image_max_size_mb: Number(settings.image_max_size_mb || 10),
    image_key_prefix: String(settings.image_key_prefix || 'review-images').trim() || 'review-images',
    public_image_base_url: String(settings.public_image_base_url || '').trim(),
    public_image_path_prefix: String(settings.public_image_path_prefix || '').trim(),
    s3_endpoint: String(settings.s3_endpoint || '').trim(),
    s3_bucket: String(settings.s3_bucket || '').trim(),
    s3_region: String(settings.s3_region || 'us-east-1').trim() || 'us-east-1',
    s3_access_key_id: String(settings.s3_access_key_id || '').trim(),
    s3_secret_access_key: String(settings.s3_secret_access_key || '').trim(),
    s3_force_path_style: settings.s3_force_path_style !== false
  };
}

function guessS3Provider(endpoint = '') {
  const text = String(endpoint || '').toLowerCase();
  if (text.includes('qiniu') || text.includes('qiniucs')) return 'qiniu';
  if (text.includes('aliyuncs') || text.includes('aliyun')) return 'aliyun';
  if (text.includes('myqcloud') || text.includes('tencent') || text.includes('cos.')) return 'tencent';
  if (text.includes('minio')) return 'minio';
  return 'custom';
}
function applyS3ProviderPreset(provider) {
  if (!imageStorageForm) return;
  const form = imageStorageForm;
  const setIfEmpty = (name, value) => {
    const el = form.elements[name];
    if (el && !String(el.value || '').trim()) el.value = value;
  };
  if (provider && provider !== 'custom') {
    if (form.elements.driver) form.elements.driver.value = 's3';
  }
  if (provider === 'qiniu') {
    setIfEmpty('s3_endpoint', 'https://s3-cn-east-1.qiniucs.com');
    setIfEmpty('s3_region', 'cn-east-1');
    if (form.elements.s3_force_path_style) form.elements.s3_force_path_style.checked = true;
  } else if (provider === 'aliyun') {
    setIfEmpty('s3_endpoint', 'https://oss-cn-guangzhou.aliyuncs.com');
    setIfEmpty('s3_region', 'oss-cn-guangzhou');
    if (form.elements.s3_force_path_style) form.elements.s3_force_path_style.checked = false;
  } else if (provider === 'tencent') {
    setIfEmpty('s3_endpoint', 'https://cos.ap-guangzhou.myqcloud.com');
    setIfEmpty('s3_region', 'ap-guangzhou');
    if (form.elements.s3_force_path_style) form.elements.s3_force_path_style.checked = false;
  } else if (provider === 'minio') {
    setIfEmpty('s3_region', 'us-east-1');
    if (form.elements.s3_force_path_style) form.elements.s3_force_path_style.checked = true;
  }
  toggleImageSettingsFields();
}
function fillImageSettingsForm(settings = {}) {
  if (!imageStorageForm) return;
  const data = normalizeImageSettingsLocal(settings);
  imageStorageForm.elements.driver.value = ['url', 'r2', 's3'].includes(data.driver) ? data.driver : 'url';
  if (imageStorageForm.elements.s3_provider) imageStorageForm.elements.s3_provider.value = data.s3_provider || guessS3Provider(data.s3_endpoint || '') || 'custom';
  imageStorageForm.elements.image_max_size_mb.value = data.image_max_size_mb || 10;
  imageStorageForm.elements.image_key_prefix.value = data.image_key_prefix || 'review-images';
  imageStorageForm.elements.public_image_base_url.value = data.public_image_base_url || '';
  if (imageStorageForm.elements.public_image_path_prefix) imageStorageForm.elements.public_image_path_prefix.value = data.public_image_path_prefix || '';
  imageStorageForm.elements.s3_endpoint.value = data.s3_endpoint || '';
  imageStorageForm.elements.s3_bucket.value = data.s3_bucket || '';
  imageStorageForm.elements.s3_region.value = data.s3_region || 'us-east-1';
  imageStorageForm.elements.s3_access_key_id.value = data.s3_access_key_id || '';
  imageStorageForm.elements.s3_secret_access_key.value = data.s3_secret_access_key === '********' ? '' : data.s3_secret_access_key || '';
  const secretToggle = imageStorageForm.querySelector('[data-target="s3_secret_access_key"]');
  if (secretToggle) secretToggle.textContent = imageStorageForm.elements.s3_secret_access_key.type === 'text' ? '🙈' : '👁';
  imageStorageForm.elements.s3_force_path_style.checked = data.s3_force_path_style !== false;
  toggleImageSettingsFields();
}
function readImageSettingsForm() {
  const form = imageStorageForm;
  if (!form) return {};
  return {
    driver: form.elements.driver.value,
    image_max_size_mb: form.elements.image_max_size_mb.value,
    image_key_prefix: form.elements.image_key_prefix.value.trim(),
    public_image_base_url: form.elements.public_image_base_url.value.trim(),
    public_image_path_prefix: form.elements.public_image_path_prefix ? form.elements.public_image_path_prefix.value.trim().replace(/^\/+|\/+$/g, '') : '',
    s3_endpoint: form.elements.s3_endpoint.value.trim(),
    s3_bucket: form.elements.s3_bucket.value.trim(),
    s3_region: form.elements.s3_region.value.trim(),
    s3_access_key_id: form.elements.s3_access_key_id.value.trim(),
    s3_secret_access_key: form.elements.s3_secret_access_key.value,
    s3_force_path_style: form.elements.s3_force_path_style.checked,
    s3_provider: form.elements.s3_provider ? form.elements.s3_provider.value : 'custom'
  };
}
function toggleImageSettingsFields() {
  if (!imageStorageForm) return;
  const driver = imageStorageForm.elements.driver.value;
  const isS3 = driver === 's3';
  imageStorageForm.querySelectorAll('.s3-dependent, .s3-settings').forEach(el => el.classList.toggle('hidden', !isS3));
}

function readScoreTypesFromEditor() {
  if (!scoreTypeList) return normalizeScoreTypesLocal(scoreTypes);
  const rows = Array.from(scoreTypeList.querySelectorAll('.score-type-editor-row'));
  const types = rows.map((row, index) => {
    const label = row.querySelector('[data-score-type-label]')?.value?.trim() || '';
    const previousId = row.dataset.id || '';
    return {
      id: previousId || makeScoreTypeId(label, index),
      label
    };
  }).filter(type => type.label);
  if (!types.length) throw new Error('至少保留 1 个评分类型');
  return normalizeScoreTypesLocal(types);
}

function readScoreFieldsFromEditor() {
  scoreTypes = readScoreTypesFromEditor();
  const rows = Array.from(scoreFieldList.querySelectorAll('.score-field-editor-row'));
  const fields = rows.map((row, index) => {
    const typeId = normalizeScoreType(row.querySelector('[data-score-field-type]')?.value);
    const meta = scoreTypeMeta(typeId);
    return {
      id: row.dataset.id || makeScoreFieldId(),
      label: row.querySelector('[data-score-field-label]')?.value?.trim() || '',
      max_score: normalizeMaxScore(row.querySelector('[data-score-field-max]')?.value),
      score_type: typeId,
      score_type_label: meta.label
    };
  }).filter(field => field.label);
  if (!fields.length) throw new Error('至少保留 1 个评分项');
  return normalizeScoreFieldsLocal(fields);
}
function getScoreItems(score) {
  if (Array.isArray(score?.score_items) && score.score_items.length) return score.score_items;
  return scoreFields.map(field => ({ id: field.id, label: field.label, max_score: normalizeMaxScore(field.max_score), score_type: normalizeScoreType(field.score_type), score_type_label: scoreTypeLabel(field.score_type, field), score: Number(score?.[field.id] || 0) }));
}
function getScoreSubmitTime(score) {
  return String(score?.submitted_at || score?.created_at || score?.review_date || '').trim();
}
function getScoreGroupKey(score) {
  const submissionId = String(score?.submission_id || '').trim();
  if (submissionId) return `submission:${submissionId}`;
  return `legacy:${score?.id || ''}`;
}
function buildScoreGroups(rows) {
  const groups = new Map();
  for (const score of rows || []) {
    const key = getScoreGroupKey(score);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        reviewer: String(score.reviewer || '').trim() || '未命名',
        submitted_at: getScoreSubmitTime(score),
        scores: []
      });
    }
    const group = groups.get(key);
    group.scores.push(score);
    if (getScoreSubmitTime(score) > group.submitted_at) group.submitted_at = getScoreSubmitTime(score);
  }
  return Array.from(groups.values())
    .map(group => ({ ...group, scores: group.scores.sort((a, b) => Number(a.style_id || 0) - Number(b.style_id || 0) || String(a.style_code || '').localeCompare(String(b.style_code || ''))) }))
    .sort((a, b) => String(b.submitted_at || '').localeCompare(String(a.submitted_at || '')));
}
function renderScoreGroupDetail(group) {
  const labelMap = new Map();
  for (const score of group.scores) {
    for (const item of getScoreItems(score)) {
      const key = `${normalizeScoreType(item.score_type)}::${item.label}`;
      if (!labelMap.has(key)) labelMap.set(key, { key, label: item.label, score_type: normalizeScoreType(item.score_type), score_type_label: scoreTypeLabel(item.score_type, item) });
    }
  }
  if (!labelMap.size) scoreFields.forEach(item => { const key = `${normalizeScoreType(item.score_type)}::${item.label}`; labelMap.set(key, { key, label: item.label, score_type: normalizeScoreType(item.score_type), score_type_label: scoreTypeLabel(item.score_type, item) }); });
  const labels = Array.from(labelMap.values()).sort((a, b) => String(scoreTypeLabel(a.score_type, a)).localeCompare(String(scoreTypeLabel(b.score_type, b))));
  return `
    <tr class="score-group-detail-row">
      <td colspan="3">
        <div class="score-group-detail">
          <div class="section-title compact-title">
            <div>
              <h3>${escapeHtml(group.reviewer)} 的本次提交明细</h3>
              <p class="tip">提交时间：${escapeHtml(group.submitted_at || '-')}，共 ${group.scores.length} 款。</p>
            </div>
          </div>
          <div class="table-wrap nested-table-wrap">
            <table class="review-table detail-score-table">
              <thead><tr>
                <th>产品图</th><th>款式编码</th><th>季节</th><th>基本售价</th>
                ${labels.map(item => `<th>${escapeHtml(item.label)}<small class="score-type-mini">${scoreTypeLabel(item.score_type, item)}</small></th>`).join('')}
                <th>各评分体系得分</th><th>备注</th>
              </tr></thead>
              <tbody>
                ${group.scores.map(score => {
                  const image = score.product_image
                    ? `<img class="photo" src="${escapeHtml(displayImageUrl(score.product_image))}" alt="产品图" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'photo-placeholder',textContent:'无图'}))">`
                    : '<span class="photo-placeholder">无图</span>';
                  const values = Object.fromEntries(getScoreItems(score).map(item => [`${normalizeScoreType(item.score_type)}::${item.label}`, `${item.score} / ${normalizeMaxScore(item.max_score)}`]));
                  return `
                    <tr>
                      <td>${image}</td>
                      <td><strong>${escapeHtml(score.style_code)}</strong></td>
                      <td>${escapeHtml(score.season || '')}</td>
                      <td>${formatMoney(score.base_price)}</td>
                      ${labels.map(item => `<td class="score-cell">${escapeHtml(values[item.key] ?? '')}</td>`).join('')}
                      <td class="total-cell system-total-cell">${renderScoreSystemSummary(score)}</td>
                      <td class="remark-cell" title="${escapeHtml(score.remark || '')}">${escapeHtml(score.remark || '')}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  `;
}
function renderStylePhoto(url, className = 'photo') {
  const safe = displayImageUrl(String(url || '').trim());
  return safe
    ? `<img class="${className}" src="${escapeHtml(safe)}" alt="产品图" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'photo-placeholder',textContent:'无图'}))">`
    : '<span class="photo-placeholder">无图</span>';
}
function renderInlineStyleRow(style) {
  const activeChecked = Number(style.active ?? 1) === 1 ? 'checked' : '';
  return `
    <tr class="style-inline-edit-row" data-style-edit-id="${escapeHtml(style.id)}">
      <td>
        <div class="inline-image-editor">
          <div data-inline-image-preview>${renderStylePhoto(style.product_image, 'photo inline-photo')}</div>
          <input class="visually-hidden" data-inline-image-file type="file" accept="image/*" />
          <button class="ghost mini-btn" type="button" data-style-action="inline-upload" data-id="${escapeHtml(style.id)}">换图</button>
          <input class="inline-style-input image-url-input" data-inline-field="product_image" value="${escapeHtml(style.product_image || '')}" placeholder="图片链接" />
        </div>
      </td>
      <td><input class="inline-style-input" data-inline-field="style_code" value="${escapeHtml(style.style_code || '')}" placeholder="款式编码" required /></td>
      <td><input class="inline-style-input" data-inline-field="season" value="${escapeHtml(style.season || '')}" placeholder="季节" /></td>
      <td><input class="inline-style-input" data-inline-field="base_price" type="number" min="0" step="0.01" value="${escapeHtml(style.base_price ?? '')}" placeholder="售价" /></td>
      <td><label class="inline-switch"><input data-inline-field="active" type="checkbox" ${activeChecked} /> <span>启用</span></label></td>
      <td><textarea class="inline-style-input inline-remark" data-inline-field="style_remark" rows="2" placeholder="款式备注">${escapeHtml(style.style_remark || '')}</textarea></td>
      <td>${escapeHtml(style.created_at || '')}</td>
      <td class="no-print"><div class="actions inline-actions">
        <button class="primary" type="button" data-style-action="save-edit" data-id="${escapeHtml(style.id)}">保存</button>
        <button class="ghost" type="button" data-style-action="cancel-edit" data-id="${escapeHtml(style.id)}">取消</button>
        <button class="danger-light" type="button" data-style-action="delete" data-id="${escapeHtml(style.id)}">删除</button>
      </div></td>
    </tr>
  `;
}
function readInlineStylePayload(row) {
  const field = (name) => row.querySelector(`[data-inline-field="${name}"]`);
  const code = field('style_code')?.value?.trim() || '';
  if (!code) throw new Error('款式编码不能为空');
  return {
    product_image: field('product_image')?.value?.trim() || '',
    style_code: code,
    season: field('season')?.value?.trim() || '',
    base_price: field('base_price')?.value || '',
    active: field('active')?.checked ? 1 : 0,
    style_remark: field('style_remark')?.value?.trim() || ''
  };
}
function updateInlineImagePreview(row, url, options = {}) {
  const preview = row.querySelector('[data-inline-image-preview]');
  const input = row.querySelector('[data-inline-field="product_image"]');
  const shouldUpdateInput = options.updateInput !== false;
  if (input && shouldUpdateInput) input.value = String(url || '').trim();
  if (preview) preview.innerHTML = renderStylePhoto(url, 'photo inline-photo');
}
function updateInlineLocalImagePreview(row, file) {
  if (!row || !file) return;
  const previous = row.dataset.localPreviewUrl;
  if (previous) { try { URL.revokeObjectURL(previous); } catch {} }
  const localUrl = URL.createObjectURL(file);
  row.dataset.localPreviewUrl = localUrl;
  pendingInlineImageFiles.set(row.dataset.styleEditId, file);
  updateInlineImagePreview(row, localUrl, { updateInput: false });
}
function clearInlineLocalImagePreview(row, options = {}) {
  const previous = row?.dataset?.localPreviewUrl;
  if (previous) { try { URL.revokeObjectURL(previous); } catch {} }
  if (row) {
    delete row.dataset.localPreviewUrl;
    if (options.clearPending !== false) pendingInlineImageFiles.delete(row.dataset.styleEditId);
  }
}
async function commitPendingInlineImageIfNeeded(row) {
  const id = row?.dataset?.styleEditId;
  const file = id ? pendingInlineImageFiles.get(id) : null;
  if (!file) return '';
  const url = await uploadImageFile(file);
  pendingInlineImageFiles.delete(id);
  clearInlineLocalImagePreview(row, { clearPending: false });
  updateInlineImagePreview(row, url);
  return url;
}
function renderStyles() {
  renderStats();
  if (!styles.length) {
    stylesBody.innerHTML = '<tr><td class="empty" colspan="8">暂无款式，请先在后台新增需要评分的款式。</td></tr>';
    return;
  }
  stylesBody.innerHTML = styles.map(style => {
    if (String(inlineEditingStyleId || '') === String(style.id)) return renderInlineStyleRow(style);
    const image = renderStylePhoto(style.product_image);
    return `
      <tr>
        <td>${image}</td>
        <td><strong>${escapeHtml(style.style_code)}</strong></td>
        <td>${escapeHtml(style.season || '')}</td>
        <td>${formatMoney(style.base_price)}</td>
        <td>${Number(style.active ?? 1) === 1 ? '<strong class="status-on">启用</strong>' : '<span class="status-off">停用</span>'}</td>
        <td class="remark-cell" title="${escapeHtml(style.style_remark || '')}">${escapeHtml(style.style_remark || '')}</td>
        <td>${escapeHtml(style.created_at || '')}</td>
        <td class="no-print"><div class="actions">
          <button class="ghost" data-style-action="edit" data-id="${escapeHtml(style.id)}">编辑</button>
          <button class="danger-light" data-style-action="delete" data-id="${escapeHtml(style.id)}">删除</button>
        </div></td>
      </tr>
    `;
  }).join('');
}
function renderScores() {
  renderStats();
  scoreGroups = buildScoreGroups(scores);
  if (selectedScoreGroupKey && !scoreGroups.some(group => group.key === selectedScoreGroupKey)) selectedScoreGroupKey = null;

  scoresHead.innerHTML = `
    <tr>
      <th>评分人</th>
      <th>提交时间</th>
      <th class="no-print">操作</th>
    </tr>`;
  if (!scoreGroups.length) {
    scoresBody.innerHTML = '<tr><td class="empty" colspan="3">暂无评分记录。</td></tr>';
    return;
  }
  scoresBody.innerHTML = scoreGroups.map((group, index) => {
    const opened = selectedScoreGroupKey === group.key;
    return `
      <tr class="score-group-row ${opened ? 'opened' : ''}">
        <td>
          <button class="link-button reviewer-link" type="button" data-score-group-action="toggle" data-group-index="${index}">${escapeHtml(group.reviewer)}</button>
          <span class="group-count">${group.scores.length} 款</span>
        </td>
        <td>${escapeHtml(group.submitted_at || '-')}</td>
        <td class="no-print"><div class="actions">
          <button class="ghost" type="button" data-score-group-action="toggle" data-group-index="${index}">${opened ? '收起' : '查看'}</button>
          <button class="danger-light" type="button" data-score-group-action="delete" data-group-index="${index}">删除</button>
        </div></td>
      </tr>
      ${opened ? renderScoreGroupDetail(group) : ''}
    `;
  }).join('');
}
async function loadSettings() {
  const data = await requestJson('/api/settings');
  scoreTypes = normalizeScoreTypesLocal(data.settings?.score_types || defaultScoreTypes);
  scoreFields = normalizeScoreFieldsLocal(data.settings?.score_fields || defaultScoreFields);
  gradeRules = normalizeGradeRulesLocal(data.settings?.grade_rules || defaultGradeRules);
  currentImageSettings = normalizeImageSettingsLocal(data.settings?.image_settings || {});
  renderScoreTypeEditor();
  renderScoreFieldEditor();
  fillImageSettingsForm(data.settings?.image_settings || {});
  fillGradeRulesForm(gradeRules);
}
async function loadStyles() {
  const params = new URLSearchParams(new FormData(styleSearchForm));
  const data = await requestJson(`/api/styles?${params}`);
  styles = data.styles || [];
  renderStyles();
}


function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = Array.from(document.scripts).find(script => script.src === src);
    if (existing && existing.dataset.loaded === 'true') { resolve(); return; }
    const script = existing || document.createElement('script');
    let done = false;
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error('加载超时'));
    }, 12000);
    script.onload = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      reject(new Error('加载失败'));
    };
    if (!existing) {
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }
  });
}

async function ensureXlsxParser() {
  if (window.XLSX?.read) return window.XLSX;
  if (!xlsxLoaderPromise) {
    xlsxLoaderPromise = (async () => {
      for (const src of XLSX_CDN_URLS) {
        try {
          await loadScript(src);
          if (window.XLSX?.read) return window.XLSX;
        } catch (_) {}
      }
      throw new Error('Excel 解析库加载失败，请检查网络后重试。');
    })();
  }
  return xlsxLoaderPromise;
}

function normalizeImportHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_\-:：/\()（）【】\[\]]+/g, '');
}

function findImportColumns(rows) {
  const aliases = {
    style_code: ['款式编码', '款号', '款式编号', '编码', 'stylecode', 'style_code', 'sku', '货号'],
    season: ['季节', '季度', 'season'],
    base_price: ['基本售价', '售价', '价格', '吊牌价', '零售价', 'baseprice', 'base_price', 'price']
  };
  const normalizedAliases = Object.fromEntries(Object.entries(aliases).map(([key, list]) => [key, new Set(list.map(normalizeImportHeader))]));
  const maxHeaderRows = Math.min(rows.length, 20);
  for (let rowIndex = 0; rowIndex < maxHeaderRows; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const columns = {};
    row.forEach((cell, colIndex) => {
      const header = normalizeImportHeader(cell);
      if (!header) return;
      for (const [key, set] of Object.entries(normalizedAliases)) {
        if (set.has(header) && columns[key] === undefined) columns[key] = colIndex;
      }
    });
    if (columns.style_code !== undefined) return { rowIndex, columns };
  }
  throw new Error('没有找到“款式编码”表头，请确认 Excel 第一行包含：款式编码、季节、基本售价。');
}

function cellToText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function normalizeImportPrice(value) {
  const text = cellToText(value).replace(/[￥¥,，\s]/g, '');
  if (!text) return '';
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? match[0] : '';
}

function parseStyleRows(rows, sourceName = '导入数据') {
  const { rowIndex, columns } = findImportColumns(rows);
  const resultMap = new Map();
  let skippedBlank = 0;
  for (let i = rowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const styleCode = cellToText(row[columns.style_code]);
    if (!styleCode) { skippedBlank += 1; continue; }
    const item = {
      style_code: styleCode,
      season: columns.season === undefined ? '' : cellToText(row[columns.season]),
      base_price: columns.base_price === undefined ? '' : normalizeImportPrice(row[columns.base_price])
    };
    resultMap.set(styleCode.toLowerCase(), item);
  }
  const records = Array.from(resultMap.values());
  if (!records.length) throw new Error('没有可导入的款式数据，请确认表格里至少有一行款式编码。');
  return { records, skippedBlank, sheetName: sourceName };
}

async function parseStyleExcelFile(file) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  const looksLikeExcel = /\.(xlsx|xls)$/.test(name) || type.includes('spreadsheet') || type.includes('ms-excel');
  if (!looksLikeExcel) throw new Error('请选择 .xls 或 .xlsx 格式文件');
  const XLSX = await ensureXlsxParser();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames?.[0];
  if (!firstSheetName) throw new Error('Excel 文件里没有工作表');
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { header: 1, defval: '', raw: false });
  return parseStyleRows(rows, firstSheetName);
}

function parseDelimitedImportText(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('剪贴板里没有可导入的表格内容');
  const lines = raw.split(/\r?\n/).map(line => line.trimEnd()).filter(Boolean);
  if (!lines.length) throw new Error('剪贴板里没有可导入的表格内容');
  const delimiter = raw.includes('\t') ? '\t' : (raw.includes('|') ? '|' : ',');
  const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, '')));
  return parseStyleRows(rows, '剪贴板表格');
}

function getStyleImportFileFromClipboard(event) {
  const clipboard = event.clipboardData;
  if (!clipboard) return null;
  const files = Array.from(clipboard.files || []);
  const file = files.find(item => item && (/\.(xlsx|xls)$/i.test(item.name || '') || String(item.type || '').includes('spreadsheet') || String(item.type || '').includes('ms-excel')));
  if (file) return file;
  const items = Array.from(clipboard.items || []);
  for (const item of items) {
    const type = String(item.type || '');
    if (item.kind === 'file' && (type.includes('spreadsheet') || type.includes('ms-excel'))) {
      const got = item.getAsFile();
      if (got) return got;
    }
  }
  return null;
}

function buildImportPreviewHtml(records) {
  const previewRows = records.slice(0, 8).map(item => `
    <tr>
      <td>${escapeHtml(item.style_code)}</td>
      <td>${escapeHtml(item.season || '-')}</td>
      <td>${escapeHtml(item.base_price || '-')}</td>
    </tr>`).join('');
  const more = records.length > 8 ? `<p class="tip import-tip">仅预览前 8 条，其余 ${records.length - 8} 条会一起导入。</p>` : '';
  return `<div class="import-preview-card">
    <div class="import-preview-title">导入预览</div>
    <div class="import-preview-table-wrap">
      <table class="import-preview-table">
        <thead><tr><th>款式编码</th><th>季节</th><th>基本售价</th></tr></thead>
        <tbody>${previewRows}</tbody>
      </table>
    </div>
    ${more}
  </div>`;
}

function renderImportModalPreview(parsed) {
  const panel = document.getElementById('styleImportModalPreview');
  const confirmBtn = document.getElementById('styleImportConfirmBtn');
  if (!panel || !confirmBtn) return;
  if (!parsed?.records?.length) {
    panel.innerHTML = '<p class="tip">请选择、拖拽或粘贴 .xls / .xlsx 文件；也支持直接从 Excel 复制三列表格后粘贴。</p>';
    confirmBtn.disabled = true;
    return;
  }
  pendingStyleImportRecords = parsed.records;
  pendingStyleImportMeta = parsed;
  confirmBtn.disabled = false;
  panel.innerHTML = `
    <div class="import-ready-card">
      <strong>已识别 ${parsed.records.length} 个款式</strong>
      <span>来源：${escapeHtml(parsed.sheetName || parsed.fileName || '导入文件')}</span>
    </div>
    ${buildImportPreviewHtml(parsed.records)}`;
}

async function setStyleImportModalFile(file) {
  const dropZone = document.getElementById('styleImportDropZone');
  const preview = document.getElementById('styleImportDropPreview');
  if (!file) return;
  try {
    if (preview) preview.innerHTML = `<span>正在读取：${escapeHtml(file.name || 'Excel 文件')}</span>`;
    const parsed = await parseStyleExcelFile(file);
    parsed.fileName = file.name || 'Excel 文件';
    renderImportModalPreview(parsed);
    dropZone?.classList.add('paste-success');
    setTimeout(() => dropZone?.classList.remove('paste-success'), 900);
  } catch (e) {
    pendingStyleImportRecords = null;
    pendingStyleImportMeta = null;
    renderImportModalPreview(null);
    showMessage(e.message || '读取导入文件失败', 'error');
  }
}

async function setStyleImportModalText(text) {
  const dropZone = document.getElementById('styleImportDropZone');
  try {
    const parsed = parseDelimitedImportText(text);
    renderImportModalPreview(parsed);
    dropZone?.classList.add('paste-success');
    setTimeout(() => dropZone?.classList.remove('paste-success'), 900);
  } catch (e) {
    showMessage(e.message || '粘贴的表格内容无法识别', 'error');
  }
}

async function importPendingStyleRecords() {
  const confirmBtn = document.getElementById('styleImportConfirmBtn');
  if (!pendingStyleImportRecords?.length) {
    showMessage('请先选择、拖拽或粘贴需要导入的款式文件', 'error');
    return;
  }
  setButtonBusy(confirmBtn, true, '导入中...');
  try {
    const data = await requestJson('/api/styles/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ styles: pendingStyleImportRecords })
    });
    closeStyleImportDialog();
    showMessage(`导入完成：新增 ${data.created_count || 0} 个，更新 ${data.updated_count || 0} 个，跳过 ${data.skipped_count || 0} 个。`);
    await loadStyles();
  } catch (e) {
    showMessage(e.message || '导入失败', 'error');
  } finally {
    setButtonBusy(confirmBtn, false);
  }
}

function downloadStyleImportTemplate() {
  const a = document.createElement('a');
  a.href = STYLE_IMPORT_TEMPLATE_URL;
  a.download = '款式导入模板.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function closeStyleImportDialog() {
  document.removeEventListener('keydown', styleImportDialogKeyHandler);
  document.removeEventListener('paste', styleImportDialogPasteHandler);
  const host = ensureDialogHost();
  host.innerHTML = '';
  pendingStyleImportRecords = null;
  pendingStyleImportMeta = null;
}

function styleImportDialogKeyHandler(event) {
  if (event.key === 'Escape') closeStyleImportDialog();
}

async function styleImportDialogPasteHandler(event) {
  const modal = document.getElementById('styleImportModal');
  if (!modal) return;
  const file = getStyleImportFileFromClipboard(event);
  if (file) {
    event.preventDefault();
    event.stopPropagation();
    await setStyleImportModalFile(file);
    return;
  }
  const text = event.clipboardData?.getData('text/plain') || '';
  if (text && /款式编码|款号|style\s*code|\t/.test(text)) {
    event.preventDefault();
    event.stopPropagation();
    await setStyleImportModalText(text);
  }
}

function openStyleImportDialog() {
  const host = ensureDialogHost();
  pendingStyleImportRecords = null;
  pendingStyleImportMeta = null;
  host.innerHTML = `
    <div class="modal-backdrop" data-import-backdrop>
      <div id="styleImportModal" class="confirm-dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="styleImportDialogTitle">
        <div class="confirm-icon info">导</div>
        <div class="confirm-body import-dialog-body">
          <h3 id="styleImportDialogTitle">导入已配置款式</h3>
          <p>支持 .xls / .xlsx 文件；字段需要包含“款式编码、季节、基本售价”。同款式编码会更新季节和基本售价，并保留原图片、备注和启用状态。</p>
          <input class="visually-hidden" id="styleImportFileInput" type="file" accept="${STYLE_IMPORT_ACCEPT}" />
          <div id="styleImportDropZone" class="drop-zone import-drop-zone" tabindex="0" role="button" aria-label="点击、拖拽或粘贴导入款式 Excel 文件">
            <div id="styleImportDropPreview" class="drop-preview import-file-preview"><span>点击选择文件、拖拽 Excel 到这里，或复制文件/表格后 Ctrl+V 粘贴</span></div>
            <div class="drop-text">
              <strong>上传导入文件</strong>
              <span>支持 .xls / .xlsx；也支持从 Excel 复制“款式编码、季节、基本售价”三列表格后粘贴。</span>
            </div>
          </div>
          <div id="styleImportModalPreview" class="import-modal-preview"><p class="tip">还没有选择文件。可以先点“导入模板”下载标准模板。</p></div>
        </div>
        <div class="confirm-actions import-actions">
          <button class="ghost" type="button" id="styleImportCancelBtn">取消</button>
          <button class="primary-light" type="button" id="styleImportTemplateBtn">导入模板</button>
          <button class="primary" type="button" id="styleImportConfirmBtn" disabled>确定</button>
        </div>
      </div>
    </div>`;

  styleImportFileInput = document.getElementById('styleImportFileInput');
  const dropZone = document.getElementById('styleImportDropZone');
  const backdrop = host.querySelector('[data-import-backdrop]');
  const cancelBtn = document.getElementById('styleImportCancelBtn');
  const templateBtn = document.getElementById('styleImportTemplateBtn');
  const confirmBtn = document.getElementById('styleImportConfirmBtn');

  const chooseFile = () => styleImportFileInput?.click();
  dropZone.addEventListener('click', chooseFile);
  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseFile(); }
  });
  styleImportFileInput.addEventListener('change', async () => {
    const file = styleImportFileInput.files?.[0];
    styleImportFileInput.value = '';
    if (file) await setStyleImportModalFile(file);
  });
  ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.add('drag-over');
  }));
  ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
  }));
  dropZone.addEventListener('drop', async (event) => {
    const file = Array.from(event.dataTransfer?.files || []).find(item => /\.(xlsx|xls)$/i.test(item.name || '') || String(item.type || '').includes('spreadsheet') || String(item.type || '').includes('ms-excel'));
    if (file) await setStyleImportModalFile(file);
    else showMessage('请拖入 .xls 或 .xlsx 格式文件', 'error');
  });
  dropZone.addEventListener('paste', styleImportDialogPasteHandler);
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) closeStyleImportDialog();
  });
  cancelBtn.addEventListener('click', closeStyleImportDialog);
  templateBtn.addEventListener('click', downloadStyleImportTemplate);
  confirmBtn.addEventListener('click', importPendingStyleRecords);
  document.addEventListener('keydown', styleImportDialogKeyHandler);
  document.addEventListener('paste', styleImportDialogPasteHandler);
  window.setTimeout(() => dropZone.focus(), 20);
}

function ensureStyleImportControls() {
  if (!deleteAllStylesBtn || document.getElementById('styleImportBtn')) return;
  const importBtn = document.createElement('button');
  importBtn.id = 'styleImportBtn';
  importBtn.className = 'primary-light';
  importBtn.type = 'button';
  importBtn.textContent = '导入款式';
  deleteAllStylesBtn.insertAdjacentElement('beforebegin', importBtn);
  importBtn.addEventListener('click', openStyleImportDialog);
}
async function loadScores() {
  const params = new URLSearchParams(new FormData(scoreSearchForm));
  const data = await requestJson(`/api/scores?${params}`);
  scores = data.scores || [];
  renderScores();
}
let stylePreviewLocalObjectUrl = '';
let pendingStyleImageFile = null;
const pendingInlineImageFiles = new Map();
function clearStyleLocalPreviewUrl() {
  if (stylePreviewLocalObjectUrl) {
    try { URL.revokeObjectURL(stylePreviewLocalObjectUrl); } catch {}
    stylePreviewLocalObjectUrl = '';
  }
}
function renderStylePreviewImage(url, note = '') {
  const safe = String(url || '').trim();
  const src = /^blob:|^data:/i.test(safe) ? safe : displayImageUrl(safe);
  stylePreview.innerHTML = safe
    ? `<img class="image-preview" src="${escapeHtml(src)}" alt="产品图预览" loading="lazy" referrerpolicy="no-referrer" />${note ? `<small class="preview-note">${escapeHtml(note)}</small>` : ''}`
    : '<span>拖拽图片到这里、点击选择，或复制图片后按 Ctrl+V 粘贴</span>';
}
function setImagePreview(url, options = {}) {
  clearStyleLocalPreviewUrl();
  if (!options.keepPending) pendingStyleImageFile = null;
  const safe = String(url || '').trim();
  styleForm.elements.product_image.value = safe;
  if (styleForm.elements.product_image_url) styleForm.elements.product_image_url.value = safe;
  renderStylePreviewImage(safe);
}
function setLocalImagePreview(file) {
  clearStyleLocalPreviewUrl();
  pendingStyleImageFile = file || null;
  if (!file) return;
  stylePreviewLocalObjectUrl = URL.createObjectURL(file);
  renderStylePreviewImage(stylePreviewLocalObjectUrl, '本地预览：点击保存款式后才会上传，取消/换图前不会写入七牛云');
}
function resetStyleForm() {
  editingStyleId = null;
  styleForm.reset();
  styleForm.elements.active.checked = true;
  styleFormTitle.textContent = '新增评分款式';
  cancelStyleEditBtn.classList.add('hidden');
  pendingStyleImageFile = null;
  setImagePreview('');
}
function fillStyleForm(style) {
  // 已停用：已有款式编辑改为表格行内编辑，不再回填到新增区域。
  inlineEditingStyleId = style?.id || null;
  editingStyleId = null;
  resetStyleForm();
  renderStyles();
}

function fillScoreEditForm(score) {
  editingScoreId = score.id;
  const items = getScoreItems(score).map(item => ({ id: item.id, label: item.label, max_score: normalizeMaxScore(item.max_score), score_type: normalizeScoreType(item.score_type), score_type_label: scoreTypeLabel(item.score_type, item), score: Number(item.score || 0) }));
  editingScoreMeta = { style_id: score.style_id, reviewer: score.reviewer || '', review_date: score.review_date || today(), score_items: items };
  scoreEditPanel.classList.remove('hidden');
  scoreEditForm.elements.style_id.value = score.style_id || '';
  scoreEditForm.elements.style_info.value = `${score.style_code || ''} ${score.season || ''}`.trim();
  scoreEditForm.elements.remark.value = score.remark || '';
  $('#scoreEditItems').innerHTML = `
    <legend>评分项</legend>
    ${items.map(item => `
      <label class="score-row">
        <span>${escapeHtml(item.label)}<small class="score-type-mini">${scoreTypeLabel(item.score_type, item)}</small></span>
        <input data-score-item-id="${escapeHtml(item.id)}" data-score-item-label="${escapeHtml(item.label)}" data-score-item-max="${normalizeMaxScore(item.max_score)}" data-score-item-type="${normalizeScoreType(item.score_type)}" data-score-item-type-label="${escapeHtml(scoreTypeLabel(item.score_type, item))}" type="range" min="0" max="${normalizeMaxScore(item.max_score)}" step="1" value="${Number(item.score || 0)}" />
        <output>${Number(item.score || 0)} / ${normalizeMaxScore(item.max_score)}</output>
      </label>
    `).join('')}
    <div class="total-box"><span>各评分体系得分</span><strong id="scoreEditTotal">0</strong><em id="scoreEditGrade"></em></div>`;
  updateScoreEditTotal();
  scoreEditPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function updateScoreEditTotal() {
  const groups = new Map();
  scoreEditForm.querySelectorAll('[data-score-item-id]').forEach(input => {
    const typeId = normalizeScoreType(input.dataset.scoreItemType || 'main');
    const label = input.dataset.scoreItemTypeLabel || scoreTypeLabel(typeId);
    if (!groups.has(typeId)) groups.set(typeId, { label, total: 0, max: 0 });
    const group = groups.get(typeId);
    group.total += Number(input.value || 0);
    group.max += normalizeMaxScore(input.dataset.scoreItemMax || input.max);
  });
  const text = Array.from(groups.values()).map(group => `${group.label}: ${group.total} / ${group.max}`).join('；') || '0';
  $('#scoreEditTotal').textContent = text;
  $('#scoreEditGrade').textContent = Array.from(groups.values()).map(group => `${group.label}: ${gradeByScore(group.total, group.max)}`).join('；');
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  setButtonBusy(submitBtn, true, '登录中...');
  try {
    await requestJson('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ username: loginForm.elements.username.value.trim(), password: loginForm.elements.password.value })
    });
    loginForm.reset();
    setClientSessionMarker();
    showApp();
    await loadSettings();
    await Promise.all([loadStyles(), loadScores()]);
  } catch (e) { showMessage(e.message, 'error'); }
  finally { setButtonBusy(submitBtn, false); }
});
logoutBtn.addEventListener('click', async () => {
  setButtonBusy(logoutBtn, true, '退出中...');
  await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
  setButtonBusy(logoutBtn, false);
  showLogin();
});
$$('.tab').forEach(tab => tab.addEventListener('click', () => setActiveTab(tab.dataset.target)));


if (imageStorageForm) {
  imageStorageForm.elements.driver.addEventListener('change', toggleImageSettingsFields);
  const secretToggleBtn = imageStorageForm.querySelector('[data-target="s3_secret_access_key"]');
  if (secretToggleBtn) secretToggleBtn.addEventListener('click', () => {
    const input = imageStorageForm.elements.s3_secret_access_key;
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    secretToggleBtn.textContent = show ? '🙈' : '👁';
    secretToggleBtn.title = show ? '隐藏 SecretKey' : '显示 SecretKey';
  });
  if (imageStorageForm.elements.s3_provider) imageStorageForm.elements.s3_provider.addEventListener('change', () => applyS3ProviderPreset(imageStorageForm.elements.s3_provider.value));
  imageStorageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setButtonBusy(saveImageSettingsBtn, true, '保存中...');
    try {
      const payload = readImageSettingsForm();
      if (payload.driver === 's3' && !payload.s3_secret_access_key) payload.s3_secret_access_key = '********';
      const data = await requestJson('/api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ image_settings: payload })
      });
      fillImageSettingsForm(data.settings?.image_settings || payload);
      showMessage('图片存储配置已保存');
    } catch (e) { showMessage(e.message, 'error'); }
    finally { setButtonBusy(saveImageSettingsBtn, false); }
  });
}


if (gradeRuleForm) {
  gradeRuleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setButtonBusy(saveGradeRulesBtn, true, '保存中...');
    try {
      const payload = readGradeRulesForm();
      const data = await requestJson('/api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ grade_rules: payload })
      });
      gradeRules = normalizeGradeRulesLocal(data.settings?.grade_rules || payload);
      fillGradeRulesForm(gradeRules);
      renderScores();
      showMessage('前端说明文字已保存，前端刷新后生效');
    } catch (e) { showMessage(e.message, 'error'); }
    finally { setButtonBusy(saveGradeRulesBtn, false); }
  });
}

addScoreFieldBtn.addEventListener('click', () => {
  scoreFields.push({ id: makeScoreFieldId(), label: `评分项${scoreFields.length + 1}`, max_score: 10, score_type: normalizeScoreTypesLocal(scoreTypes)[0]?.id || 'main' });
  renderScoreFieldEditor();
});

if (addScoreTypeBtn) {
  addScoreTypeBtn.addEventListener('click', () => {
    scoreTypes = normalizeScoreTypesLocal(scoreTypes);
    scoreTypes.push({ id: makeScoreTypeId(`评分类型${scoreTypes.length + 1}`, scoreTypes.length), label: `评分类型${scoreTypes.length + 1}` });
    renderScoreTypeEditor();
    renderScoreFieldEditor();
  });
}
if (scoreTypeList) {
  scoreTypeList.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-score-type-action="delete"]');
    if (!btn) return;
    const rows = Array.from(scoreTypeList.querySelectorAll('.score-type-editor-row'));
    if (rows.length <= 1) { showMessage('至少保留 1 个评分类型', 'error'); return; }
    const row = btn.closest('.score-type-editor-row');
    const typeId = row?.dataset.id;
    row?.remove();
    scoreTypes = readScoreTypesFromEditor();
    const fallbackType = scoreTypes[0]?.id || 'main';
    scoreFields = scoreFields.map(field => normalizeScoreType(field.score_type) === typeId ? { ...field, score_type: fallbackType } : field);
    renderScoreFieldEditor();
  });
  scoreTypeList.addEventListener('input', () => {
    try { scoreTypes = readScoreTypesFromEditor(); renderScoreFieldEditor(); } catch {}
  });
}

scoreFieldList.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-score-field-action="delete"]');
  if (!btn) return;
  const row = btn.closest('.score-field-editor-row');
  const rows = Array.from(scoreFieldList.querySelectorAll('.score-field-editor-row'));
  if (rows.length <= 1) { showMessage('至少保留 1 个评分项', 'error'); return; }
  row.remove();
});
saveScoreFieldsBtn.addEventListener('click', async () => {
  setButtonBusy(saveScoreFieldsBtn, true, '保存中...');
  try {
    const fields = readScoreFieldsFromEditor();
    const types = normalizeScoreTypesLocal(scoreTypes);
    const data = await requestJson('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ score_types: types, score_fields: fields })
    });
    scoreTypes = normalizeScoreTypesLocal(data.settings?.score_types || types);
    scoreFields = normalizeScoreFieldsLocal(data.settings?.score_fields || fields);
    renderScoreTypeEditor();
    renderScoreFieldEditor();
    showMessage('评分类型和评分项已保存，前端评分页会按新配置显示');
    await loadScores();
  } catch (e) { showMessage(e.message, 'error'); }
  finally { setButtonBusy(saveScoreFieldsBtn, false); }
});


function getClipboardImageFile(event) {
  const clipboard = event.clipboardData;
  if (!clipboard) return null;
  const files = Array.from(clipboard.files || []);
  const directFile = files.find(file => file && String(file.type || '').startsWith('image/'));
  if (directFile) return directFile;
  const items = Array.from(clipboard.items || []);
  for (const item of items) {
    if (item && item.kind === 'file' && String(item.type || '').startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

async function handleStyleClipboardPaste(event) {
  const file = getClipboardImageFile(event);
  if (!file) return false;
  event.preventDefault();
  try {
    await uploadAndSetPreview(file);
    styleDropZone.classList.add('paste-success');
    setTimeout(() => styleDropZone.classList.remove('paste-success'), 900);
    showMessage('已从剪贴板读取图片，本地预览中；点击保存款式后才会上传');
  } catch (e) {
    showMessage(e.message || '粘贴图片失败', 'error');
  }
  return true;
}

async function uploadAndSetPreview(file) {
  // 只做本地预览并暂存文件，不立即上传到七牛云/OSS。
  if (!file || !file.type.startsWith('image/')) throw new Error('请选择图片文件');
  setLocalImagePreview(file);
  return '';
}
async function commitPendingStyleImageIfNeeded() {
  if (!pendingStyleImageFile) return styleForm.elements.product_image.value.trim() || styleForm.elements.product_image_url.value.trim();
  const url = await uploadImageFile(pendingStyleImageFile);
  pendingStyleImageFile = null;
  if (url) setImagePreview(url);
  return url;
}
styleDropZone.addEventListener('click', () => styleImageFile.click());
styleDropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); styleImageFile.click(); }
});
styleDropZone.addEventListener('paste', handleStyleClipboardPaste);
document.addEventListener('paste', (event) => {
  const styleSection = $('#styleSection');
  if (!styleSection || styleSection.classList.contains('hidden')) return;
  if (!getClipboardImageFile(event)) return;
  const active = document.activeElement;
  const tag = String(active?.tagName || '').toLowerCase();
  const isTextInput = tag === 'textarea' || (tag === 'input' && active.type !== 'file' && active.type !== 'checkbox');
  if (isTextInput || active?.isContentEditable) return;
  handleStyleClipboardPaste(event);
});
['dragenter', 'dragover'].forEach(name => styleDropZone.addEventListener(name, (event) => {
  event.preventDefault();
  styleDropZone.classList.add('drag-over');
}));
['dragleave', 'drop'].forEach(name => styleDropZone.addEventListener(name, (event) => {
  event.preventDefault();
  styleDropZone.classList.remove('drag-over');
}));
styleDropZone.addEventListener('drop', async (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  try { await uploadAndSetPreview(file); showMessage('图片已选择，本地预览中；点击保存款式后才会上传'); } catch(e) { showMessage(e.message, 'error'); }
});
styleImageFile.addEventListener('change', async () => {
  const file = styleImageFile.files?.[0];
  if (!file) return;
  try { await uploadAndSetPreview(file); showMessage('图片已选择，本地预览中；点击保存款式后才会上传'); } catch(e) { showMessage(e.message, 'error'); }
  finally { styleImageFile.value = ''; }
});
styleForm.elements.product_image_url.addEventListener('input', () => { pendingStyleImageFile = null; setImagePreview(styleForm.elements.product_image_url.value.trim()); });

styleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitBtn = styleForm.querySelector('button[type="submit"]');
  setButtonBusy(submitBtn, true, editingStyleId ? '更新中...' : '保存中...');
  try {
    const committedImageUrl = await commitPendingStyleImageIfNeeded();
    const payload = {
      product_image: committedImageUrl || styleForm.elements.product_image.value.trim() || styleForm.elements.product_image_url.value.trim(),
      style_code: styleForm.elements.style_code.value.trim(),
      season: styleForm.elements.season.value.trim(),
      base_price: styleForm.elements.base_price.value,
      active: styleForm.elements.active.checked ? 1 : 0,
      style_remark: styleForm.elements.style_remark.value.trim()
    };
    await requestJson(editingStyleId ? `/api/styles/${encodeURIComponent(editingStyleId)}` : '/api/styles', {
      method: editingStyleId ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    });
    showMessage(editingStyleId ? '款式已更新' : '款式已新增');
    resetStyleForm();
    await loadStyles();
  } catch (e) { showMessage(e.message, 'error'); }
  finally { setButtonBusy(submitBtn, false); }
});
cancelStyleEditBtn.addEventListener('click', () => { inlineEditingStyleId = null; resetStyleForm(); });
styleSearchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitBtn = event.submitter || styleSearchForm.querySelector('button[type="submit"]');
  setButtonBusy(submitBtn, true, '查询中...');
  try { await loadStyles(); } catch(e) { showMessage(e.message, 'error'); }
  finally { setButtonBusy(submitBtn, false); }
});
$('#clearStyleSearchBtn').addEventListener('click', async (event) => {
  setButtonBusy(event.currentTarget, true, '重置中...');
  styleSearchForm.reset();
  try { await loadStyles(); } finally { setButtonBusy(event.currentTarget, false); }
});

ensureStyleImportControls();

if (deleteAllStylesBtn) {
  deleteAllStylesBtn.addEventListener('click', async (event) => {
    if (!styles.length) {
      showMessage('当前没有可删除的款式。', 'error');
      return;
    }
    const count = styles.length;
    const confirmed = await showConfirmDialog({
      title: '删除全部已配置款式？',
      message: '确定删除当前查询结果中的全部已配置款式吗？',
      details: [`本次将删除 ${count} 个款式。`, '删除后不可恢复，前端评分页也不会再显示这些款式。', '对应的七牛云/OSS 图片也会尝试同步清理。'],
      confirmText: '确认全部删除',
      cancelText: '取消',
      danger: true,
      icon: '删'
    });
    if (!confirmed) return;
    setButtonBusy(event.currentTarget, true, '删除中...');
    try {
      const params = new URLSearchParams(new FormData(styleSearchForm));
      const data = await requestJson(`/api/styles/delete-all?${params}`, { method: 'DELETE' });
      showMessage(`已删除 ${data.deleted_count || 0} 个款式。`);
      inlineEditingStyleId = null;
      resetStyleForm();
      await loadStyles();
    } catch (e) {
      showMessage(e.message || '全部删除款式失败', 'error');
    } finally {
      setButtonBusy(event.currentTarget, false);
    }
  });
}
stylesBody.addEventListener('click', async (event) => {
  const btn = event.target.closest('button[data-style-action]');
  if (!btn) return;
  const style = styles.find(row => String(row.id) === String(btn.dataset.id));
  if (!style) return;
  const action = btn.dataset.styleAction;
  if (action === 'edit') {
    resetStyleForm();
    inlineEditingStyleId = style.id;
    renderStyles();
    return;
  }
  if (action === 'cancel-edit') {
    const row = btn.closest('[data-style-edit-id]');
    if (row) clearInlineLocalImagePreview(row);
    pendingInlineImageFiles.delete(String(style.id));
    inlineEditingStyleId = null;
    renderStyles();
    return;
  }
  if (action === 'inline-upload') {
    const row = btn.closest('[data-style-edit-id]');
    row?.querySelector('[data-inline-image-file]')?.click();
    return;
  }
  if (action === 'save-edit') {
    const row = btn.closest('[data-style-edit-id]');
    if (!row) return;
    setButtonBusy(btn, true, '保存中...');
    try {
      await commitPendingInlineImageIfNeeded(row);
      const payload = readInlineStylePayload(row);
      await requestJson(`/api/styles/${encodeURIComponent(style.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload)
      });
      showMessage('款式已更新');
      inlineEditingStyleId = null;
      await loadStyles();
    } catch(e) { showMessage(e.message, 'error'); }
    finally { setButtonBusy(btn, false); }
    return;
  }
  if (action === 'delete') {
    const confirmed = await showConfirmDialog({
      title: '删除这个款式？',
      message: `确定删除款式 ${style.style_code} 吗？`,
      details: ['已产生的评分记录不会删除。', '如果该款式绑定了系统上传的七牛云/OSS 图片，也会尝试同步删除。'],
      confirmText: '确认删除',
      cancelText: '取消',
      danger: true,
      icon: '删'
    });
    if (!confirmed) return;
    try { await requestJson(`/api/styles/${encodeURIComponent(style.id)}`, { method: 'DELETE' }); showMessage('款式已删除'); inlineEditingStyleId = null; await loadStyles(); } catch(e) { showMessage(e.message, 'error'); }
  }
});
stylesBody.addEventListener('change', async (event) => {
  const fileInput = event.target.closest('[data-inline-image-file]');
  if (!fileInput) return;
  const row = fileInput.closest('[data-style-edit-id]');
  const file = fileInput.files?.[0];
  if (!row || !file) return;
  try {
    if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');
    updateInlineLocalImagePreview(row, file);
    showMessage('图片已选择，本地预览中；点击保存后才会上传并替换旧图');
  } catch(e) { showMessage(e.message, 'error'); }
  finally { fileInput.value = ''; }
});
stylesBody.addEventListener('input', (event) => {
  const imageInput = event.target.closest('[data-inline-field="product_image"]');
  if (!imageInput) return;
  const row = imageInput.closest('[data-style-edit-id]');
  if (row) { clearInlineLocalImagePreview(row); updateInlineImagePreview(row, imageInput.value.trim()); }
});

scoreSearchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitBtn = event.submitter || scoreSearchForm.querySelector('button[type="submit"]');
  setButtonBusy(submitBtn, true, '查询中...');
  try { await loadScores(); } catch(e) { showMessage(e.message, 'error'); }
  finally { setButtonBusy(submitBtn, false); }
});

if (deleteAllScoresBtn) {
  deleteAllScoresBtn.addEventListener('click', async (event) => {
    if (!scores.length) {
      showMessage('当前没有可删除的评分结果。', 'error');
      return;
    }
    const groupCount = scoreGroups.length || buildScoreGroups(scores).length;
    const scoreCount = scores.length;
    const confirmed = await showConfirmDialog({
      title: '删除全部评分结果？',
      message: '确定删除当前查询结果中的全部评分结果吗？',
      details: [`本次将删除 ${groupCount} 次提交、共 ${scoreCount} 款评分记录。`, '删除后不可恢复。'],
      confirmText: '确认全部删除',
      cancelText: '取消',
      danger: true,
      icon: '删'
    });
    if (!confirmed) return;
    setButtonBusy(event.currentTarget, true, '删除中...');
    try {
      const params = new URLSearchParams(new FormData(scoreSearchForm));
      const data = await requestJson(`/api/scores/delete-all?${params}`, { method: 'DELETE' });
      showMessage(`已删除 ${data.deleted_count || 0} 款评分记录。`);
      selectedScoreGroupKey = null;
      await loadScores();
    } catch (e) {
      showMessage(e.message || '全部删除失败', 'error');
    } finally {
      setButtonBusy(event.currentTarget, false);
    }
  });
}

$('#clearScoreSearchBtn').addEventListener('click', async (event) => {
  setButtonBusy(event.currentTarget, true, '重置中...');
  scoreSearchForm.reset();
  try { await loadScores(); } finally { setButtonBusy(event.currentTarget, false); }
});
scoresBody.addEventListener('click', async (event) => {
  const groupBtn = event.target.closest('button[data-score-group-action]');
  if (groupBtn) {
    const group = scoreGroups[Number(groupBtn.dataset.groupIndex)];
    if (!group) return;
    const action = groupBtn.dataset.scoreGroupAction;
    if (action === 'toggle') {
      selectedScoreGroupKey = selectedScoreGroupKey === group.key ? null : group.key;
      renderScores();
      return;
    }
    if (action === 'delete') {
      const confirmed = await showConfirmDialog({
        title: '删除这次提交？',
        message: `确定删除 ${group.reviewer} 在 ${group.submitted_at || '-'} 提交的评分结果吗？`,
        details: [`本次提交包含 ${group.scores.length} 款评分记录。`, '删除后不可恢复。'],
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
        icon: '删'
      });
      if (!confirmed) return;
      setButtonBusy(groupBtn, true, '删除中...');
      try {
        await Promise.all(group.scores.map(score => requestJson(`/api/scores/${encodeURIComponent(score.id)}`, { method: 'DELETE' })));
        showMessage('评分结果已删除');
        selectedScoreGroupKey = null;
        await loadScores();
      } catch (e) {
        showMessage(e.message || '删除失败', 'error');
      } finally {
        setButtonBusy(groupBtn, false);
      }
      return;
    }
  }

  const btn = event.target.closest('button[data-score-action]');
  if (!btn) return;
  const score = scores.find(row => String(row.id) === String(btn.dataset.id));
  if (!score) return;
  showMessage('评分结果不允许编辑修改；如需删除，请在提交记录行点击“删除”。', 'error');
});
scoreEditForm.addEventListener('input', (event) => {
  const range = event.target.closest('[data-score-item-id]');
  if (!range) return;
  range.nextElementSibling.textContent = `${range.value} / ${range.max}`;
  updateScoreEditTotal();
});
scoreEditForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!editingScoreId || !editingScoreMeta) return;
  const submitBtn = scoreEditForm.querySelector('button[type="submit"]');
  setButtonBusy(submitBtn, true, '保存中...');
  try {
    const items = Array.from(scoreEditForm.querySelectorAll('[data-score-item-id]')).map(input => ({
      id: input.dataset.scoreItemId,
      label: input.dataset.scoreItemLabel,
      max_score: normalizeMaxScore(input.dataset.scoreItemMax || input.max),
      score_type: normalizeScoreType(input.dataset.scoreItemType),
      score_type_label: input.dataset.scoreItemTypeLabel || scoreTypeLabel(input.dataset.scoreItemType),
      score: Number(input.value || 0)
    }));
    const payload = {
      style_id: editingScoreMeta.style_id,
      reviewer: editingScoreMeta.reviewer,
      review_date: editingScoreMeta.review_date,
      remark: scoreEditForm.elements.remark.value.trim(),
      score_items: items
    };
    await requestJson(`/api/scores/${encodeURIComponent(editingScoreId)}`, {
      method: 'PUT', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload)
    });
    showMessage('评分记录已更新');
    editingScoreId = null;
    editingScoreMeta = null;
    scoreEditPanel.classList.add('hidden');
    scoreEditForm.reset();
    await loadScores();
  } catch(e) { showMessage(e.message, 'error'); }
  finally { setButtonBusy(submitBtn, false); }
});
cancelScoreEditBtn.addEventListener('click', () => { editingScoreId = null; editingScoreMeta = null; scoreEditPanel.classList.add('hidden'); scoreEditForm.reset(); });
$('#closeHistoryBtn').addEventListener('click', () => historyPanel.classList.add('hidden'));
$('#printBtn').addEventListener('click', () => window.print());


window.addEventListener('focus', checkLocalSessionExpiry);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkLocalSessionExpiry();
});

async function checkLogin() {
  if (!hasClientSessionMarker()) {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
    showLogin();
    return;
  }
  try {
    await requestJson('/api/me');
    showApp();
    markSessionActivityLocal();
    resetStyleForm();
    await loadSettings();
    await Promise.all([loadStyles(), loadScores()]);
  } catch { showLogin(); }
}
checkLogin();
