"""Scientific figures from the complete frozen campaign-controller batch."""
from pathlib import Path
import json, os

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.local/matplotlib'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.colors import TwoSlopeNorm
import numpy as np

BASE = ROOT / 'docs/policy-lab/benchmarks/v5'
OUT = ROOT / 'docs/figures/campaign-controller'
OUT.mkdir(parents=True, exist_ok=True)
r = json.loads((BASE / 'validation-result.json').read_text())
for font in (ROOT / 'demo/assets/fonts').glob('*.ttf'):
    font_manager.fontManager.addfont(str(font))
plt.rcParams.update({'font.family': 'DM Sans', 'font.size': 11, 'svg.fonttype': 'path',
                     'text.parse_math': False, 'axes.spines.top': False,
                     'axes.spines.right': False, 'axes.spines.left': False,
                     'text.color': '#24424D', 'axes.labelcolor': '#24424D',
                     'xtick.color': '#526E79', 'ytick.color': '#526E79'})
names = {'organic': 'No outreach', 'static': 'Best static rule', 'riskStatic': 'Cautious static rule',
         'contextual': 'Contextual rules', 'riskContextual': 'Cautious contextual rules',
         'original': 'Original rules', 'llm': 'Gemini campaign controller',
         'firstChoice': 'Repeat Gemini’s first choice'}

def save(fig, name):
    for ext in ['svg', 'png', 'pdf']:
        fig.savefig(OUT / f'{name}.{ext}', dpi=180, bbox_inches='tight')
    svg = OUT / f'{name}.svg'
    svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines()) + '\n')
    plt.close(fig)

def heading(fig, title, subtitle):
    fig.text(.035, .97, title, fontsize=21, weight='bold', va='top')
    fig.text(.035, .895, subtitle, fontsize=10.5, va='top', color='#526E79')

fig, ax = plt.subplots(figsize=(13, 7))
fig.subplots_adjust(left=.29, right=.95, top=.78, bottom=.23)
heading(fig, 'A · Does campaign selection create modeled value?',
        f"Frozen validation · {len(r['cases'])} cases · 16 independent seeds × 5 authored conditions · accounted model cost included")
for i, stat in enumerate(r['stats']):
    s = stat['platform']; color = '#276B76' if stat['method'] == 'llm' else '#84968F'
    ax.errorbar(s['mean'], i, xerr=[[max(0, s['mean'] - s['low'])],
                                  [max(0, s['high'] - s['mean'])]],
                fmt='o', color=color, capsize=4, lw=2 if stat['method'] == 'llm' else 1.2)
ax.set_yticks(range(len(r['stats'])), [names[s['method']] for s in r['stats']])
ax.invert_yaxis(); ax.axvline(0, color='#71867F', ls='--', lw=1)
ax.grid(axis='x', alpha=.18); ax.set_xlabel('Incremental modeled platform contribution vs no outreach (USD per market)')
fig.text(.035, .055, '95% percentile intervals resample seed clusters; scenarios receive equal weight. No shopper-level pseudoreplication.\n'
         'Each market has 100 shoppers. Fees, behavior and returns are simulator assumptions; these are not actual PayPal profits.',
         fontsize=10, color='#526E79')
save(fig, 'campaign-comparisons')

seeds = sorted({c['seed'] for c in r['cases']})
conditions = ['steady', 'rival_sale', 'budget_squeeze', 'supply_delay', 'returns_wave']
matrix = np.array([[next(b['deltaPlatformUSD'] for c in r['cases']
                        if c['seed'] == seed and c['scenario'] == condition
                        for b in c['branches'] if b['method'] == 'llm')
                    for condition in conditions] for seed in seeds])
span = max(1, abs(matrix).max())
fig, ax = plt.subplots(figsize=(11, 10))
fig.subplots_adjust(left=.14, right=.88, top=.84, bottom=.16)
heading(fig, 'B · Every market, including losses',
        'Fresh Gemini decisions vs no outreach, after model costs · condition labels were hidden from the planner')
im = ax.imshow(matrix, cmap='BrBG', norm=TwoSlopeNorm(vmin=-span, vcenter=0, vmax=span), aspect='auto')
ax.set_xticks(range(5), ['Steady', 'Rival sale', 'Budget squeeze', 'Supply delay', 'Returns wave'])
ax.set_yticks(range(len(seeds)), seeds); ax.set_ylabel('Independent seed')
for y in range(len(seeds)):
    for x in range(5):
        failed = any(c['errors'] for c in r['cases'] if c['seed'] == seeds[y] and c['scenario'] == conditions[x])
        ax.text(x, y, f'{matrix[y, x]:+.2f}'+('*' if failed else ''), ha='center', va='center', fontsize=9,
                color='white' if abs(matrix[y, x]) > span * .53 else '#24424D')
fig.colorbar(im, ax=ax, fraction=.035, pad=.025, label='Modeled USD difference')
fig.text(.035, .045, 'Rows share a seed across all five conditions. They are clustered in uncertainty estimates.\n'
         'No losses are omitted or replaced. Results are conditional on this simulator, action library and finite horizon.\n'
         '* One timed-out day-30 request used the no-outreach fallback; its full $0.03 reservation remains charged.',
         fontsize=10, color='#526E79')
save(fig, 'campaign-seeds')

values = [np.mean([next(b['deltaVsFirstUSD'] for b in c['branches'] if b['method'] == 'llm')
                   for c in r['cases'] if c['seed'] == seed]) for seed in seeds]
fig, ax = plt.subplots(figsize=(13, 6.5))
fig.subplots_adjust(left=.10, right=.96, top=.77, bottom=.27)
heading(fig, 'C · Do later revisions earn their extra cost?',
        f"Mean revision effect: ${r['revisions']['mean']:+.3f} · 95% interval ${r['revisions']['low']:+.3f} to ${r['revisions']['high']:+.3f}")
ax.bar(range(len(seeds)), values, color=['#276B76' if value >= 0 else '#AB6B45' for value in values])
ax.axhline(0, color='#71867F', lw=1); ax.axhline(r['revisions']['mean'], color='#24424D', ls='--', lw=1, label='Mean across seed clusters')
ax.set_xticks(range(len(seeds)), [str(seed) for seed in seeds], rotation=45, ha='right')
ax.set_ylabel('USD vs repeating the first choice'); ax.set_xlabel('Independent seed (mean of five conditions)')
ax.grid(axis='y', alpha=.18); ax.legend(frameon=False, fontsize=9)
fig.text(.035, .045, 'Adaptive controller: reviews on days 30, 55 and 80. Ablation: repeats day-30 policy and pays only its first model call.\n'
         'Both use identical seeds, publication delays, tool authority and frozen accounting. This is an ablation, not a learning curve.',
         fontsize=10, color='#526E79')
save(fig, 'campaign-revisions')
print('Rendered complete validation comparisons, all cases, and revision ablation.')
