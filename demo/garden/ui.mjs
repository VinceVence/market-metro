export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const currency = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});
const number = new Intl.NumberFormat('en-US');
export const money = cents => currency.format((cents || 0) / 100);
export const num = value => number.format(Number(value || 0));
export const pct = value => Number.isFinite(value) ? (value * 100).toFixed(1) + '%' : '—';

export async function api(path, input, options = {}) {
  const response = await fetch(path, input === undefined ? options : {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Supply-Yard': 'sandbox'},
    body: JSON.stringify(input)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Local request failed.');
  return result;
}

export function simulationTime(frame){
  if(!frame?.simTime)return 'Day '+(frame?.tick||0);
  const t=frame.simTime;
  return 'Day '+t.day+' · '+(t.complete?'Complete':String(t.hour).padStart(2,'0')+':00');
}
