
const screens = document.querySelectorAll('.screen');
const navButtons = document.querySelectorAll('.nav-btn');

function showScreen(id){
  screens.forEach(s => s.classList.toggle('active', s.id === id));
  navButtons.forEach(b => b.classList.toggle('active', b.dataset.screen === id));
  window.scrollTo({top:0, behavior:'smooth'});
}
navButtons.forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.screen)));
document.querySelectorAll('[data-jump]').forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.jump)));

function openInvoice(client='', price='60'){
  showScreen('invoices');
  document.getElementById('invoiceCreator').classList.remove('hidden');
  document.getElementById('invoiceClient').value = client;
  document.getElementById('invoiceBase').value = price;
  document.getElementById('invoiceDate').valueAsDate = new Date();
  updateTotal();
}
document.querySelectorAll('.invoice-action').forEach(btn => {
  btn.addEventListener('click', () => openInvoice(btn.dataset.client || '', btn.dataset.price || '60'));
});
document.getElementById('manualInvoice').addEventListener('click', () => openInvoice());
document.getElementById('closeInvoice').addEventListener('click', () => document.getElementById('invoiceCreator').classList.add('hidden'));

function updateTotal(){
  const base = Number(document.getElementById('invoiceBase').value || 0);
  const vat = Number(document.getElementById('invoiceVat').value || 0);
  const total = base * (1 + vat/100);
  document.getElementById('invoiceTotal').textContent = total.toLocaleString('es-ES',{style:'currency',currency:'EUR'});
}
document.getElementById('invoiceBase').addEventListener('input', updateTotal);
document.getElementById('invoiceVat').addEventListener('change', updateTotal);

function populatePrintableInvoice(){
  const client = document.getElementById('invoiceClient').value || 'Paciente';
  const dateValue = document.getElementById('invoiceDate').value;
  const date = dateValue ? new Date(dateValue + 'T00:00:00').toLocaleDateString('es-ES') : '';
  const concept = document.getElementById('invoiceConcept').value || 'Sesión profesional';
  const base = Number(document.getElementById('invoiceBase').value || 0);
  const vat = Number(document.getElementById('invoiceVat').value || 0);
  const total = base * (1 + vat/100);
  const money = value => value.toLocaleString('es-ES',{style:'currency',currency:'EUR'});

  document.getElementById('printClient').textContent = client;
  document.getElementById('printDate').textContent = date;
  document.getElementById('printConcept').textContent = concept;
  document.getElementById('printBase').textContent = money(base);
  document.getElementById('printVat').textContent = vat + ' %';
  document.getElementById('printTotal').textContent = money(total);
  document.getElementById('printGrandTotal').textContent = money(total);
}

document.getElementById('previewInvoice').addEventListener('click', () => {
  populatePrintableInvoice();
  document.body.classList.add('preview-mode');

  if(!document.getElementById('previewToolbar')){
    const bar = document.createElement('div');
    bar.id = 'previewToolbar';
    bar.className = 'preview-toolbar';
    bar.innerHTML = `
      <button type="button" class="secondary" id="backFromPreview">Volver</button>
      <button type="button" class="primary" id="printFromPreview">Imprimir / guardar PDF</button>
    `;
    document.getElementById('printableInvoice').prepend(bar);
    document.getElementById('backFromPreview').addEventListener('click', () => {
      document.body.classList.remove('preview-mode');
    });
    document.getElementById('printFromPreview').addEventListener('click', () => window.print());
  }
});

document.getElementById('printInvoice').addEventListener('click', () => {
  populatePrintableInvoice();
  window.print();
});


document.getElementById('saveAppointment').addEventListener('click', () => {
  const patient = document.getElementById('apptPatient').value.trim();
  const time = document.getElementById('apptTime').value;
  const service = document.getElementById('apptService').value;
  const price = document.getElementById('apptPrice').value || '0';
  const status = document.getElementById('apptStatus');
  if(!patient || !time){
    status.textContent = 'Completa al menos el paciente y la hora.';
    return;
  }
  const row = document.createElement('div');
  row.className = 'row upcoming';
  row.innerHTML = `<time>${time}</time><div><b>${patient}</b><span>${service} · ${price} €</span></div><em>Guardada</em>`;
  document.getElementById('appointmentList').appendChild(row);
  status.textContent = `Cita de ${patient} guardada.`;
  document.getElementById('apptPatient').value = '';
  document.getElementById('apptTime').value = '';
});

const search = document.getElementById('patientSearch');
const filter = document.getElementById('patientFilter');
function filterPatients(){
  const term = search.value.toLowerCase();
  const value = filter.value;
  document.querySelectorAll('.patient-row').forEach(row => {
    const matchesText = row.textContent.toLowerCase().includes(term);
    const matchesFilter = value === 'all' || row.dataset.tags.includes(value);
    row.style.display = matchesText && matchesFilter ? 'grid' : 'none';
  });
}
search.addEventListener('input', filterPatients);
filter.addEventListener('change', filterPatients);

document.querySelectorAll('.open-patient').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('patientDetail').classList.remove('hidden');
    document.getElementById('patientName').textContent = btn.dataset.name;
    const invoiceBtn = document.getElementById('patientInvoiceBtn');
    invoiceBtn.dataset.client = btn.dataset.name;
  });
});
document.getElementById('closePatient').addEventListener('click', () => document.getElementById('patientDetail').classList.add('hidden'));
document.getElementById('patientInvoiceBtn').addEventListener('click', e => openInvoice(e.currentTarget.dataset.client, '60'));

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.invoice-row').forEach(row => {
      row.style.display = tab.dataset.filter === 'all' || row.dataset.state === tab.dataset.filter ? 'grid' : 'none';
    });
  });
});

const templates = {
  invoiceEmail:{
    title:'Email para enviar factura',
    subject:'Factura de la sesión',
    body:'Hola [Nombre],\\n\\nTe adjunto la factura correspondiente a la sesión realizada el [fecha].\\n\\nGracias y un saludo.'
  },
  paymentEmail:{
    title:'Recordatorio de pago',
    subject:'Recordatorio de factura pendiente',
    body:'Hola [Nombre],\\n\\nTe escribo para recordarte que la factura [número] continúa pendiente de pago.\\n\\nMuchas gracias.'
  },
  appointmentEmail:{
    title:'Recordatorio de cita',
    subject:'Recordatorio de tu próxima cita',
    body:'Hola [Nombre],\\n\\nTe recuerdo que tenemos una cita el [fecha] a las [hora].\\n\\nUn saludo.'
  },
  attendance:{
    title:'Justificante de asistencia',
    subject:'Justificante de asistencia',
    body:'Se certifica que [Nombre] ha asistido a consulta el día [fecha], en horario de [hora].'
  }
};
document.querySelectorAll('.use-template').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = templates[btn.dataset.template];
    document.getElementById('templateEditor').classList.remove('hidden');
    document.getElementById('templateTitle').textContent = t.title;
    document.getElementById('templateSubject').value = t.subject;
    document.getElementById('templateBody').value = t.body;
  });
});
document.getElementById('closeTemplate').addEventListener('click', () => document.getElementById('templateEditor').classList.add('hidden'));
document.getElementById('copyTemplate').addEventListener('click', async () => {
  const text = `Asunto: ${document.getElementById('templateSubject').value}\\n\\n${document.getElementById('templateBody').value}`;
  try{
    await navigator.clipboard.writeText(text);
    document.getElementById('templateStatus').textContent = 'Contenido copiado.';
  }catch{
    document.getElementById('templateStatus').textContent = 'Selecciona y copia el contenido manualmente.';
  }
});
document.getElementById('saveBusiness').addEventListener('click', () => {
  document.getElementById('businessStatus').textContent = 'Cambios guardados correctamente en esta demostración.';
});
