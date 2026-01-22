let dict = {};
let currentLang = 'el';

export function t(key, vars = {}) {
  const template = dict[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export function getLanguage() {
  return currentLang;
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  const titleEl = document.querySelector('title[data-i18n]');
  if (titleEl) titleEl.textContent = t(titleEl.dataset.i18n);
}

export async function setLanguage(lang) {
  try {
    const res = await fetch(`i18n/${lang}.json`, { cache: 'no-store' });
    dict = await res.json();
    currentLang = lang;
    document.documentElement.lang = lang;
    localStorage.setItem('lang', lang);
    applyI18n();
  } catch (e) {
    console.error('Failed to load language', lang, e);
  }
}

export async function initI18n(defaultLang = 'el') {
  const saved = localStorage.getItem('lang');
  const lang = saved || defaultLang;
  await setLanguage(lang);
}
