import { $ } from './dom.js';
import { state } from './state.js';
import { getPresets } from './presets.js';
import { render } from './render.js';
import { setCompileInfo, setNarrator, narratorCheckpoint, narratorTask } from './narrator.js';
import { compile, execSyncAction, execMicrotask, execTask } from './toy.js';
import { resetState, stopAuto } from './ui.js';
import { stepCustom } from './custom.js';
import { analyzeCode } from './analysis.js';
import { initI18n, setLanguage, getLanguage, t, applyI18n } from './i18n.js';

const presetSel = $('preset');
const codeArea = $('code');
const customArea = $('customCode');
const langToggle = $('langToggle');

let presets = [];

function loadPresets() {
  presets = getPresets(t);
  presetSel.innerHTML = '';
  presets.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = p.name;
    presetSel.appendChild(opt);
  });
}

function maybeSetDefaultToyCode() {
  if (!codeArea.value.trim() && presets.length) {
    codeArea.value = presets[0].code;
  }
}

function maybeSetCustomSample() {
  if (!customArea.value.trim()) {
    customArea.value = t('custom.sample');
  }
}

function updateLangButton() {
  const nextLabel = getLanguage() === 'el' ? 'EN' : 'EL';
  langToggle.textContent = nextLabel;
  langToggle.title = t('ui.langSwitchTitle');
}

$('loadPreset').addEventListener('click', () => {
  codeArea.value = presets[Number(presetSel.value)].code;
  setCompileInfo(t('msg.presetLoaded'));
});

$('compile').addEventListener('click', () => {
  try {
    const program = compile(codeArea.value);
    state.program = program;
    resetState(true);
    setCompileInfo(t('msg.compileOk', { count: program.length }));
    setNarrator({
      now: t('msg.compileNow'),
      rule: t('msg.compileRule'),
      why: t('msg.compileWhy'),
    });
  } catch (e) {
    setCompileInfo(String(e.message || e));
  }
});

async function step() {
  if (state.mode === 'custom') {
    await stepCustom();
    return;
  }

  state.step++;
  $('stepBadge').textContent = t('ui.stepBadge', { step: state.step });

  if (state.phase === 'done') return;

  if (state.pending) {
    const { phase, action, stage } = state.pending;

    if (stage === 'enter') {
      const frameName =
        phase === 'sync'
          ? action.type === 'async_block'
            ? 'async()'
            : action.type + '()'
          : phase === 'checkpoint'
            ? 'microtask()'
            : 'task()';

      state.stack.push(frameName);
      if (phase === 'sync') {
        setNarrator({
          now: t('msg.step.enter.sync', { frame: frameName }),
          rule: t('narrator.sync.rule'),
          why: t('narrator.sync.why'),
        });
      } else if (phase === 'checkpoint') {
        setNarrator({
          now: t('msg.step.enter.micro'),
          rule: t('narrator.checkpoint.rule'),
          why: t('narrator.checkpoint.why'),
        });
      } else {
        setNarrator({
          now: t('msg.step.enter.task'),
          rule: t('narrator.task.rule'),
          why: t('narrator.task.why'),
        });
      }
      state.pending.stage = 'run';
      render();
      return;
    }

    if (phase === 'sync') {
      execSyncAction(action);
    } else if (phase === 'checkpoint') {
      execMicrotask(action);
    } else if (phase === 'task') {
      execTask(action);
      state.phase = 'checkpoint';
    }

    state.stack.pop();
    state.pending = null;
    render();
    return;
  }

  if (state.phase === 'sync') {
    if (state.ip < state.program.length) {
      const action = state.program[state.ip++];
      const label = action.type === 'async_block' ? 'async()' : `${action.type}()`;
      setNarrator({
        now: t('msg.step.queue.sync', { action: label }),
        rule: t('narrator.sync.rule'),
        why: t('narrator.sync.why'),
      });
      state.pending = { phase: 'sync', action, stage: 'enter' };
      render();
      return;
    }
    state.phase = 'checkpoint';
    narratorCheckpoint(t('msg.syncEnd'));
    render();
    return;
  }

  if (state.phase === 'checkpoint') {
    if (state.micro.length > 0) {
      const action = state.micro.shift();
      setNarrator({
        now: t('msg.step.queue.micro', { action: action.label ?? 'microtask()' }),
        rule: t('narrator.checkpoint.rule'),
        why: t('narrator.checkpoint.why'),
      });
      state.pending = { phase: 'checkpoint', action, stage: 'enter' };
      render();
      return;
    }
    if (state.task.length > 0) {
      state.phase = 'task';
      narratorTask(t('msg.microtasksEmpty'));
      render();
      return;
    }
    state.phase = 'done';
    setNarrator({
      now: t('msg.done'),
      rule: t('narrator.sync.rule'),
      why: t('narrator.sync.why'),
    });
    render();
    return;
  }

  if (state.phase === 'task') {
    if (state.task.length > 0) {
      const action = state.task.shift();
      setNarrator({
        now: t('msg.step.queue.task', { action: action.label ?? 'task()' }),
        rule: t('narrator.task.rule'),
        why: t('narrator.task.why'),
      });
      state.pending = { phase: 'task', action, stage: 'enter' };
      render();
      return;
    }
    state.phase = 'checkpoint';
    render();
  }
}

$('step').addEventListener('click', () => step());

$('reset').addEventListener('click', () => {
  stopAuto();
  resetState(true);
  if (state.mode === 'custom') {
    setNarrator({
      now: t('msg.resetCustom'),
      rule: t('narrator.sync.rule'),
      why: t('narrator.sync.why'),
    });
  } else {
    setNarrator({
      now: t('msg.resetToy'),
      rule: t('narrator.sync.rule'),
      why: t('narrator.sync.why'),
    });
  }
});

$('auto').addEventListener('click', () => {
  if (state.autoTimer) {
    stopAuto();
    return;
  }
  const ms = Number($('speed').value);
  state.autoTimer = setInterval(() => {
    if (state.phase === 'done') stopAuto();
    else step();
  }, ms);
  $('auto').textContent = t('ui.stop');
});

$('speed').addEventListener('input', () => {
  if (state.autoTimer) {
    stopAuto();
    $('auto').click();
  }
});

function setCodeMode(mode) {
  state.mode = mode;
  const isToy = mode === 'toy';
  stopAuto();
  $('toyPanel').style.display = isToy ? '' : 'none';
  $('customPanel').style.display = isToy ? 'none' : '';
  resetState(false);
  setNarrator({
    now: isToy ? t('msg.modeToy') : t('msg.modeCustom'),
    rule: t('narrator.sync.rule'),
    why: t('narrator.sync.why'),
  });
}

$('codeMode').addEventListener('change', () => {
  setCodeMode($('codeMode').value);
});

$('analyzeBtn').addEventListener('click', analyzeCode);

langToggle.addEventListener('click', async () => {
  const next = getLanguage() === 'el' ? 'en' : 'el';
  await setLanguage(next);
  loadPresets();
  maybeSetDefaultToyCode();
  maybeSetCustomSample();
  applyI18n();
  updateLangButton();
  render();
  if (state.autoTimer) $('auto').textContent = t('ui.stop');
  if (state.mode === 'toy' && !state.program.length) {
    setCompileInfo(t('msg.compileStart'));
  }
});

(async function init() {
  await initI18n('el');
  applyI18n();
  loadPresets();
  maybeSetDefaultToyCode();
  maybeSetCustomSample();
  setCompileInfo(t('msg.compileStart'));
  render();
  updateLangButton();
  setCodeMode('toy');
})();
