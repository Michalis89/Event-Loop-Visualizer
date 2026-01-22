import { $ } from './dom.js';
import { renderAnalysis } from './render.js';
import { state } from './state.js';
import { compile } from './toy.js';
import { captureCustomTimeline } from './custom.js';
import { t } from './i18n.js';

export async function analyzeCode() {
  const analysisType = $('analysisType').value;
  const panel = $('analysisPanel');
  const output = $('analysisOutput');
  const source = state.mode === 'custom' ? $('customCode').value : $('code').value;

  if (!source.trim()) {
    output.innerHTML = `<div class="line muted">${t('msg.analysisEmpty')}</div>`;
    panel.style.display = 'block';
    return;
  }

  if (state.mode === 'custom') {
    output.innerHTML = `<div class="line muted">${t('msg.customAnalyzing')}</div>`;
    panel.style.display = 'block';
    const timeline = await captureCustomTimeline(source);
    let analysis = [];

    if (analysisType === 'execution') {
      analysis = analyzeCustomExecution(timeline);
    } else if (analysisType === 'queues') {
      analysis = analyzeCustomQueues(timeline);
    } else if (analysisType === 'stack') {
      analysis = analyzeCustomStack(timeline);
    } else if (analysisType === 'detailed') {
      analysis = analyzeCustomDetailed(timeline);
    }

    renderAnalysis(output, analysis);
    panel.style.display = 'block';
    return;
  }

  try {
    const program = compile(source);
    let analysis = [];

    if (analysisType === 'execution') {
      analysis = analyzeExecution(program);
    } else if (analysisType === 'queues') {
      analysis = analyzeQueues(program);
    } else if (analysisType === 'stack') {
      analysis = analyzeStack(program);
    } else if (analysisType === 'detailed') {
      analysis = analyzeDetailed(program);
    }

    renderAnalysis(output, analysis);
    panel.style.display = 'block';
  } catch (e) {
    output.innerHTML = `<div class="line" style="color: #ff8080;">${t('msg.error', {
      error: String(e.message || e),
    })}</div>`;
    panel.style.display = 'block';
  }
}

function analyzeExecution(program) {
  const steps = [];
  let stepNum = 0;

  steps.push({ type: 'info', text: t('analysis.exec.title') });
  steps.push({ type: 'info', text: t('analysis.exec.divider') });
  steps.push({ type: 'phase', text: t('analysis.exec.syncPhase') });

  for (let i = 0; i < program.length; i++) {
    const action = program[i];
    stepNum++;

    if (action.type === 'log') {
      steps.push({
        type: 'step',
        text: t('analysis.exec.step.log', { step: stepNum, text: action.text }),
      });
    } else if (action.type === 'then') {
      steps.push({
        type: 'step',
        text: t('analysis.exec.step.then', { step: stepNum, text: action.text }),
      });
    } else if (action.type === 'timeout') {
      steps.push({
        type: 'step',
        text: t('analysis.exec.step.timeout', { step: stepNum, text: action.text }),
      });
    } else if (action.type === 'await') {
      steps.push({
        type: 'step',
        text: t('analysis.exec.step.await', { step: stepNum, text: action.text }),
      });
    } else if (action.type === 'async_block') {
      const hasAwait = action.body.some((x) => x.type === 'await');
      steps.push({
        type: 'step',
        text: t('analysis.exec.step.async', {
          step: stepNum,
          detail: t(hasAwait ? 'analysis.exec.async.hasAwait' : 'analysis.exec.async.allSync'),
        }),
      });
    }
  }

  steps.push({
    type: 'phase',
    text: t('analysis.exec.microCheckpoint'),
  });
  steps.push({
    type: 'info',
    text: t('analysis.exec.microNote'),
  });

  steps.push({ type: 'phase', text: t('analysis.exec.taskPhase') });
  steps.push({
    type: 'info',
    text: t('analysis.exec.taskNote'),
  });

  steps.push({ type: 'info', text: '' });
  steps.push({ type: 'rule', text: t('analysis.exec.rule') });

  return steps;
}

function analyzeQueues(program) {
  const steps = [];
  const micro = [];
  const task = [];

  steps.push({ type: 'info', text: t('analysis.queues.title') });
  steps.push({ type: 'info', text: t('analysis.queues.divider') });

  for (const action of program) {
    if (action.type === 'then') {
      micro.push(`Promise.then("${action.text}")`);
    } else if (action.type === 'timeout') {
      task.push(`setTimeout("${action.text}")`);
    } else if (action.type === 'await') {
      micro.push(`await("${action.text}")`);
    } else if (action.type === 'async_block') {
      const body = action.body || [];
      const idx = body.findIndex((x) => x.type === 'await');
      if (idx !== -1) {
        micro.push(t('analysis.queues.asyncCont', { count: body.length - idx - 1 }));
      }
    }
  }

  steps.push({ type: 'subtitle', text: t('analysis.queues.microTitle') });
  if (micro.length === 0) {
    steps.push({ type: 'info', text: t('analysis.queues.empty') });
  } else {
    micro.forEach((m, i) => {
      steps.push({ type: 'queue', text: `  [${i + 1}] ${m}` });
    });
  }

  steps.push({ type: 'info', text: '' });
  steps.push({ type: 'subtitle', text: t('analysis.queues.taskTitle') });
  if (task.length === 0) {
    steps.push({ type: 'info', text: t('analysis.queues.empty') });
  } else {
    task.forEach((tItem, i) => {
      steps.push({ type: 'queue', text: `  [${i + 1}] ${tItem}` });
    });
  }

  steps.push({ type: 'info', text: '' });
  steps.push({
    type: 'rule',
    text: t('analysis.queues.summary', { micro: micro.length, task: task.length }),
  });

  return steps;
}

function analyzeStack(program) {
  const steps = [];
  let depth = 0;

  steps.push({ type: 'info', text: t('analysis.stack.title') });
  steps.push({ type: 'info', text: t('analysis.stack.divider') });
  steps.push({ type: 'phase', text: t('analysis.stack.syncPhase') });

  for (const action of program) {
    depth++;
    const indent = '  '.repeat(depth);

    if (action.type === 'log') {
      steps.push({ type: 'stack', text: `${indent}${t('analysis.stack.log', { text: action.text })}` });
    } else if (action.type === 'then') {
      steps.push({
        type: 'stack',
        text: `${indent}${t('analysis.stack.then', { text: action.text })}`,
      });
    } else if (action.type === 'timeout') {
      steps.push({
        type: 'stack',
        text: `${indent}${t('analysis.stack.timeout', { text: action.text })}`,
      });
    } else if (action.type === 'await') {
      steps.push({
        type: 'stack',
        text: `${indent}${t('analysis.stack.await', { text: action.text })}`,
      });
    } else if (action.type === 'async_block') {
      steps.push({ type: 'stack', text: `${indent}${t('analysis.stack.asyncStart')}` });
      const body = action.body || [];
      const idx = body.findIndex((x) => x.type === 'await');
      if (idx === -1) {
        steps.push({ type: 'stack', text: `${indent}    ${t('analysis.stack.asyncAllSync')}` });
      } else {
        steps.push({ type: 'stack', text: `${indent}    ${t('analysis.stack.asyncWithAwait')}` });
      }
      steps.push({ type: 'stack', text: `${indent}${t('analysis.stack.asyncEnd')}` });
    }

    depth--;
  }

  steps.push({ type: 'info', text: '' });
  steps.push({ type: 'rule', text: t('analysis.stack.rule') });

  return steps;
}

function analyzeDetailed(program) {
  const steps = [];
  const results = {
    syncActions: [],
    microtasks: [],
    tasks: [],
    totalSteps: 0,
  };

  let stepCounter = 0;

  steps.push({ type: 'info', text: t('analysis.detail.title') });
  steps.push({ type: 'info', text: t('analysis.detail.divider') });

  for (let i = 0; i < program.length; i++) {
    const action = program[i];
    stepCounter++;

    if (action.type === 'log') {
      results.syncActions.push(`log("${action.text}")`);
      steps.push({
        type: 'detail',
        text: t('analysis.detail.line.log', { line: i + 1, text: action.text }),
      });
      steps.push({ type: 'explanation', text: t('analysis.detail.explain.sync') });
    } else if (action.type === 'then') {
      results.microtasks.push(`Promise.then("${action.text}")`);
      steps.push({
        type: 'detail',
        text: t('analysis.detail.line.then', { line: i + 1, text: action.text }),
      });
      steps.push({ type: 'explanation', text: t('analysis.detail.explain.micro') });
    } else if (action.type === 'timeout') {
      results.tasks.push(`setTimeout("${action.text}")`);
      steps.push({
        type: 'detail',
        text: t('analysis.detail.line.timeout', { line: i + 1, text: action.text }),
      });
      steps.push({ type: 'explanation', text: t('analysis.detail.explain.task') });
    } else if (action.type === 'await') {
      results.microtasks.push(`await("${action.text}")`);
      steps.push({
        type: 'detail',
        text: t('analysis.detail.line.await', { line: i + 1, text: action.text }),
      });
      steps.push({ type: 'explanation', text: t('analysis.detail.explain.await') });
    } else if (action.type === 'async_block') {
      steps.push({
        type: 'detail',
        text: t('analysis.detail.line.async', { line: i + 1 }),
      });
      const body = action.body || [];
      const idx = body.findIndex((x) => x.type === 'await');
      if (idx === -1) {
        steps.push({ type: 'explanation', text: t('analysis.detail.explain.asyncAllSync') });
      } else {
        steps.push({ type: 'explanation', text: t('analysis.detail.explain.asyncHasAwait') });
        results.microtasks.push(`async/await continuation (${body.length - idx - 1} actions)`);
      }
    }
  }

  steps.push({ type: 'info', text: '' });
  steps.push({ type: 'summary', text: t('analysis.detail.summary') });
  steps.push({
    type: 'summary',
    text: t('analysis.detail.summary.sync', { count: results.syncActions.length }),
  });
  steps.push({
    type: 'summary',
    text: t('analysis.detail.summary.micro', { count: results.microtasks.length }),
  });
  steps.push({
    type: 'summary',
    text: t('analysis.detail.summary.task', { count: results.tasks.length }),
  });

  steps.push({ type: 'info', text: '' });
  steps.push({ type: 'rule', text: t('analysis.detail.rule') });

  return steps;
}

function analyzeCustomExecution(timeline) {
  const steps = [];
  let stepNum = 0;

  steps.push({ type: 'info', text: t('analysis.custom.title') });
  steps.push({ type: 'info', text: t('analysis.custom.divider') });

  timeline.forEach((ev) => {
    stepNum++;
    if (ev.type === 'log') {
      const phaseLabel = t(`phase.${ev.phase}`) || ev.phase;
      steps.push({
        type: 'step',
        text: t('analysis.custom.step.log', { step: stepNum, text: ev.text, phase: phaseLabel }),
      });
    } else if (ev.type === 'schedule_micro') {
      steps.push({
        type: 'step',
        text: t('analysis.custom.step.scheduleMicro', { step: stepNum, label: ev.label }),
      });
    } else if (ev.type === 'run_micro') {
      steps.push({
        type: 'step',
        text: t('analysis.custom.step.runMicro', { step: stepNum, label: ev.label }),
      });
    } else if (ev.type === 'schedule_task') {
      steps.push({
        type: 'step',
        text: t('analysis.custom.step.scheduleTask', { step: stepNum, label: ev.label }),
      });
    } else if (ev.type === 'run_task') {
      steps.push({
        type: 'step',
        text: t('analysis.custom.step.runTask', { step: stepNum, label: ev.label }),
      });
    } else if (ev.type === 'warning') {
      steps.push({ type: 'rule', text: `⚠️  ${ev.text}` });
    }
  });

  steps.push({ type: 'info', text: '' });
  steps.push({ type: 'rule', text: t('analysis.custom.rule') });

  return steps;
}

function analyzeCustomQueues(timeline) {
  const steps = [];
  const micro = [];
  const task = [];

  steps.push({ type: 'info', text: t('analysis.customQueues.title') });
  steps.push({ type: 'info', text: t('analysis.customQueues.divider') });

  timeline.forEach((ev) => {
    if (ev.type === 'schedule_micro') micro.push(ev.label);
    if (ev.type === 'schedule_task') task.push(ev.label);
  });

  steps.push({ type: 'subtitle', text: t('analysis.queues.microTitle') });
  if (!micro.length) steps.push({ type: 'info', text: t('analysis.queues.empty') });
  else micro.forEach((m, i) => steps.push({ type: 'queue', text: `  [${i + 1}] ${m}` }));

  steps.push({ type: 'info', text: '' });
  steps.push({ type: 'subtitle', text: t('analysis.queues.taskTitle') });
  if (!task.length) steps.push({ type: 'info', text: t('analysis.queues.empty') });
  else task.forEach((tItem, i) => steps.push({ type: 'queue', text: `  [${i + 1}] ${tItem}` }));

  steps.push({ type: 'info', text: '' });
  steps.push({
    type: 'rule',
    text: t('analysis.queues.summary', { micro: micro.length, task: task.length }),
  });

  return steps;
}

function analyzeCustomStack(timeline) {
  const steps = [];

  steps.push({ type: 'info', text: t('analysis.customStack.title') });
  steps.push({ type: 'info', text: t('analysis.customStack.divider') });

  timeline.forEach((ev) => {
    if (ev.type === 'run_micro') {
      steps.push({ type: 'stack', text: `  ${t('analysis.customStack.micro', { label: ev.label })}` });
    } else if (ev.type === 'run_task') {
      steps.push({ type: 'stack', text: `  ${t('analysis.customStack.task', { label: ev.label })}` });
    } else if (ev.type === 'log') {
      const phaseLabel = t(`phase.${ev.phase}`) || ev.phase;
      steps.push({
        type: 'stack',
        text: `  ${t('analysis.customStack.log', { phase: phaseLabel, text: ev.text })}`,
      });
    }
  });

  steps.push({ type: 'info', text: '' });
  steps.push({ type: 'rule', text: t('analysis.customStack.rule') });

  return steps;
}

function analyzeCustomDetailed(timeline) {
  const steps = [];
  let logs = 0;
  let micros = 0;
  let tasks = 0;

  steps.push({ type: 'info', text: t('analysis.customDetail.title') });
  steps.push({ type: 'info', text: t('analysis.customDetail.divider') });

  timeline.forEach((ev, idx) => {
    const stepNum = idx + 1;
    if (ev.type === 'log') {
      logs++;
      const phaseLabel = t(`phase.${ev.phase}`) || ev.phase;
      steps.push({
        type: 'detail',
        text: t('analysis.custom.step.log', { step: stepNum, text: ev.text, phase: phaseLabel }),
      });
    } else if (ev.type === 'schedule_micro') {
      micros++;
      steps.push({
        type: 'detail',
        text: t('analysis.custom.step.scheduleMicro', { step: stepNum, label: ev.label }),
      });
    } else if (ev.type === 'schedule_task') {
      tasks++;
      steps.push({
        type: 'detail',
        text: t('analysis.custom.step.scheduleTask', { step: stepNum, label: ev.label }),
      });
    } else if (ev.type === 'run_micro') {
      steps.push({ type: 'explanation', text: `  ✓ ${t('custom.runMicro', { label: ev.label })}` });
    } else if (ev.type === 'run_task') {
      steps.push({ type: 'explanation', text: `  ✓ ${t('custom.runTask', { label: ev.label })}` });
    }
  });

  steps.push({ type: 'info', text: '' });
  steps.push({ type: 'summary', text: t('analysis.customDetail.summary') });
  steps.push({
    type: 'summary',
    text: t('analysis.customDetail.summary.logs', { count: logs }),
  });
  steps.push({
    type: 'summary',
    text: t('analysis.customDetail.summary.micros', { count: micros }),
  });
  steps.push({
    type: 'summary',
    text: t('analysis.customDetail.summary.tasks', { count: tasks }),
  });
  steps.push({ type: 'info', text: '' });
  steps.push({ type: 'rule', text: t('analysis.customDetail.rule') });

  return steps;
}
