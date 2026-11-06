// Función serverless de Vercel: reexporta el manejador de la API ya compilada (apps/api/dist).
// La compilación la hace el buildCommand de vercel.json; aquí no hay lógica.
const { default: manejador } = require('../apps/api/dist/serverless.js');

module.exports = manejador;
