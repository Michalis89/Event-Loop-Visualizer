import { state } from './state.js';
import { narratorSync, narratorCheckpoint, narratorTask, pushConsole } from './narrator.js';
import { render } from './render.js';
import { t } from './i18n.js';

export function compile(source) {
  const lines = source.split('\n');
  const program = [];
  let inAsyncBlock = false;
  let asyncBlock = [];

  const normalize = (s) => s.trim();

  for (const raw of lines) {
    const line = normalize(raw);
    if (!line) continue;
    if (line.startsWith('#')) continue;

    if (line.startsWith('async')) {
      if (line.includes('{')) {
        inAsyncBlock = true;
        asyncBlock = [];
        continue;
      }
    }
    if (inAsyncBlock && line === '}') {
      inAsyncBlock = false;
      program.push({ type: 'async_block', body: asyncBlock.slice() });
      asyncBlock = [];
      continue;
    }

    const target = inAsyncBlock ? asyncBlock : program;
    const m = line.match(/^(log|then|timeout|await)\("([^"]*)"\)\s*$/);
    if (m) {
      target.push({ type: m[1], text: m[2] });
    } else {
      const m2 = line.match(/^(log|then|timeout|await)\("([^"]*)"\)\s*;\s*$/);
      if (m2) target.push({ type: m2[1], text: m2[2] });
      else throw new Error(`Unsupported line: ${raw}`);
    }
  }

  return program;
}

export function execSyncAction(action) {
  if (action.type === 'log') {
    pushConsole(action.text);
    narratorSync(t('toy.sync.log', { text: action.text }));
  } else if (action.type === 'then') {
    state.micro.push({
      label: `Promise.then → log("${action.text}")`,
      kind: 'then',
      text: action.text,
    });
    narratorSync(t('toy.sync.then', { text: action.text }));
  } else if (action.type === 'timeout') {
    state.task.push({
      label: `setTimeout(0) → log("${action.text}")`,
      kind: 'timeout',
      text: action.text,
    });
    narratorSync(t('toy.sync.timeout', { text: action.text }));
  } else if (action.type === 'await') {
    state.micro.push({
      label: `await continuation → log("${action.text}")`,
      kind: 'await_cont',
      text: action.text,
    });
    narratorSync(t('toy.sync.await', { text: action.text }));
  } else if (action.type === 'async_block') {
    const body = action.body || [];
    const idx = body.findIndex((x) => x.type === 'await');
    if (idx === -1) {
      for (const x of body) execSyncAction(x);
      narratorSync(t('toy.sync.asyncNoAwait'));
    } else {
      for (let i = 0; i < idx; i++) execSyncAction(body[i]);
      const awaitAction = body[idx];
      const remaining = body.slice(idx + 1);
      state.micro.push({
        label: `async/await continuation → (${remaining.length} actions)`,
        kind: 'async_cont',
        text: awaitAction.text,
        remaining,
      });
      narratorSync(t('toy.sync.asyncAwait'));
    }
  }
}

export function execMicrotask(job) {
  if (job.kind === 'then' || job.kind === 'await_cont') {
    pushConsole(job.text);
    narratorCheckpoint(t('toy.micro.exec', { label: job.label }));
  } else if (job.kind === 'async_cont') {
    pushConsole(job.text);
    for (const act of job.remaining) {
      if (act.type === 'log') pushConsole(act.text);
      else if (act.type === 'then')
        state.micro.push({
          label: `Promise.then → log("${act.text}")`,
          kind: 'then',
          text: act.text,
        });
      else if (act.type === 'timeout')
        state.task.push({
          label: `setTimeout(0) → log("${act.text}")`,
          kind: 'timeout',
          text: act.text,
        });
      else if (act.type === 'await')
        state.micro.push({
          label: `await continuation → log("${act.text}")`,
          kind: 'await_cont',
          text: act.text,
        });
    }
    narratorCheckpoint(t('toy.micro.asyncCont'));
  }
}

export function execTask(job) {
  pushConsole(job.text);
  narratorTask(t('toy.task.exec', { label: job.label }));

  if (job.text === 'T1') {
    state.micro.push({
      label: 'Promise.then (inside T1) → log("M inside T1")',
      kind: 'then',
      text: 'M inside T1',
    });
    narratorTask(t('toy.task.microInside'));
  }
}

export function runOneSyncInstruction(action) {
  state.stack.push(action.type === 'async_block' ? 'async()' : action.type + '()');
  render();

  if (action.type === 'log') {
    pushConsole(action.text);
    narratorSync(t('toy.sync.log', { text: action.text }));
  } else if (action.type === 'then') {
    state.micro.push({
      label: `Promise.then → log("${action.text}")`,
      kind: 'then',
      text: action.text,
    });
    narratorSync(t('toy.sync.then', { text: action.text }));
  } else if (action.type === 'timeout') {
    state.task.push({
      label: `setTimeout(0) → log("${action.text}")`,
      kind: 'timeout',
      text: action.text,
    });
    narratorSync(t('toy.sync.timeout', { text: action.text }));
  } else if (action.type === 'await') {
    state.micro.push({
      label: `await continuation → log("${action.text}")`,
      kind: 'await_cont',
      text: action.text,
    });
    narratorSync(t('toy.sync.await', { text: action.text }));
  } else if (action.type === 'async_block') {
    const body = action.body || [];
    const idx = body.findIndex((x) => x.type === 'await');
    if (idx === -1) {
      body.forEach((x) => runOneSyncInstruction(x));
      narratorSync(t('toy.sync.asyncNoAwait'));
    } else {
      for (let i = 0; i < idx; i++) runOneSyncInstruction(body[i]);
      const awaitAction = body[idx];
      const remaining = body.slice(idx + 1);
      state.micro.push({
        label: `async/await continuation → (${remaining.length} actions)`,
        kind: 'async_cont',
        text: awaitAction.text,
        remaining,
      });
      narratorSync(t('toy.sync.asyncAwait'));
    }
  }

  state.stack.pop();
  render();
}
