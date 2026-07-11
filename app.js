
const screens=[...document.querySelectorAll('.screen')];
const titles={home:'Inicio',agenda:'Sesiones',centers:'Gabinetes',invoices:'Facturas',resources:'Recursos',business:'Mi negocio'};

let sessions=[
  {date:'2026-07-01',time:'10:00',center:'Gabinete Norte',rate:53.75,source:'Google Calendar'},
  {date:'2026-07-02',time:'11:30',center:'Gabinete Norte',rate:53.75,source:'Google Calendar'},
  {date:'2026-07-03',time:'09:00',center:'Gabinete Centro',rate:40,source:'Google Calendar'},
  {date:'2026-07-06',time:'12:00',center:'Gabinete Centro',rate:40,source:'Google Calendar'},
  {date:'2026-07-07',time:'10:30',center:'Gabinete Norte',rate:53.75,source:'Google Calendar'}
];

let googleConfig={
  clientId: localStorage.getItem('autonomiaGoogleClientId')||'',
  apiKey: localStorage.getItem('autonomiaGoogleApiKey')||''
};
let tokenClient=null;
let gapiReady=false;
let gisReady=false;

function showScreen(id){
  screens.forEach(s=>s.classList.toggle('active',s.id===id));
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.go===id));
  document.getElementById('screenTitle').textContent=titles[id]||'AutonomIA';
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.go)));

function renderSessions(){
  const list=document.getElementById('sessionList');
  list.innerHTML='';
  sessions.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).forEach(s=>{
    const date=new Date(s.date+'T00:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'});
    const row=document.createElement('div');
    row.className='session-row';
    row.innerHTML=`<time>${s.time}</time><div><b>${s.center}</b><span>${date} · ${s.source}</span></div><strong>${s.rate.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</strong>`;
    list.appendChild(row);
  });
  document.getElementById('sessionCountBadge').textContent=`${sessions.length} sesiones`;
}

function updateInvoiceTotal(){
  const count=Number(document.getElementById('invoiceSessions').value||0);
  const rate=Number(document.getElementById('invoiceRate').value||0);
  document.getElementById('invoiceTotal').textContent=(count*rate).toLocaleString('es-ES',{style:'currency',currency:'EUR'});
}
function openMonthlyInvoice(center='',count=0,rate=0){
  showScreen('invoices');
  document.getElementById('invoiceForm').classList.remove('hidden');
  document.getElementById('invoiceCenter').value=center;
  document.getElementById('invoiceSessions').value=count;
  document.getElementById('invoiceRate').value=rate;
  document.getElementById('invoiceMonth').value='2026-07';
  document.getElementById('invoiceConcept').value=`Servicios profesionales - ${center}`;
  updateInvoiceTotal();
}
document.querySelectorAll('.create-monthly-invoice').forEach(b=>b.addEventListener('click',()=>openMonthlyInvoice(b.dataset.center,b.dataset.sessions,b.dataset.rate)));
document.getElementById('newInvoiceBtn').addEventListener('click',()=>openMonthlyInvoice());
document.getElementById('invoiceSessions').addEventListener('input',updateInvoiceTotal);
document.getElementById('invoiceRate').addEventListener('input',updateInvoiceTotal);
document.getElementById('saveInvoice').addEventListener('click',()=>alert('Factura mensual guardada en modo demo.'));
document.getElementById('printInvoice').addEventListener('click',()=>window.print());

document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  document.querySelectorAll('.invoice-card').forEach(c=>c.style.display=b.dataset.filter==='all'||c.dataset.state===b.dataset.filter?'flex':'none');
}));

document.getElementById('quickAdd').addEventListener('click',()=>{
  const active=document.querySelector('.screen.active').id;
  if(active==='agenda') document.getElementById('manualSessionForm').classList.remove('hidden');
  else if(active==='centers') document.getElementById('newCenterName').focus();
  else if(active==='invoices') openMonthlyInvoice();
  else {showScreen('agenda');document.getElementById('manualSessionForm').classList.remove('hidden');}
});

document.getElementById('saveSession').addEventListener('click',()=>{
  const center=document.getElementById('sessionCenter').value;
  const date=document.getElementById('sessionDate').value;
  const time=document.getElementById('sessionTime').value;
  const rate=Number(document.getElementById('sessionRate').value||0);
  if(!date||!time){document.getElementById('sessionStatus').textContent='Completa fecha y hora.';return;}
  sessions.push({date,time,center,rate,source:'Manual'});
  renderSessions();
  document.getElementById('sessionStatus').textContent='Sesión guardada.';
});

document.getElementById('saveCenter').addEventListener('click',()=>alert('Gabinete guardado en modo demo.'));

function updateCalendarUI(connected,text){
  document.getElementById('calendarStatus').textContent=text;
  document.getElementById('businessCalendarStatus').textContent=text;
  document.getElementById('connectGoogle').textContent=connected?'Sincronizar ahora':'Conectar Google Calendar';
  document.getElementById('businessConnectGoogle').textContent=connected?'Sincronizar':'Conectar';
}

async function initializeGoogle(){
  if(!googleConfig.clientId||!googleConfig.apiKey){
    updateCalendarUI(false,'Faltan credenciales de Google');
    return;
  }
  try{
    await new Promise(resolve=>gapi.load('client',resolve));
    await gapi.client.init({
      apiKey:googleConfig.apiKey,
      discoveryDocs:['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
    });
    gapiReady=true;
    tokenClient=google.accounts.oauth2.initTokenClient({
      client_id:googleConfig.clientId,
      scope:'https://www.googleapis.com/auth/calendar.readonly',
      callback:''
    });
    gisReady=true;
    updateCalendarUI(false,'Preparado para conectar');
  }catch(err){
    updateCalendarUI(false,'Error al preparar Google Calendar');
  }
}

async function connectGoogle(){
  if(!googleConfig.clientId||!googleConfig.apiKey){
    showScreen('business');
    document.getElementById('googleConfigStatus').textContent='Introduce primero el Client ID y la API Key.';
    return;
  }
  if(!gapiReady||!gisReady) await initializeGoogle();
  if(!tokenClient) return;
  tokenClient.callback=async resp=>{
    if(resp.error){updateCalendarUI(false,'No se pudo conectar');return;}
    updateCalendarUI(true,'Conectado');
    await syncGoogleCalendar();
  };
  const prompt=gapi.client.getToken()===null?'consent':'';
  tokenClient.requestAccessToken({prompt});
}

async function syncGoogleCalendar(){
  try{
    const start=new Date('2026-07-01T00:00:00');
    const end=new Date('2026-08-01T00:00:00');
    const response=await gapi.client.calendar.events.list({
      calendarId:'primary',
      timeMin:start.toISOString(),
      timeMax:end.toISOString(),
      showDeleted:false,
      singleEvents:true,
      orderBy:'startTime',
      maxResults:250
    });
    const imported=(response.result.items||[]).map(event=>{
      const startValue=event.start.dateTime||event.start.date;
      const d=new Date(startValue);
      const title=(event.summary||'').toLowerCase();
      let center='Sin clasificar';
      let rate=0;
      if(title.includes('centro')){center='Gabinete Centro';rate=40;}
      if(title.includes('norte')){center='Gabinete Norte';rate=53.75;}
      return {
        date:d.toISOString().slice(0,10),
        time:event.start.dateTime?d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'Todo el día',
        center,rate,source:'Google Calendar'
      };
    });
    sessions=imported;
    renderSessions();
    document.getElementById('metricSessions').textContent=imported.length;
    updateCalendarUI(true,`${imported.length} eventos sincronizados`);
  }catch(err){
    updateCalendarUI(false,'Error durante la sincronización');
  }
}

document.getElementById('connectGoogle').addEventListener('click',connectGoogle);
document.getElementById('businessConnectGoogle').addEventListener('click',connectGoogle);
document.getElementById('demoSync').addEventListener('click',()=>{
  sessions=[
    {date:'2026-07-03',time:'09:00',center:'Gabinete Centro',rate:40,source:'Google Calendar (demo)'},
    {date:'2026-07-06',time:'10:30',center:'Gabinete Centro',rate:40,source:'Google Calendar (demo)'},
    {date:'2026-07-07',time:'11:00',center:'Gabinete Norte',rate:53.75,source:'Google Calendar (demo)'},
    {date:'2026-07-08',time:'12:00',center:'Gabinete Norte',rate:53.75,source:'Google Calendar (demo)'},
    {date:'2026-07-09',time:'16:30',center:'Gabinete Norte',rate:53.75,source:'Google Calendar (demo)'}
  ];
  renderSessions();
  document.getElementById('metricSessions').textContent=sessions.length;
  updateCalendarUI(true,'Sincronización demo completada');
});

document.getElementById('saveGoogleConfig').addEventListener('click',async()=>{
  googleConfig.clientId=document.getElementById('googleClientId').value.trim();
  googleConfig.apiKey=document.getElementById('googleApiKey').value.trim();
  localStorage.setItem('autonomiaGoogleClientId',googleConfig.clientId);
  localStorage.setItem('autonomiaGoogleApiKey',googleConfig.apiKey);
  document.getElementById('googleConfigStatus').textContent='Configuración guardada en este dispositivo.';
  await initializeGoogle();
});

document.getElementById('googleClientId').value=googleConfig.clientId;
document.getElementById('googleApiKey').value=googleConfig.apiKey;
renderSessions();
initializeGoogle();

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
