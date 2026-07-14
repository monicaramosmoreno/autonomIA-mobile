AUTONOMIA MOBILE BETA 0.4
===========================

FUNCIONES
- Conexión real con Google Calendar mediante OAuth.
- Importación de eventos del mes seleccionado.
- Clasificación automática por gabinete.
- Conteo mensual de sesiones.
- Total mensual por gabinete.
- Creación y guardado local de facturas mensuales.
- Vista previa e impresión/PDF.
- Alta manual de sesiones y gabinetes.
- Recursos.
- Datos de negocio.
- Datos persistentes en el navegador mediante localStorage.

CONFIGURACIÓN
1. Abre config.js.
2. Sustituye:
   PEGA_AQUI_TU_CLIENT_ID.apps.googleusercontent.com
   PEGA_AQUI_TU_API_KEY
3. Sube todos los archivos al repositorio autonomIA-mobile.
4. Espera al despliegue automático de Vercel.
5. Abre la URL con ?v=04 la primera vez para evitar la caché antigua.

GOOGLE CLOUD
- Google Calendar API habilitada.
- Cliente OAuth tipo Aplicación web.
- Origen JavaScript autorizado:
  https://autonom-ia-mobile.vercel.app
- API Key restringida a Google Calendar API y:
  https://autonom-ia-mobile.vercel.app/*
- La cuenta que pruebe la app debe añadirse como usuario de prueba mientras OAuth esté en Testing.

CLASIFICACIÓN DE EVENTOS
La app examina el título, ubicación y descripción del evento.
Por defecto reconoce:
- "Centro" o "Gabinete Centro"
- "Norte" o "Gabinete Norte"

Puedes crear otros gabinetes y asignar palabras clave desde la propia app.

SEGURIDAD
- No uses ni publiques un Client Secret.
- La API Key aparece en el navegador por diseño; su seguridad depende de las restricciones configuradas en Google Cloud.
