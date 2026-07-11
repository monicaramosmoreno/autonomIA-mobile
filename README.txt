AUTONOMIA MOBILE BETA 0.3
================================

CAMBIO DE ENFOQUE
- Facturación mensual a gabinetes.
- Conteo de sesiones por mes y gabinete.
- Tarifas por sesión.
- Creación de factura mensual.
- Google Calendar preparado para sincronización real.
- Modo demo de sincronización.
- Doctoralia queda fuera de esta versión.

ACTIVAR GOOGLE CALENDAR
1. Crear un proyecto en Google Cloud.
2. Activar Google Calendar API.
3. Configurar la pantalla de consentimiento OAuth.
4. Crear un Client ID de tipo Web application.
5. Añadir como origen autorizado la URL de Vercel.
6. Crear una API Key y restringirla a Calendar API y al dominio.
7. En la app: Mi negocio > Configuración de Google.
8. Introducir Client ID y API Key.
9. Pulsar Conectar Google Calendar.

CLASIFICACIÓN DE EVENTOS
En esta beta se reconocen las palabras:
- "Centro" -> Gabinete Centro
- "Norte" -> Gabinete Norte
Los demás eventos quedan como "Sin clasificar".

SEGURIDAD
No incluyas el Client Secret en esta app. Para aplicaciones web, Google utiliza
Client ID y API Key en el navegador. Restringe siempre la API Key por dominio y API.

NOTA
La integración usa acceso de solo lectura al calendario.
