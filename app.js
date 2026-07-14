const CONFIG=window.AUTONOMIA_CONFIG||{};
const DISCOVERY_DOC='https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES='https://www.googleapis.com/auth/calendar.readonly';

const defaultCenters=[
  {id:'centro',name:'Gabinete Centro',keywords:['gabinete centro','centro'],days:'Lunes y viernes',rate:40},
  {id:'norte',name:'Gabinete Norte',keywords:['gabinete norte','norte'],days:'Martes, miércoles y jueves',rate:53.75}
];

let centers=JSON.parse(localStorage.getItem('autonomiaCenters')||'null')||defaultCenters;
let sessions=JSON.parse(localStorage.getItem('autonomiaSessions')||'[]');
let invoices=JSON.parse(localStorage.getItem('autonomiaInvoices')||'[]');
let business=JSON.parse(localStorage.getItem('autonomiaBusiness')||'null')||{name:'Nombre profesional',nif:'',email:''};
let currentDate=new Date();
currentDate.setDate(1);
let tokenClient=null;
let googleReady=false;

const screens=[...document.querySelectorAll('.screen')];
const titles={home:'Inicio',sessions:'Sesiones',centers:'Gabinetes',invoices:'Facturas',resources:'Recursos',business:'Mi negocio',invoicePreview:'Factura'};

function saveAll(){
  localStorage.setItem('autonomiaCenters',JSON.stringify(centers));
  localStorage.setItem('autonomiaSessions',JSON.stringify(sessions));
  localStorage.setItem('autonomiaInvoices',JSON.stringify(invoices));
  localStorage.setItem('autonomiaBusiness',JSON.stringify(business));
}

function showScreen(id){
  screens.forEach(s=>s.classList.toggle('active',s.id===id));
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.go===id));
  document.getElementById('screenTitle').textContent=titles[id]||'AutonomIA';
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.go)));

function monthKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;}
function money(v){return Number(v||0).toLocaleString('es-ES',{style:'currency',currency:'EUR'});}
function selectedMonthSessions(){const key=monthKey(currentDate);return sessions.filter(s=>s.month===key);}
function classifyEvent(event){
  const text=[event.summary,event.location,event.description].filter(Boolean).join(' ').toLowerCase();
  return centers.find(c=>c.keywords.some(k=>text.includes(k.toLowerCase())))||null;
}

function renderMonth(){
  document.getElementById('monthLabel').textContent=currentDate.toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  const monthSessions=selectedMonthSessions();
  const list=document.getElementById('sessionList');
  list.innerHTML='';
  if(!monthSessions.length){
    list.className='session-list empty-state';
    list.textContent='Todavía no hay sesiones en este mes.';
  }else{
    list.className='session-list';
    monthSessions.sort((a,b)=>a.start.localeCompare(b.start)).forEach(s=>{
      const d=new Date(s.start);
      const row=document.createElement('div');
      row.className='session-row'+(s.centerId?'':' unclassified');
      row.innerHTML=`<time>${d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</time>
        <div><b>${s.centerName||'Sin clasificar'}</b><span>${d.toLocaleDateString('es-ES')} · ${s.title}</span></div>
        <strong>${s.centerId?money(s.rate):'—'}</strong>`;
      list.appendChild(row);
    });
  }
  document.getElementById('sessionCountBadge').textContent=`${monthSessions.length} sesiones`;
  renderDashboard();
  renderCenters();
}

function groupedData(){
  const monthSessions=selectedMonthSessions().filter(s=>s.centerId);
  return centers.map(c=>{
    const items=monthSessions.filter(s=>s.centerId===c.id);
    return {...c,count:items.length,total:items.length*c.rate};
  });
}

function renderDashboard(){
  const data=groupedData();
  const monthSessions=selectedMonthSessions();
  const classified=monthSessions.filter(s=>s.centerId);
  document.getElementById('metricSessions').textContent=monthSessions.length;
  document.getElementById('metricCenters').textContent=data.filter(x=>x.count>0).length;
  document.getElementById('metricPending').textContent=money(data.reduce((a,c)=>a+c.total,0));
  document.getElementById('metricUnclassified').textContent=monthSessions.length-classified.length;
  const summary=document.getElementById('centerSummary');
  const active=data.filter(x=>x.count>0);
  if(!active.length){
    summary.className='center-summary empty-state';
    summary.textContent='Conecta Google Calendar para importar las sesiones.';
  }else{
    summary.className='center-summary';
    summary.innerHTML=active.map(c=>`<div><b>${c.name}</b><span>${c.days}</span><strong>${c.count} sesiones · ${money(c.total)}</strong></div>`).join('');
  }
}

function renderCenters(){
  const container=document.getElementById('centerCards');
  container.innerHTML='';
  groupedData().forEach(c=>{
    const card=document.createElement('article');
    card.className='center-card';
    card.innerHTML=`<div class="center-head"><div><h2>${c.name}</h2><p>${c.days}</p></div><span class="badge">${c.count} sesiones</span></div>
      <div class="financial-grid"><div><span>Tarifa</span><b>${money(c.rate)} / sesión</b></div><div><span>Total mes</span><b>${money(c.total)}</b></div></div>
      <button class="primary create-monthly-invoice" data-id="${c.id}">Crear factura mensual</button>`;
    container.appendChild(card);
  });
  document.querySelectorAll('.create-monthly-invoice').forEach(b=>b.addEventListener('click',()=>openInvoiceForCenter(b.dataset.id)));
  const select=document.getElementById('sessionCenter');
  select.innerHTML=centers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
}

function renderInvoices(){
  const list=document.getElementById('invoiceList');
  list.innerHTML='';
  if(!invoices.length){list.innerHTML='<div class="empty-state">Todavía no hay facturas.</div>';return;}
  invoices.forEach(inv=>{
    const card=document.createElement('article');
    card.className='invoice-card';
    card.dataset.state=inv.state;
    card.innerHTML=`<div><b>${inv.number}</b><span>${inv.center} · ${inv.monthLabel}</span></div><div><strong>${money(inv.total)}</strong><em class="${inv.state==='paid'?'done':''}">${inv.state==='paid'?'Cobrada':'Pendiente'}</em></div>`;
    list.appendChild(card);
  });
}

function updateInvoiceTotal(){
  document.getElementById('invoiceTotal').textContent=money(Number(document.getElementById('invoiceSessions').value||0)*Number(document.getElementById('invoiceRate').value||0));
}
function openInvoiceForCenter(centerId){
  const c=groupedData().find(x=>x.id===centerId);
  showScreen('invoices');
  document.getElementById('invoiceForm').classList.remove('hidden');
  document.getElementById('invoiceCenter').value=c?.name||'';
  document.getElementById('invoiceMonth').value=monthKey(currentDate);
  document.getElementById('invoiceSessions').value=c?.count||0;
  document.getElementById('invoiceRate').value=c?.rate||0;
  document.getElementById('invoiceConcept').value=`Servicios profesionales - ${c?.name||''}`;
  updateInvoiceTotal();
}
document.getElementById('newInvoiceBtn').addEventListener('click',()=>{showScreen('invoices');document.getElementById('invoiceForm').classList.remove('hidden');});
document.getElementById('invoiceSessions').addEventListener('input',updateInvoiceTotal);
document.getElementById('invoiceRate').addEventListener('input',updateInvoiceTotal);
document.getElementById('cancelInvoice').addEventListener('click',()=>document.getElementById('invoiceForm').classList.add('hidden'));

document.getElementById('saveInvoice').addEventListener('click',()=>{
  const month=document.getElementById('invoiceMonth').value;
  const count=Number(document.getElementById('invoiceSessions').value||0);
  const rate=Number(document.getElementById('invoiceRate').value||0);
  const inv={
    number:`FAC-${new Date().getFullYear()}-${String(invoices.length+1).padStart(3,'0')}`,
    center:document.getElementById('invoiceCenter').value,
    month,
    monthLabel:month?new Date(month+'-01T00:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'}):'',
    sessions:count,rate,total:count*rate,
    concept:document.getElementById('invoiceConcept').value,
    state:'pending'
  };
  invoices.unshift(inv);saveAll();renderInvoices();document.getElementById('invoiceForm').classList.add('hidden');alert('Factura guardada.');
});

document.getElementById('previewInvoice').addEventListener('click',()=>{
  const month=document.getElementById('invoiceMonth').value;
  const count=Number(document.getElementById('invoiceSessions').value||0);
  const rate=Number(document.getElementById('invoiceRate').value||0);
  document.getElementById('previewNumber').textContent=`FAC-${new Date().getFullYear()}-${String(invoices.length+1).padStart(3,'0')}`;
  document.getElementById('previewBusiness').textContent=business.name;
  document.getElementById('previewNif').textContent=business.nif;
  document.getElementById('previewEmail').textContent=business.email;
  document.getElementById('previewCenter').textContent=document.getElementById('invoiceCenter').value;
  document.getElementById('previewMonth').textContent=month?new Date(month+'-01T00:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'}):'';
  document.getElementById('previewConcept').textContent=document.getElementById('invoiceConcept').value;
  document.getElementById('previewSessions').textContent=`${count} sesiones × ${money(rate)}`;
  document.getElementById('previewTotal').textContent=money(count*rate);
  document.getElementById('previewGrandTotal').textContent=money(count*rate);
  showScreen('invoicePreview');
});
document.getElementById('printInvoice').addEventListener('click',()=>window.print());
document.getElementById('closePreview').addEventListener('click',()=>showScreen('invoices'));

document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  document.querySelectorAll('.invoice-card').forEach(c=>c.style.display=b.dataset.filter==='all'||c.dataset.state===b.dataset.filter?'flex':'none');
}));

document.getElementById('quickAdd').addEventListener('click',()=>{
  const active=document.querySelector('.screen.active').id;
  if(active==='sessions') document.getElementById('manualSessionForm').classList.remove('hidden');
  else if(active==='centers') document.getElementById('newCenterName').focus();
  else if(active==='invoices') document.getElementById('newInvoiceBtn').click();
  else{showScreen('sessions');document.getElementById('manualSessionForm').classList.remove('hidden');}
});

document.getElementById('saveSession').addEventListener('click',()=>{
  const center=centers.find(c=>c.id===document.getElementById('sessionCenter').value);
  const date=document.getElementById('sessionDate').value;
  const time=document.getElementById('sessionTime').value;
  if(!date||!time){document.getElementById('sessionStatus').textContent='Completa fecha y hora.';return;}
  sessions.push({id:`manual-${Date.now()}`,title:'Sesión manual',start:`${date}T${time}:00`,month:date.slice(0,7),centerId:center.id,centerName:center.name,rate:Number(document.getElementById('sessionRate').value||center.rate),source:'Manual'});
  saveAll();renderMonth();document.getElementById('manualSessionForm').classList.add('hidden');
});
document.getElementById('cancelSession').addEventListener('click',()=>document.getElementById('manualSessionForm').classList.add('hidden'));

document.getElementById('saveCenter').addEventListener('click',()=>{
  const name=document.getElementById('newCenterName').value.trim();
  if(!name){document.getElementById('centerStatus').textContent='Indica el nombre.';return;}
  centers.push({
    id:`center-${Date.now()}`,name,
    keywords:document.getElementById('newCenterKeywords').value.split(',').map(x=>x.trim()).filter(Boolean),
    days:document.getElementById('newCenterDays').value.trim(),
    rate:Number(document.getElementById('newCenterRate').value||0)
  });
  saveAll();renderMonth();document.getElementById('centerStatus').textContent='Gabinete guardado.';
});

document.getElementById('prevMonth').addEventListener('click',()=>{currentDate.setMonth(currentDate.getMonth()-1);renderMonth();});
document.getElementById('nextMonth').addEventListener('click',()=>{currentDate.setMonth(currentDate.getMonth()+1);renderMonth();});

document.getElementById('saveBusiness').addEventListener('click',()=>{
  business={name:document.getElementById('businessName').value,nif:document.getElementById('businessNif').value,email:document.getElementById('businessEmail').value};
  saveAll();alert('Datos guardados.');
});
document.getElementById('businessName').value=business.name;
document.getElementById('businessNif').value=business.nif;
document.getElementById('businessEmail').value=business.email;

const resources={
  invoice:{title:'Modelo de factura mensual',body:'Concepto: Servicios profesionales correspondientes al mes de [MES].\\nNúmero de sesiones: [NÚMERO].\\nTarifa por sesión: [TARIFA].'},
  email:{title:'Email para enviar factura',body:'Hola,\\n\\nAdjunto la factura correspondiente a los servicios profesionales prestados durante el mes de [MES], junto con el resumen de sesiones.\\n\\nUn saludo.'},
  summary:{title:'Resumen mensual de sesiones',body:'Gabinete: [NOMBRE]\\nMes: [MES]\\nNúmero total de sesiones: [NÚMERO]\\nImporte total: [TOTAL]'},
  agreement:{title:'Acuerdo de colaboración',body:'Plantilla orientativa. Debe revisarse y adaptarse con asesoramiento profesional antes de su uso.'}
};
document.querySelectorAll('.resource-btn').forEach(b=>b.addEventListener('click',()=>{
  const r=resources[b.dataset.resource];document.getElementById('resourceViewer').classList.remove('hidden');document.getElementById('resourceTitle').textContent=r.title;document.getElementById('resourceBody').value=r.body;
}));
document.getElementById('closeResource').addEventListener('click',()=>document.getElementById('resourceViewer').classList.add('hidden'));
document.getElementById('copyResource').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(document.getElementById('resourceBody').value);alert('Copiado.');}catch{alert('Selecciona y copia el texto manualmente.');}
});

function validConfig(){
  return CONFIG.GOOGLE_CLIENT_ID && CONFIG.GOOGLE_API_KEY &&
    !CONFIG.GOOGLE_CLIENT_ID.includes('PEGA_AQUI') && !CONFIG.GOOGLE_API_KEY.includes('PEGA_AQUI');
}
function setCalendarStatus(text,connected=false){
  document.getElementById('calendarStatus').textContent=text;
  document.getElementById('businessCalendarStatus').textContent=text;
  document.getElementById('syncGoogle').classList.toggle('hidden',!connected);
  document.getElementById('connectGoogle').textContent=connected?'Reconectar Google':'Conectar Google Calendar';
}
async function initGoogle(){
  if(!validConfig()){setCalendarStatus('Falta configurar config.js');return;}
  try{
    await new Promise(resolve=>gapi.load('client',resolve));
    await gapi.client.init({apiKey:CONFIG.GOOGLE_API_KEY,discoveryDocs:[DISCOVERY_DOC]});
    tokenClient=google.accounts.oauth2.initTokenClient({
      client_id:CONFIG.GOOGLE_CLIENT_ID,
      scope:SCOPES,
      callback:''
    });
    googleReady=true;setCalendarStatus('Preparado para conectar');
  }catch(e){setCalendarStatus('Error al preparar Google');console.error(e);}
}
async function connectGoogle(){
  if(!validConfig()){alert('Primero completa GOOGLE_CLIENT_ID y GOOGLE_API_KEY en config.js.');return;}
  if(!googleReady) await initGoogle();
  tokenClient.callback=async response=>{
    if(response.error){setCalendarStatus('No se pudo conectar');return;}
    setCalendarStatus('Conectado',true);
    await syncCalendar();
  };
  tokenClient.requestAccessToken({prompt:gapi.client.getToken()===null?'consent':''});
}
async function syncCalendar(){
  try{
    const start=new Date(currentDate.getFullYear(),currentDate.getMonth(),1);
    const end=new Date(currentDate.getFullYear(),currentDate.getMonth()+1,1);
    const response=await gapi.client.calendar.events.list({
      calendarId:'primary',timeMin:start.toISOString(),timeMax:end.toISOString(),
      showDeleted:false,singleEvents:true,orderBy:'startTime',maxResults:2500
    });
    const imported=(response.result.items||[]).filter(e=>e.start?.dateTime).map(e=>{
      const c=classifyEvent(e);
      const startValue=e.start.dateTime;
      return {id:e.id,title:e.summary||'Evento sin título',start:startValue,month:startValue.slice(0,7),centerId:c?.id||null,centerName:c?.name||null,rate:c?.rate||0,source:'Google Calendar'};
    });
    sessions=sessions.filter(s=>s.source!=='Google Calendar'||s.month!==monthKey(currentDate)).concat(imported);
    saveAll();renderMonth();setCalendarStatus(`${imported.length} eventos sincronizados`,true);
  }catch(e){setCalendarStatus('Error al sincronizar');console.error(e);}
}
document.getElementById('connectGoogle').addEventListener('click',connectGoogle);
document.getElementById('businessConnectGoogle').addEventListener('click',connectGoogle);
document.getElementById('syncGoogle').addEventListener('click',syncCalendar);

renderInvoices();renderMonth();initGoogle();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(console.error));}
