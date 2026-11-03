"""Plot the recorded pilot; never runs simulations or providers."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.font_manager import fontManager, FontProperties
root = Path(__file__).resolve().parents[2]
folder = root / 'docs/commerce-room/confirmation-2026-10-31'
report = json.loads((folder / 'results.json').read_text())
font_file = root / 'demo/assets/fonts/dm-sans-400.ttf'
if font_file.exists():
    fontManager.addfont(str(font_file))
    plt.rcParams['font.family'] = FontProperties(fname=str(font_file)).get_name()
plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False, 'axes.spines.left': False, 'axes.edgecolor': '#c2ccd7', 'text.color': '#132c4f', 'axes.labelcolor': '#132c4f', 'xtick.color': '#526780', 'ytick.color': '#132c4f'})
rows = report['rows']
labels = [x['scenario'].replace('_', ' ').capitalize() for x in rows]
fig, axs = plt.subplots(1, 2, figsize=(11, 4.8), sharey=True)
for ax, key, title in zip(axs, ['platformVsFixed', 'platformVsNone'], ['Versus development-selected fixed campaign', 'Versus no post-warmup campaign']):
    values = [x[key] for x in rows]
    ax.barh(range(len(rows)), values, height=.52, color=['#0070e0' if v >= 0 else '#b66143' for v in values], zorder=3)
    extent = max(5, max(abs(v) for v in values) * 1.28)
    ax.set_xlim(min(-extent, min(values)*1.3), extent)
    ax.axvline(0, color='#72879c', lw=1)
    ax.set_yticks(range(len(rows)), labels)
    ax.set_title(title, fontsize=11, pad=16, loc='left')
    ax.set_xlabel('Difference in modeled platform contribution (USD)')
    ax.grid(axis='x', color='#e6edf4', zorder=0)
    ax.tick_params(axis='y', length=0)
    for i,v in enumerate(values):
        ax.text(v + (extent*.025 if v >= 0 else -extent*.025), i, f'{v:+.2f}', va='center', ha='left' if v >= 0 else 'right', fontsize=10)
axs[0].invert_yaxis()
fig.suptitle('Fresh commerce-team decisions · four-market pilot', x=.045, ha='left', fontsize=16, weight='bold')
fig.text(.045, .88, f"Fixed baseline: {report['baseline']}  |  {report['providerCalls']} provider calls  |  ${report['modelCostUSD']:.4f} model usage", fontsize=10)
fig.text(.045, .04, 'Authored simulation; 100 shoppers per case. AI costs included. Four cases do not establish population-level gains.\nNo native payments. Decision time is held constant across branches.', fontsize=9, color='#617286')
fig.subplots_adjust(left=.15, right=.97, top=.78, bottom=.23, wspace=.30)
fig.savefig(folder/'comparison.png', dpi=180, bbox_inches='tight')
