"""Deploy the isolated, credential-free judge demo using existing operator ADC.
No key is copied to the source archive, image, or runtime service account.
"""
import argparse, json, time
from pathlib import Path
import google.auth
from google.auth.transport.requests import AuthorizedSession

PROJECT = 'supply-yard-pilot-261021'
REGION = 'us-central1'
SERVICE = 'market-metro'
BASE = f'projects/{PROJECT}/locations/{REGION}'
BUCKET = PROJECT + '-market-metro-source'
BUILD_SA = f'market-metro-build@{PROJECT}.iam.gserviceaccount.com'
RUN_SA = f'market-metro-demo@{PROJECT}.iam.gserviceaccount.com'
STATE = Path('.local/release-audit')
config = json.loads(Path('.local/gcp/config.json').read_text())
assert config['projectId'] == PROJECT, 'Refusing to touch another project'
credentials, _ = google.auth.load_credentials_from_file(config['adcPath'],
    scopes=['https://www.googleapis.com/auth/cloud-platform'], quota_project_id=PROJECT)
client = AuthorizedSession(credentials)

def request(method, url, **kwargs):
    response = client.request(method, url, timeout=120, **kwargs)
    if not response.ok:
        try: message = response.json().get('error', {}).get('message', 'API request failed')
        except ValueError: message = 'API request failed'
        raise RuntimeError(f'{method} {response.status_code}: {message}')
    return response.json() if response.content else {}

def ensure(url, create_url, body):
    response = client.get(url, timeout=30)
    if response.status_code == 404: return request('POST', create_url, json=body)
    response.raise_for_status()
    return response.json()

def binding(url, member, role, storage=False):
    get_url = url if storage else url + ':getIamPolicy'
    policy = request('GET', get_url)
    bindings = policy.setdefault('bindings', [])
    row = next((b for b in bindings if b['role'] == role and not b.get('condition')), None)
    if row is None: row = {'role':role,'members':[]}; bindings.append(row)
    if member in row['members']: return
    row['members'].append(member)
    request('PUT' if storage else 'POST', url if storage else url + ':setIamPolicy',
            json=policy if storage else {'policy':policy})

def prepare():
    for account in ['market-metro-build','market-metro-demo']:
        ensure(f'https://iam.googleapis.com/v1/projects/{PROJECT}/serviceAccounts/{account}@{PROJECT}.iam.gserviceaccount.com',
               f'https://iam.googleapis.com/v1/projects/{PROJECT}/serviceAccounts',
               {'accountId':account,'serviceAccount':{'displayName':account}})
    ensure(f'https://storage.googleapis.com/storage/v1/b/{BUCKET}',
           f'https://storage.googleapis.com/storage/v1/b?project={PROJECT}',
           {'name':BUCKET,'location':REGION,'iamConfiguration':{'uniformBucketLevelAccess':{'enabled':True},'publicAccessPrevention':'enforced'},
            'lifecycle':{'rule':[{'action':{'type':'Delete'},'condition':{'age':7}}]}})
    repo=f'https://artifactregistry.googleapis.com/v1/{BASE}/repositories/market-metro'
    ensure(repo,f'https://artifactregistry.googleapis.com/v1/{BASE}/repositories?repositoryId=market-metro',
           {'format':'DOCKER','description':'Market Metro judge demo images'})
    # Repository creation can be asynchronous; wait for the actual resource.
    for _ in range(20):
        if client.get(repo,timeout=30).ok: break
        time.sleep(2)
    binding(repo,'serviceAccount:'+BUILD_SA,'roles/artifactregistry.writer')
    binding(f'https://storage.googleapis.com/storage/v1/b/{BUCKET}/iam','serviceAccount:'+BUILD_SA,'roles/storage.objectViewer',storage=True)
    crm=f'https://cloudresourcemanager.googleapis.com/v1/projects/{PROJECT}'
    # CRM uses POST even for reading project IAM policy.
    policy=request('POST',crm+':getIamPolicy',json={})
    bindings=policy.setdefault('bindings',[])
    if not any(b['role']=='roles/logging.logWriter' and 'serviceAccount:'+BUILD_SA in b['members'] for b in bindings):
        bindings.append({'role':'roles/logging.logWriter','members':['serviceAccount:'+BUILD_SA]})
        request('POST',crm+':setIamPolicy',json={'policy':policy})
    print(json.dumps({'prepared':PROJECT,'runtimeServiceAccount':RUN_SA,'runtimeProjectRolesGranted':0}),flush=True)

def build():
    manifest=json.loads((STATE/'source-manifest.json').read_text())
    source=STATE/'source.tar.gz'
    import hashlib
    assert hashlib.sha256(source.read_bytes()).hexdigest()==manifest['sha256']
    name='source-'+manifest['sha256'][:16]+'.tar.gz'
    with source.open('rb') as body:
        request('POST',f'https://storage.googleapis.com/upload/storage/v1/b/{BUCKET}/o?uploadType=media&name={name}',
                data=body,headers={'Content-Type':'application/gzip'})
    image=f'{REGION}-docker.pkg.dev/{PROJECT}/market-metro/demo:release-{manifest["sha256"][:16]}'
    result=request('POST',f'https://cloudbuild.googleapis.com/v1/projects/{PROJECT}/builds',json={
        'source':{'storageSource':{'bucket':BUCKET,'object':name}},
        'steps':[{'name':'gcr.io/cloud-builders/docker','args':['build','-t',image,'.']}],
        'images':[image],'timeout':'1200s','serviceAccount':f'projects/{PROJECT}/serviceAccounts/{BUILD_SA}',
        'options':{'logging':'CLOUD_LOGGING_ONLY','machineType':'E2_MEDIUM'}})
    build=result.get('metadata',{}).get('build',{})
    saved={'id':build.get('id'),'operation':result.get('name'),'image':image,'sourceSha256':manifest['sha256'],'logUrl':build.get('logUrl')}
    (STATE/'build.json').write_text(json.dumps(saved,indent=2)+'\n');print(json.dumps(saved),flush=True)

def status():
    saved=json.loads((STATE/'build.json').read_text())
    b=request('GET',f'https://cloudbuild.googleapis.com/v1/projects/{PROJECT}/builds/{saved["id"]}')
    print(json.dumps({k:b.get(k) for k in ['id','status','statusDetail','logUrl','failureInfo']}),flush=True)
    (STATE/'build-status.json').write_text(json.dumps(b,indent=2)+'\n')

def deploy():
    saved=json.loads((STATE/'build.json').read_text())
    b=request('GET',f'https://cloudbuild.googleapis.com/v1/projects/{PROJECT}/builds/{saved["id"]}')
    assert b['status']=='SUCCESS','Build must succeed before deployment'
    digest=b['results']['images'][0]['digest']; image=saved['image'].split(':')[0]+'@'+digest
    url=f'https://run.googleapis.com/v2/{BASE}/services/{SERVICE}'
    body={'ingress':'INGRESS_TRAFFIC_ALL','template':{'serviceAccount':RUN_SA,
          'scaling':{'minInstanceCount':0,'maxInstanceCount':1},'maxInstanceRequestConcurrency':32,'timeout':'300s',
          'containers':[{'image':image,'ports':[{'containerPort':8080}],
          'resources':{'limits':{'cpu':'1','memory':'2Gi'},'cpuIdle':True,'startupCpuBoost':False},
          'env':[{'name':'PUBLIC_DEMO','value':'true'}],
          'startupProbe':{'httpGet':{'path':'/healthz','port':8080},'periodSeconds':5,'failureThreshold':24,'timeoutSeconds':2}}]}}
    existing=client.get(url,timeout=30)
    if existing.status_code==404:op=request('POST',f'https://run.googleapis.com/v2/{BASE}/services?serviceId={SERVICE}',json=body)
    else:
        existing.raise_for_status();op=request('PATCH',url+'?updateMask=template,ingress',json=body)
    (STATE/'deploy-operation.json').write_text(json.dumps(op,indent=2)+'\n')
    print(json.dumps({'operation':op['name'],'image':image}),flush=True)

def publish():
    url=f'https://run.googleapis.com/v2/{BASE}/services/{SERVICE}'
    service=request('GET',url)
    assert service.get('terminalCondition',{}).get('state')=='CONDITION_SUCCEEDED',service.get('terminalCondition')
    binding(url,'allUsers','roles/run.invoker')
    (STATE/'service.json').write_text(json.dumps(service,indent=2)+'\n')
    print(json.dumps({'url':service['uri'],'revision':service.get('latestReadyRevision'),'project':PROJECT}),flush=True)

parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','build','status','deploy','publish']);args=parser.parse_args()
globals()[args.action]()
