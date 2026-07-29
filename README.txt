AUTONOMIA PWA · BETA 0.9 ARI + GOOGLE CALENDAR
===============================================

QUÉ ES
Una aplicación web progresiva (PWA): funciona en móvil y ordenador y se puede
instalar como una app sin mantener dos proyectos distintos.

MEJORAS DE ESTA VERSIÓN
- Diseño responsive para móvil y escritorio.
- Nueva identidad visual y navegación más clara.
- Panel de inicio con métricas y accesos rápidos.
- Ari como función principal: nota de voz o texto > borrador de informe.
- Grabación local de voz demostrativa mediante el micrófono.
- Mensajes explícitos sobre privacidad y revisión profesional.
- Se mantienen calendario, sesiones, gabinetes, facturas, PDF y recursos.
- «Mi negocio» vuelve a estar visible en la navegación móvil.
- Datos fiscales ampliados y serie de facturación configurable.
- Los datos guardados se incorporan a la vista previa de las facturas.

NOVEDADES DE ARI

- Dictado de voz en Chrome y Edge mediante reconocimiento del navegador.
- Ejemplos ficticios para psicología, logopedia y fisioterapia.
- Informe estructurado, editable, guardable y descargable.
- Eliminación de la nota y del borrador almacenado localmente.

IMPORTANTE SOBRE ARI
La interfaz y el flujo están preparados, pero esta beta no envía el audio ni
realiza una transcripción real. Para producción se necesita un backend seguro
que transcriba, genere el informe, gestione permisos y almacene los documentos
cifrados. No se debe incluir una clave privada de IA en app.js o config.js.

CONFIGURACIÓN DE GOOGLE CALENDAR
1. Abre config.js y completa GOOGLE_CLIENT_ID.
2. Activa Google Calendar API en el mismo proyecto de Google Cloud.
3. Añade la dirección publicada en “Orígenes autorizados de JavaScript”.
4. No añadas nunca un Client Secret al proyecto público.

IMPORTANTE PARA PROBAR LA CONEXIÓN
Google no permite iniciar sesión si abres index.html directamente desde una
carpeta o desde el ZIP. La aplicación debe abrirse desde una URL autorizada,
como la versión publicada en Sites o Vercel.

La conexión solicita únicamente permiso de lectura. El token de Google se
mantiene en memoria y no se guarda en el dispositivo.

DESPLIEGUE
Sube todos los archivos juntos a Vercel o cualquier alojamiento estático. Abre
la URL una primera vez con ?v=09 para evitar la caché de versiones anteriores.
