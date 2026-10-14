import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJsdoc from 'swagger-jsdoc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'API de Libros',
      description: 'Backend REST para gestionar libros (Node.js + SQL Server) usando Stored Procedures',
      version: '1.2.0'
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Desarrollo local' }
    ]
  },
  // Rutas absolutas: funciona sin importar desde qué carpeta se ejecute `node`
  apis: [path.join(__dirname, 'routes', '*.js'), path.join(__dirname, 'index.js')]
};

export const swaggerSpec = swaggerJsdoc(options);
