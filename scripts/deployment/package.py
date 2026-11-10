"""Create a deployment context from tracked runtime files; never include local secrets."""
import hashlib, json, subprocess, tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.local/release-audit';OUT.mkdir(parents=True,exist_ok=True)
files=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT,text=True).split('\0')
allowed=[]
for name in files:
    if not name:continue
    path=Path(name)
    if not (name.startswith(('demo/','scripts/','benchmark/','docs/')) or name in ['package.json','package-lock.json','Dockerfile','.dockerignore']):continue
    if name.startswith(('docs/screenshots/','docs/presentations/','scripts/deployment/')):continue
    if any(p.startswith('.') for p in path.parts) and name!='.dockerignore':continue
    if path.suffix.lower() in ['.pem','.key','.db','.sqlite','.pyc']:raise RuntimeError('Private path in tracked runtime files: '+name)
    if (ROOT/path).is_file():allowed.append(name)
for required in ['Dockerfile','.dockerignore','scripts/public-demo.mjs']:
    if required not in allowed:raise RuntimeError('Commit the release files before packaging: '+required)
archive=OUT/'source.tar.gz'
with tarfile.open(archive,'w:gz',compresslevel=3) as target:
    for name in sorted(allowed):target.add(ROOT/name,arcname=name)
manifest={'files':len(allowed),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'bytes':archive.stat().st_size,
          'gitCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
          'excluded':['.env','.local','.git','video','research','untracked files','screenshots','deployment credentials']}
(OUT/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest))
