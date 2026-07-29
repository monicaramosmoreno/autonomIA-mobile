const CONFIG=window.AUTONOMIA_CONFIG||{};
const SCOPES='https://www.googleapis.com/auth/calendar.readonly';
const GOOGLE_CALENDAR_EVENTS_URL='https://www.googleapis.com/calendar/v3/calendars/primary/events';

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
let googleAccessToken='';
let googleInitPromise=null;
let calendarBusy=false;

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

function validGoogleConfig(){
  return Boolean(
    CONFIG.GOOGLE_CLIENT_ID &&
    !CONFIG.GOOGLE_CLIENT_ID.includes('PEGA_AQUI')
  );
}
function setCalendarStatus(text,connected=false){
  document.getElementById('calendarStatus').textContent=text;
  document.getElementById('businessCalendarStatus').textContent=text;
  document.getElementById('syncGoogle').classList.toggle('hidden',!connected);
  document.getElementById('connectGoogle').textContent=connected?'Reconectar Google':'Conectar Google Calendar';
  document.getElementById('businessConnectGoogle').textContent=connected?'Reconectar':'Conectar';
}
function setCalendarBusy(busy){
  calendarBusy=busy;
  document.getElementById('connectGoogle').disabled=busy;
  document.getElementById('businessConnectGoogle').disabled=busy;
}
function isLocalFile(){
  return window.location.protocol==='file:';
}
function waitForGoogleIdentity(timeout=8000){
  if(window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const started=Date.now();
    const timer=window.setInterval(()=>{
      if(window.google?.accounts?.oauth2){
        window.clearInterval(timer);
        resolve();
      }else if(Date.now()-started>=timeout){
        window.clearInterval(timer);
        reject(new Error('Google Identity Services no se ha cargado.'));
      }
    },100);
  });
}
async function initGoogle(){
  if(googleReady) return true;
  if(googleInitPromise) return googleInitPromise;
  googleInitPromise=(async()=>{
    if(!validGoogleConfig()){
      setCalendarStatus('Falta configurar el Client ID de Google');
      return false;
    }
    if(isLocalFile()){
      setCalendarStatus('Ábrela desde Sites o Vercel para conectar');
      return false;
    }
    try{
      await waitForGoogleIdentity();
      tokenClient=google.accounts.oauth2.initTokenClient({
        client_id:CONFIG.GOOGLE_CLIENT_ID,
        scope:SCOPES,
        callback:()=>{},
        error_callback:error=>{
          setCalendarStatus(error?.type==='popup_closed'?'Conexión cancelada':'No se pudo abrir Google');
          setCalendarBusy(false);
        }
      });
      googleReady=true;
      setCalendarStatus('Preparado para conectar');
      return true;
    }catch(e){
      setCalendarStatus('No se pudo cargar el acceso a Google');
      console.error(e);
      return false;
    }
  })();
  const ready=await googleInitPromise;
  if(!ready) googleInitPromise=null;
  return ready;
}
async function connectGoogle(){
  if(calendarBusy) return;
  if(isLocalFile()){
    setCalendarStatus('Ábrela desde Sites o Vercel para conectar');
    alert('Google Calendar no permite iniciar sesión abriendo index.html directamente. Usa la versión publicada de AutonomIA.');
    return;
  }
  setCalendarBusy(true);
  setCalendarStatus('Preparando conexión…');
  try{
    const ready=await initGoogle();
    if(!ready||!tokenClient){
      setCalendarStatus('No se pudo preparar la conexión');
      setCalendarBusy(false);
      return;
    }
    tokenClient.callback=async response=>{
      if(response.error||!response.access_token){
        setCalendarStatus(response.error==='access_denied'?'Permiso cancelado':'Google no pudo completar la conexión');
        setCalendarBusy(false);
        return;
      }
      googleAccessToken=response.access_token;
      setCalendarStatus('Conectado',true);
      await syncCalendar();
      setCalendarBusy(false);
    };
    tokenClient.requestAccessToken({prompt:googleAccessToken?'':'consent'});
  }catch(e){
    setCalendarStatus('No se pudo abrir el acceso a Google');
    setCalendarBusy(false);
    console.error(e);
  }
}
async function syncCalendar(){
  if(!googleAccessToken){
    setCalendarStatus('Conecta primero tu cuenta de Google');
    return;
  }
  try{
    const start=new Date(currentDate.getFullYear(),currentDate.getMonth(),1);
    const end=new Date(currentDate.getFullYear(),currentDate.getMonth()+1,1);
    const query=new URLSearchParams({
      timeMin:start.toISOString(),
      timeMax:end.toISOString(),
      showDeleted:'false',
      singleEvents:'true',
      orderBy:'startTime',
      maxResults:'2500',
      fields:'items(id,summary,location,description,start)'
    });
    const response=await fetch(`${GOOGLE_CALENDAR_EVENTS_URL}?${query}`,{
      headers:{Authorization:`Bearer ${googleAccessToken}`}
    });
    if(!response.ok){
      const details=await response.json().catch(()=>null);
      const message=details?.error?.message||`Error ${response.status}`;
      throw new Error(message);
    }
    const data=await response.json();
    const imported=(data.items||[]).filter(e=>e.start?.dateTime).map(e=>{
      const c=classifyEvent(e);
      const startValue=e.start.dateTime;
      return {id:e.id,title:e.summary||'Evento sin título',start:startValue,month:startValue.slice(0,7),centerId:c?.id||null,centerName:c?.name||null,rate:c?.rate||0,source:'Google Calendar'};
    });
    sessions=sessions.filter(s=>s.source!=='Google Calendar'||s.month!==monthKey(currentDate)).concat(imported);
    saveAll();renderMonth();setCalendarStatus(`${imported.length} eventos sincronizados`,true);
  }catch(e){
    const authExpired=/401|invalid credentials|unauthenticated/i.test(String(e?.message||e));
    if(authExpired) googleAccessToken='';
    setCalendarStatus(authExpired?'La sesión de Google ha caducado. Reconecta.':'Error al sincronizar: revisa permisos');
    console.error(e);
  }
}
document.getElementById('connectGoogle').addEventListener('click',connectGoogle);
document.getElementById('businessConnectGoogle').addEventListener('click',connectGoogle);
document.getElementById('syncGoogle').addEventListener('click',syncCalendar);

// Navegación y experiencia Ari (prototipo local)
const toast=document.getElementById('toast');
function showToast(message){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600);}
const hour=new Date().getHours();
document.getElementById('welcomeTitle').textContent=`${hour<12?'Buenos días':hour<20?'Buenas tardes':'Buenas noches'}, Mónica`;
document.getElementById('summaryMonth').textContent=new Date().toLocaleDateString('es-ES',{month:'long'}).toUpperCase();
document.getElementById('homeNewInvoice').addEventListener('click',()=>document.getElementById('newInvoiceBtn').click());
function openManualSession(){showScreen('sessions');document.getElementById('manualSessionForm').classList.remove('hidden');document.getElementById('sessionDate').valueAsDate=new Date();}
document.getElementById('quickSession').addEventListener('click',openManualSession);
document.getElementById('addSessionTop').addEventListener('click',openManualSession);

const ariOverlay=document.getElementById('ariOverlay');
const ariStorageKey='autonomiaAriReportV06';
function openAri(){ariOverlay.classList.remove('hidden');document.body.style.overflow='hidden';}
function closeAri(){ariOverlay.classList.add('hidden');document.body.style.overflow='';}
['openAriSide','openAriHeader','openAriCard'].forEach(id=>document.getElementById(id).addEventListener('click',openAri));
document.getElementById('closeAri').addEventListener('click',closeAri);
ariOverlay.addEventListener('click',event=>{if(event.target===ariOverlay)closeAri();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeAri();});

const ariNotes=document.getElementById('ariNotes');
const ariStatus=document.getElementById('ariStatus');
const ariEditor=document.getElementById('ariReportEditor');
const ariEmpty=document.getElementById('ariReportEmpty');
const ariFields={
  context:document.getElementById('ariContext'),
  observations:document.getElementById('ariObservations'),
  intervention:document.getElementById('ariIntervention'),
  evolution:document.getElementById('ariEvolution'),
  plan:document.getElementById('ariPlan'),
  review:document.getElementById('ariReview')
};
const ariExamples={
  psychology:'Paciente ficticio adulto. Refiere menor ansiedad esta semana y mejor descanso. Se revisan situaciones desencadenantes y se practica respiración diafragmática. Participa activamente y reconoce pensamientos anticipatorios. Se acuerda registrar dos situaciones y continuar con la práctica diaria hasta la próxima sesión.',
  speech:'Paciente ficticio infantil. Se observa mejor discriminación de los sonidos trabajados. Se realizan ejercicios de conciencia fonológica, repetición de sílabas y denominación de imágenes. Mantiene la atención con apoyo visual. Se recomienda continuar la práctica breve en casa y revisar la generalización en la próxima sesión.',
  physio:'Paciente ficticio adulto. Refiere disminución del dolor lumbar, actualmente tres sobre diez. Se realiza valoración de movilidad, terapia manual suave y ejercicios de control lumbopélvico. Tolera bien la sesión. Se recomienda continuar el programa domiciliario y aumentar progresivamente las repeticiones sin provocar dolor.'
};
document.getElementById('loadAriExample').addEventListener('click',()=>{
  ariNotes.value=ariExamples[document.getElementById('ariSpecialty').value];
  ariStatus.textContent='Ejemplo ficticio cargado. Ya puedes generar el borrador.';
});
function ariSentences(text){return text.split(/(?<=[.!?])\s+/).map(item=>item.trim()).filter(Boolean);}
function ariSelect(sentences,words){return sentences.filter(sentence=>words.some(word=>sentence.toLowerCase().includes(word))).join(' ');}
function buildAriDraft(text){
  const sentences=ariSentences(text);
  const intervention=ariSelect(sentences,['se realiza','se trabaja','se practica','se revisa','terapia','ejercicio']);
  const evolution=ariSelect(sentences,['mejor','disminu','aument','tolera','participa','observa','mantiene']);
  const plan=ariSelect(sentences,['se acuerda','se propone','se recomienda','próxima','continuar','práctica']);
  const context=sentences.slice(0,Math.min(2,sentences.length)).join(' ');
  const classified=[intervention,evolution,plan,context].filter(Boolean);
  const observations=sentences.filter(sentence=>!classified.some(block=>block.includes(sentence))).join(' ');
  return {context:context||text,observations:observations||'Completar durante la revisión profesional.',intervention:intervention||'Completar durante la revisión profesional.',evolution:evolution||'Completar durante la revisión profesional.',plan:plan||'Completar durante la revisión profesional.',review:''};
}
function showAriDraft(draft){
  Object.entries(ariFields).forEach(([key,field])=>{field.value=draft[key]||'';});
  ariEmpty.classList.add('hidden');ariEditor.classList.remove('hidden');
}
document.getElementById('generateReport').addEventListener('click',()=>{
  const text=ariNotes.value.trim();
  if(text.length<40){ariStatus.textContent='Añade algo más de información para estructurar el borrador.';ariNotes.focus();return;}
  showAriDraft(buildAriDraft(text));
  const type=document.getElementById('ariReportType');
  document.getElementById('ariReportHeading').textContent=type.options[type.selectedIndex].text;
  ariStatus.textContent='Borrador generado localmente. Revísalo y corrige cualquier interpretación.';
});
function ariReportData(){return {specialty:document.getElementById('ariSpecialty').value,type:document.getElementById('ariReportType').value,transcript:ariNotes.value,...Object.fromEntries(Object.entries(ariFields).map(([key,field])=>[key,field.value]))};}
document.getElementById('saveAriReport').addEventListener('click',()=>{localStorage.setItem(ariStorageKey,JSON.stringify(ariReportData()));ariStatus.textContent='Borrador guardado únicamente en este dispositivo.';});
document.getElementById('downloadAriReport').addEventListener('click',()=>{
  const data=ariReportData();
  const body=`INFORME — BORRADOR PARA REVISIÓN\n\nMOTIVO Y CONTEXTO\n${data.context}\n\nOBSERVACIONES\n${data.observations}\n\nINTERVENCIÓN REALIZADA\n${data.intervention}\n\nEVOLUCIÓN\n${data.evolution}\n\nPLAN Y PRÓXIMOS PASOS\n${data.plan}\n\nREVISIÓN PROFESIONAL\n${data.review||'Pendiente de revisión.'}\n\nGenerado con AutonomIA Beta. No sustituye el criterio profesional.`;
  const url=URL.createObjectURL(new Blob([body],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`informe-borrador-${new Date().toISOString().slice(0,10)}.txt`;link.click();URL.revokeObjectURL(url);
});
document.getElementById('deleteAriReport').addEventListener('click',()=>{
  localStorage.removeItem(ariStorageKey);ariNotes.value='';Object.values(ariFields).forEach(field=>{field.value='';});
  ariEditor.classList.add('hidden');ariEmpty.classList.remove('hidden');ariStatus.textContent='Nota y borrador eliminados del dispositivo.';
});
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
let ariRecognition=null;let ariFinalText='';
document.getElementById('recordVoice').addEventListener('click',()=>{
  const button=document.getElementById('recordVoice');
  if(!SpeechRecognition){ariStatus.textContent='El dictado no está disponible aquí. Usa Chrome o Edge, o escribe las notas.';return;}
  if(ariRecognition){ariRecognition.stop();return;}
  ariRecognition=new SpeechRecognition();ariRecognition.lang='es-ES';ariRecognition.continuous=true;ariRecognition.interimResults=true;ariFinalText=ariNotes.value?`${ariNotes.value.trim()} `:'';
  ariRecognition.onresult=event=>{let interim='';for(let i=event.resultIndex;i<event.results.length;i++){const text=event.results[i][0].transcript;if(event.results[i].isFinal)ariFinalText+=`${text} `;else interim+=text;}ariNotes.value=(ariFinalText+interim).trim();};
  ariRecognition.onerror=event=>{ariStatus.textContent=event.error==='not-allowed'?'Necesitamos permiso para usar el micrófono.':'No se pudo continuar el dictado.';};
  ariRecognition.onend=()=>{ariRecognition=null;button.classList.remove('recording');button.querySelector('b').textContent='Iniciar dictado';button.querySelector('small').textContent='Disponible en Chrome y Edge';};
  ariRecognition.start();button.classList.add('recording');button.querySelector('b').textContent='Dictando… toca para terminar';button.querySelector('small').textContent='Revisa la transcripción antes de generar';
});
try{
  const savedAri=JSON.parse(localStorage.getItem(ariStorageKey)||'null');
  if(savedAri){ariNotes.value=savedAri.transcript||'';showAriDraft(savedAri);ariStatus.textContent='Se ha recuperado el último borrador guardado en este dispositivo.';}
}catch{}

renderInvoices();renderMonth();initGoogle().catch(console.error);
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(console.error));}
