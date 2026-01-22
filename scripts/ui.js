import { state } from './state.js';
import { render } from './render.js';
import { $ } from './dom.js';
import { t } from './i18n.js';

export function resetState(keepProgram = true) {
  state.step = 0;
  state.ip = 0;
  state.stack = [];
  state.micro = [];
  state.task = [];
  state.console = [];
  state.pending = null;
  if (state.mode === 'custom') {
    if (!keepProgram) state.customTimeline = [];
    state.customIndex = 0;
    state.phase = keepProgram ? 'custom' : 'idle';
  } else {
    state.phase = keepProgram ? 'sync' : 'idle';
  }
  $('stepBadge').textContent = t('ui.stepBadge', { step: state.step });
  const nLog = document.getElementById('nLog');
  if (nLog) nLog.innerHTML = '';
  render();
}

export function stopAuto() {
  if (state.autoTimer) {
    clearInterval(state.autoTimer);
    state.autoTimer = null;
    $('auto').textContent = t('ui.auto');
  }
}
