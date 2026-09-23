/// CORS para la API — la app Flutter web (localhost en dev, su dominio
/// en prod) llama /api/* desde el navegador y el preflight OPTIONS debe
/// responder antes de que caiga al SPA. Auth es por Bearer token, no
/// cookies, así que Allow-Origin: * no abre riesgo de sesión cruzada.
export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/')) return;

  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  });

  if (event.method === 'OPTIONS') {
    event.node.res.statusCode = 204;
    return '';
  }
});
