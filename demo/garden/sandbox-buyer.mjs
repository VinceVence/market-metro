const message=document.getElementById('setup-message'),button=document.getElementById('setup-start');
async function api(path,input){const r=await fetch(path,input===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Supply-Yard':'sandbox'},body:JSON.stringify(input)});const data=await r.json();if(!r.ok)throw new Error(data.error?.message||'The local sandbox setup could not complete.');return data;}
function show(status){message.textContent=status.ready?'Sandbox buyer is ready. Future selected orders reuse this consent; no checkout each simulation run.':status.description;button.hidden=status.ready;}
button.onclick=async()=>{button.disabled=true;try{const data=await api('/api/paypal/funding/start',{});if(data.approvalUrl)location.assign(data.approvalUrl);else show(data);}catch(e){message.textContent=e.message;}finally{button.disabled=false;}};
try{
  const query=new URLSearchParams(location.search),state=query.get('state');
  if(state){const result=await api('/api/paypal/funding/complete',{state});history.replaceState(null,'','/sandbox-buyer.html');show(result);}
  else{const status=await api('/api/paypal/funding');show(status);if(query.has('cancelled'))message.textContent='Sandbox setup was cancelled. No payment was made; the local simulation still works.';}
}catch(e){message.textContent=e.message;button.hidden=false;}
