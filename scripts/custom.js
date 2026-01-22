import { state } from './state.js';
import { $ } from './dom.js';
import { render } from './render.js';
import { narratorSync, narratorCheckpoint, narratorTask, setNarrator } from './narrator.js';
import { resetState, stopAuto } from './ui.js';
import { t } from './i18n.js';

const CUSTOM_CAPTURE_TIMEOUT_MS = 2500;

function setStackFrame(label) {
  state.stack = label ? [label] : [];
}

function removeById(list, id) {
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0) list.splice(idx, 1);
}

function narratorForPhase(phase, msg) {
  if (phase === 'micro') narratorCheckpoint(msg);
  else if (phase === 'task') narratorTask(msg);
  else narratorSync(msg);
}

function applyCustomEvent(ev) {
  if (ev.type === 'schedule_micro') {
    state.micro.push({ label: ev.label, id: ev.id });
    setStackFrame(null);
    narratorForPhase(ev.phase, t('custom.scheduleMicro', { label: ev.label }));
  } else if (ev.type === 'schedule_task') {
    state.task.push({ label: ev.label, id: ev.id });
    setStackFrame(null);
    narratorForPhase(ev.phase, t('custom.scheduleTask', { label: ev.label }));
  } else if (ev.type === 'run_micro') {
    removeById(state.micro, ev.id);
    setStackFrame(ev.label);
    narratorCheckpoint(t('custom.runMicro', { label: ev.label }));
  } else if (ev.type === 'run_task') {
    removeById(state.task, ev.id);
    setStackFrame(ev.label);
    narratorTask(t('custom.runTask', { label: ev.label }));
  } else if (ev.type === 'log') {
    state.console.push(ev.text);
    const msg = t('custom.consoleLog', { text: ev.text });
    if (ev.phase === 'micro') narratorCheckpoint(msg);
    else if (ev.phase === 'task') narratorTask(msg);
    else narratorSync(msg);
  } else if (ev.type === 'warning') {
    state.console.push(t('custom.warning', { text: ev.text }));
    narratorSync(ev.text);
  }
}

export async function stepCustom() {
  if (state.phase === 'done') return;
  if (!state.customTimeline.length) {
    await runCustomCode();
    if (!state.customTimeline.length) return;
  }

  state.step++;
  $('stepBadge').textContent = t('ui.stepBadge', { step: state.step });

  if (state.customIndex >= state.customTimeline.length) {
    state.phase = 'done';
    setNarrator({
      now: t('msg.customDone'),
      rule: t('narrator.sync.rule'),
      why: t('narrator.sync.why'),
    });
    render();
    return;
  }

  const ev = state.customTimeline[state.customIndex++];
  applyCustomEvent(ev);
  render();
}

export function captureCustomTimeline(source) {
  return new Promise((resolve) => {
    const timeline = [];
    let microId = 0;
    let taskId = 0;
    let pending = 0;
    let doneRequested = false;
    let currentPhase = 'sync';
    let captureActive = true;
    const startMs = Date.now();
    const NativePromise = Promise;

    const record = (type, data = {}) => {
      if (!captureActive) return;
      timeline.push({ type, ...data });
    };

    const recordLog = (text, phase = currentPhase) => {
      record('log', { text, phase });
    };

    const schedulePending = () => {
      pending += 1;
    };

    const completePending = () => {
      pending = Math.max(0, pending - 1);
      checkDone();
    };

    const makeMicroCallback = (cb, label, id) => (...args) => {
      const prev = currentPhase;
      currentPhase = 'micro';
      record('run_micro', { id, label });
      try {
        if (typeof cb === 'function') return cb(...args);
      } catch (e) {
        recordLog(`ERROR: ${e && e.message ? e.message : String(e)}`, 'micro');
        throw e;
      } finally {
        currentPhase = prev;
        completePending();
      }
    };

    const wrappedQueueMicrotask = (cb) => {
      const id = ++microId;
      const label = `queueMicrotask#${id}`;
      record('schedule_micro', { id, label, phase: currentPhase, source: 'queueMicrotask' });
      schedulePending();
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(makeMicroCallback(cb, label, id));
      } else {
        NativePromise.resolve().then(makeMicroCallback(cb, label, id));
      }
    };

    const wrapPromise = (p) => {
      if (!p || p.__wrappedPromise) return p;
      Object.defineProperty(p, '__wrappedPromise', { value: true });
      const origThen = p.then.bind(p);
      const origCatch = p.catch ? p.catch.bind(p) : null;
      const origFinally = p.finally ? p.finally.bind(p) : null;

      p.then = (onFulfilled, onRejected) => {
        const id = ++microId;
        const label = `Promise.then#${id}`;
        record('schedule_micro', { id, label, phase: currentPhase, source: 'Promise.then' });
        schedulePending();
        const next = origThen(
          makeMicroCallback(onFulfilled, label, id),
          makeMicroCallback(onRejected, label, id),
        );
        return wrapPromise(next);
      };

      if (origCatch) {
        p.catch = (onRejected) => p.then(null, onRejected);
      }

      if (origFinally) {
        p.finally = (onFinally) => {
          const id = ++microId;
          const label = `Promise.finally#${id}`;
          record('schedule_micro', { id, label, phase: currentPhase, source: 'Promise.finally' });
          schedulePending();
          const next = origFinally(makeMicroCallback(onFinally, label, id));
          return wrapPromise(next);
        };
      }

      return p;
    };

    const PromiseWrapper = function (executor) {
      return wrapPromise(new NativePromise(executor));
    };
    PromiseWrapper.resolve = (value) => wrapPromise(NativePromise.resolve(value));
    PromiseWrapper.reject = (err) => wrapPromise(NativePromise.reject(err));
    PromiseWrapper.all = (iter) => wrapPromise(NativePromise.all(iter));
    PromiseWrapper.race = (iter) => wrapPromise(NativePromise.race(iter));
    if (NativePromise.allSettled)
      PromiseWrapper.allSettled = (iter) => wrapPromise(NativePromise.allSettled(iter));
    if (NativePromise.any) PromiseWrapper.any = (iter) => wrapPromise(NativePromise.any(iter));
    PromiseWrapper.prototype = NativePromise.prototype;

    const wrappedSetTimeout = (cb, delay, ...args) => {
      const id = ++taskId;
      const ms = Number(delay) || 0;
      const label = `setTimeout(${ms}ms)#${id}`;
      record('schedule_task', { id, label, phase: currentPhase, source: 'setTimeout' });
      schedulePending();
      return setTimeout(() => {
        const prev = currentPhase;
        currentPhase = 'task';
        record('run_task', { id, label });
        try {
          if (typeof cb === 'function') cb(...args);
        } catch (e) {
          recordLog(`ERROR: ${e && e.message ? e.message : String(e)}`, 'task');
        } finally {
          currentPhase = prev;
          completePending();
        }
      }, ms);
    };

    const setImmediatePoly = (cb, ...args) => wrappedSetTimeout(cb, 0, ...args);

    const customConsole = {
      log: (...args) => recordLog(args.join(' ')),
      error: (...args) => recordLog('ERROR: ' + args.join(' ')),
      warn: (...args) => recordLog('WARN: ' + args.join(' ')),
    };

    const originalPromise = globalThis.Promise;
    globalThis.Promise = PromiseWrapper;

    try {
      const fn = new Function(
        'console',
        'setTimeout',
        'queueMicrotask',
        'Promise',
        'setImmediate',
        source,
      );
      fn(
        customConsole,
        wrappedSetTimeout,
        wrappedQueueMicrotask,
        PromiseWrapper,
        typeof setImmediate === 'function' ? setImmediate : setImmediatePoly,
      );
    } catch (e) {
      recordLog(`ERROR: ${e && e.message ? e.message : String(e)}`);
    }

    doneRequested = true;

    function finalize() {
      captureActive = false;
      globalThis.Promise = originalPromise;
      resolve(timeline);
    }

    function checkDone() {
      if (!doneRequested) return;
      if (pending === 0) {
        finalize();
        return;
      }
      if (Date.now() - startMs > CUSTOM_CAPTURE_TIMEOUT_MS) {
        record('warning', { text: t('msg.customCaptureWarn') });
        finalize();
        return;
      }
      setTimeout(checkDone, 10);
    }

    checkDone();
  });
}

export async function runCustomCode() {
  if (state.customCapturing) return;
  stopAuto();
  state.customCapturing = true;
  setNarrator({
    now: t('msg.customCaptureStart'),
    rule: t('msg.customCaptureRule'),
    why: t('msg.customCaptureWhy'),
  });

  const source = $('customCode').value;
  const timeline = await captureCustomTimeline(source);
  state.customTimeline = timeline;
  state.customIndex = 0;
  resetState(true);
  setNarrator({
    now: t('msg.customCaptureDone', { count: timeline.length }),
    rule: t('narrator.sync.rule'),
    why: t('narrator.sync.why'),
  });
  state.customCapturing = false;
}
