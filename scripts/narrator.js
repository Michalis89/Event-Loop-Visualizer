import { $, escapeHtml } from './dom.js';
import { state } from './state.js';
import { render } from './render.js';
import { t } from './i18n.js';

export function setCompileInfo(msg) {
  $('compileInfo').textContent = msg || '';
}

export function narratorLogEntry({ now, rule, why }) {
  const box = document.getElementById('nLog');
  if (!box) return;

  const line = document.createElement('div');
  line.className = 'line';
  line.innerHTML = `
    <div style="opacity:.85; font-weight:700;">${escapeHtml(t('labels.step', { step: state.step }))}</div>
    <div>${escapeHtml(t('labels.now'))}: ${escapeHtml(now ?? '')}</div>
    <div>${escapeHtml(t('labels.rule'))}: ${escapeHtml(rule ?? '')}</div>
    <div>${escapeHtml(t('labels.why'))}: ${escapeHtml(why ?? '')}</div>
    <div style="height:8px;"></div>
  `;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

export function setNarrator({ now, rule, why }) {
  if (now != null) $('nNow').textContent = now;
  if (rule != null) $('nRule').textContent = rule;
  if (why != null) $('nWhy').textContent = why;

  if (now != null) narratorLogEntry({ now, rule, why });
}

export function narratorSync(nowMsg) {
  setNarrator({
    now: nowMsg,
    rule: t('narrator.sync.rule'),
    why: t('narrator.sync.why'),
  });
}

export function narratorCheckpoint(msg) {
  setNarrator({
    now: msg,
    rule: t('narrator.checkpoint.rule'),
    why: t('narrator.checkpoint.why'),
  });
}

export function narratorTask(msg) {
  setNarrator({
    now: msg,
    rule: t('narrator.task.rule'),
    why: t('narrator.task.why'),
  });
}

export function pushConsole(line) {
  state.console.push(line);
  render();
}
