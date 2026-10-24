import {api} from './ui.mjs';

// A single controller owns both settings entry points and the start request.
export function mountSimulationSettings({onStart, onLegacy, onVisibility}) {
  const dialog = document.getElementById('simulation-dialog');
  const form = dialog.querySelector('form');
  const field = name => form.elements.namedItem(name);
  const status = document.getElementById('sim-status');
  const start = document.getElementById('sim-start');
  let requestId = null;
  let starting = false;
  let demo = false;

  function close() {
    if (starting) return;
    dialog.close();
  }

  function updateMode() {
    const paid = field('mode').value === 'gemini';
    start.textContent = paid ? 'Start '+(demo?'demo':'simulation')+' · max $0.25' : demo?'Start demo at Day 1':'Start simulation';
    document.getElementById('sim-cost').textContent = paid ? 'Gemini · $0.25 cap' : 'Local planner · $0 API';
  }

  form.addEventListener('input', () => {
    requestId = null;
    status.textContent = '';
    updateMode();
  });
  dialog.addEventListener('cancel', event => {
    if (starting) event.preventDefault();
  });
  dialog.addEventListener('close', () => onVisibility?.(false));
  for (const button of dialog.querySelectorAll('[data-dismiss-settings]')) button.onclick = close;
  document.getElementById('legacy-season').onclick = () => { close(); onLegacy(); };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (starting || !form.reportValidity()) return;
    const values = new FormData(form);
    const campaigns = values.getAll('campaign');
    if (!campaigns.length) {
      status.textContent = 'Select at least one campaign type.';
      return;
    }
    const input = {requestId: requestId ??= crypto.randomUUID(), campaigns,clockUnit:'hour'};
    for (const name of ['seed', 'customerCount', 'merchantCount', 'totalDays', 'hourMs', 'reviewEveryDays']) {
      input[name] = Number(values.get(name));
    }
    for (const name of ['mode', 'objective', 'scenario']) input[name] = values.get(name);
    input.budgetCents = Math.round(Number(values.get('budget')) * 100);
    starting = true;
    const controls = [...form.elements, ...dialog.querySelectorAll('[data-dismiss-settings]')];
    controls.forEach(control => control.disabled = true);
    status.textContent = 'Opening Day 1…';
    try {
      const run = await api('/api/market/live/start', input);
      sessionStorage.setItem('liveMarketRun', run.runId);
      dialog.close();
      await onStart(run.runId,{demo});
      requestId = null;
    } catch (error) {
      if(!dialog.open)dialog.showModal();
      status.textContent = error.message;
    } finally {
      starting = false;
      controls.forEach(control => control.disabled = false);
    }
  });

  return {
    close,
    open(frame,{judgeDemo=false}={}) {
      if (dialog.open) return;
      demo=judgeDemo;document.getElementById('simulation-title').textContent=demo?'Demo settings · Day 1':'Simulation settings';
      const settings = frame?.continuous?.settings;
      if (settings) {
        const values = {...settings, seed: frame.seed, mode: frame.continuous.mode, budget: settings.budgetCents / 100};
        for (const [name, value] of Object.entries(values)) {
          const control = field(name);
          if (control && !['campaigns', 'budgetCents'].includes(name)) control.value = String(value);
        }
        for (const checkbox of form.querySelectorAll('[name="campaign"]')) {
          checkbox.checked = settings.campaigns.includes(checkbox.value);
        }
      }
      field('hourMs').value=String(settings?.hourMs||250);field('mode').value='gemini';
      if(demo){field('seed').value='314';field('totalDays').value='100';field('hourMs').value='250';field('mode').value='gemini';}
      requestId = null;
      status.textContent = '';
      updateMode();
      onVisibility?.(true);
      dialog.showModal();
    }
  };
}
