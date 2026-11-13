// Service worker vacío que se elimina a sí mismo.
// Un service worker antiguo, registrado por otra aplicación en este mismo puerto
// de localhost, pide /sw.js de forma periódica. Este archivo lo desregistra.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => {
  self.registration.unregister();
});
