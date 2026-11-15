// Idioma de la interfaz (inglés por defecto; español opcional). Los textos de NASA
// (títulos, descripciones, créditos) llegan de la API en inglés y no se traducen.
//
// En el HTML:  data-i18n="clave"            → textContent
//              data-i18n-html="clave"       → innerHTML (solo textos propios con <kbd>)
//              data-i18n-aria-label="clave" → atributo aria-label
// Desde JS:    setText(el, 'clave', params) o setText(el, () => texto) deja el elemento
//              ligado: se vuelve a traducir solo al cambiar de idioma.

import { STRINGS } from './strings.js';

export const LANGS = ['en', 'es'];
const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'earth-jukebox-lang';

function savedLang() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(value) ? value : null;
  } catch {
    return null;
  }
}

let lang = savedLang() ?? DEFAULT_LANG;
const listeners = new Set();
const bound = new WeakMap(); // elemento → { key, params } | función

export const getLang = () => lang;

export function t(key, params = {}) {
  const entry = STRINGS[lang][key] ?? STRINGS[DEFAULT_LANG][key];
  if (entry === undefined) {
    console.warn(`i18n: falta la clave «${key}»`);
    return key;
  }
  return typeof entry === 'function' ? entry(params) : entry;
}

export function setText(el, keyOrFn, params) {
  if (!el) return;
  delete el.dataset.i18n; // la clave del HTML deja de aplicarse
  bound.set(el, typeof keyOrFn === 'function' ? keyOrFn : { key: keyOrFn, params });
  el.dataset.i18nBound = '';
  renderBound(el);
}

// Texto que no se traduce (por ejemplo, un título de NASA): suelta cualquier clave.
export function setPlainText(el, text) {
  if (!el) return;
  delete el.dataset.i18n;
  delete el.dataset.i18nBound;
  bound.delete(el);
  el.textContent = text;
}

function renderBound(el) {
  const b = bound.get(el);
  if (!b) return;
  el.textContent = typeof b === 'function' ? b() : t(b.key, b.params);
}

export function setAriaLabel(el, key, params) {
  if (!el) return;
  el.setAttribute('aria-label', t(key, params));
}

export function translateDom(root = document) {
  document.documentElement.lang = lang;
  document.title = t('meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-aria-label]')) el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  for (const el of root.querySelectorAll('[data-i18n-bound]')) renderBound(el);
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // sin almacenamiento: el cambio dura hasta recargar
  }
  translateDom();
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
