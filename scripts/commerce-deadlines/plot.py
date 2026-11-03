import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
r=json.loads(Path('demo/data/deadline-headroom.json').read_text());f=r['reference']['mean']['platformUSD'];j=r['joint']['mean']['platformUSD'];b=r['bound']['meanUSD']
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.spines.top':False,'axes.spines.right':False,'figure.facecolor':'#f4f8fc','axes.facecolor':'#f4f8fc'})
fig,ax=plt.subplots(figsize=(10,5.8),layout='constrained');bars=ax.bar(['Strongest fixed\nmeasured','Joint planner\nmeasured','Optimistic ceiling\nNOT a policy'],[f,j,b],color=['#8295b0','#0070e0','#e7f0fa'],edgecolor=['#8295b0','#0070e0','#416c98'],width=.58);bars[2].set_hatch('///')
for i,v in enumerate([f,j,b]):ax.text(i,v+45,f'${v:,.2f}',ha='center',weight='bold')
ax.axhline(2*f,color='#b64850',linestyle='--',linewidth=1.6);ax.text(.02,2*f+45,f'2× target: ${2*f:,.2f}',transform=ax.get_yaxis_transform(),color='#a13c45')
ax.set(title='Deadline commerce · financial headroom audit',ylabel='Mean modeled platform contribution (USD)',ylim=(0,2*f*1.18));ax.grid(axis='y',alpha=.15);ax.set_axisbelow(True)
fig.supxlabel('Six frozen development markets; all monetary values are authored simulation results.\nThe ceiling uses perfect future information and relaxes operational restrictions. No new LLM or native payment calls.',fontsize=9,color='#52637a')
fig.savefig('demo/data/deadline-headroom.png',dpi=170);fig.savefig('docs/commerce-deadlines/headroom-bound-2/comparison.pdf');plt.close(fig)
