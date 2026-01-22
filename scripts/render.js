import { state } from './state.js';
import { $, escapeHtml } from './dom.js';
import { t } from './i18n.js';

export function renderList(el, items, activeIndex = -1) {
  el.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = t('ui.empty');
    el.appendChild(empty);
    return;
  }
  items.forEach((it, idx) => {
    const div = document.createElement('div');
    div.className = 'pill' + (idx === activeIndex ? ' active' : '');
    div.innerHTML = `<span>${escapeHtml(it.label ?? String(it))}</span><small>${idx + 1}</small>`;
    el.appendChild(div);
  });
}

export function renderStack(el, frames) {
  el.innerHTML = '';
  if (!frames.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = t('ui.empty');
    el.appendChild(empty);
    return;
  }
  frames
    .slice()
    .reverse()
    .forEach((f, i) => {
      const div = document.createElement('div');
      div.className = 'pill' + (i === 0 ? ' active' : '');
      div.innerHTML = `<span>${escapeHtml(f)}</span><small>${frames.length - i}</small>`;
      el.appendChild(div);
    });
}

export function renderConsole(el, lines) {
  el.innerHTML = '';
  if (!lines.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = t('ui.noOutput');
    el.appendChild(empty);
    return;
  }
  lines.forEach((l) => {
    const div = document.createElement('div');
    div.className = 'line';
    div.textContent = l;
    el.appendChild(div);
  });
  el.scrollTop = el.scrollHeight;
}

export function render() {
  renderStack($('stack'), state.stack);
  renderList($('micro'), state.micro);
  renderList($('task'), state.task);
  renderConsole($('console'), state.console);
  $('stepBadge').textContent = t('ui.stepBadge', { step: state.step });
}

export function renderAnalysis(container, steps) {
  container.innerHTML = '';
  steps.forEach((step) => {
    const line = document.createElement('div');
    line.className = 'line';

    if (step.type === 'info') {
      line.style.opacity = '0.6';
      line.style.marginTop = '4px';
    } else if (step.type === 'phase') {
      line.style.fontWeight = 'bold';
      line.style.color = '#6299ff';
      line.style.marginTop = '10px';
    } else if (step.type === 'subtitle') {
      line.style.fontWeight = 'bold';
      line.style.color = '#78ffaa';
      line.style.marginTop = '8px';
    } else if (step.type === 'step' || step.type === 'queue' || step.type === 'stack') {
      line.style.color = '#ffd25a';
      line.style.fontWeight = '500';
    } else if (step.type === 'detail') {
      line.style.fontWeight = '600';
      line.style.color = '#e8eefc';
      line.style.marginTop = '6px';
    } else if (step.type === 'explanation') {
      line.style.color = '#b0b8d0';
      line.style.marginLeft = '12px';
      line.style.fontSize = '12px';
    } else if (step.type === 'rule') {
      line.style.fontWeight = '700';
      line.style.color = '#78ffaa';
      line.style.marginTop = '10px';
      line.style.padding = '6px 8px';
      line.style.backgroundColor = 'rgba(120, 255, 170, 0.1)';
      line.style.borderRadius = '6px';
    } else if (step.type === 'summary') {
      line.style.color = '#98c8ff';
      line.style.marginTop = '4px';
      line.style.fontWeight = '500';
    }

    line.textContent = step.text;
    container.appendChild(line);
  });
}
