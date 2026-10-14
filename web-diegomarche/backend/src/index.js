import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';
import { config } from './config.js';
import { initRepo, getMode, getStartupNote } from './repo.js';
import booksRouter from './routes/books.js';

const app = express();

// CSP desactivado: en desarrollo (http://localhost) bloquea los recursos de Swagger UI
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 60 * 1000, max: 200 }));

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Estado del backend y modo de base de datos
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: "ok. db = sqlserver | memoria"
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: getMode(), note: getStartupNote() });
});

app.use('/api/books', booksRouter);

// Swagger Dark Mode CSS
const swaggerDarkCss = `
:root{--bg:#0f172a;--text:#e2e8f0;--panel:#111827;--accent:#3b82f6;}
html{background:var(--bg);} body{background:var(--bg)!important;color:var(--text)!important;}
.swagger-ui .topbar{background-color:var(--panel);} .swagger-ui .info{color:var(--text);}
.swagger-ui .info .title,.swagger-ui .info p,.swagger-ui .opblock-tag,.swagger-ui .opblock .opblock-summary-description,.swagger-ui table thead tr th,.swagger-ui .parameter__name,.swagger-ui .parameter__type,.swagger-ui .response-col_status,.swagger-ui .model-title,.swagger-ui .model,.swagger-ui label{color:var(--text)!important;}
.swagger-ui .scheme-container,.swagger-ui .opblock{background-color:var(--panel);}
.swagger-ui .opblock-summary{background-color:#1f2937;color:var(--text);}
.swagger-ui .opblock-summary-method{background-color:var(--accent);}
.swagger-ui .response-col_description__inner,.swagger-ui .tab,.swagger-ui .btn,.swagger-ui .btn.execute{color:var(--text);background-color:#1f2937;border-color:#374151;}
.swagger-ui .microlight{background-color:#0b1221;color:#93c5fd;}
.swagger-ui input[type=text],.swagger-ui textarea,.swagger-ui select{background:#1f2937;color:var(--text);border-color:#374151;}
`;

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customCss: swaggerDarkCss, customSiteTitle: 'API Libros - Docs (Dark)' }));

app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no definida' });
});

// JSON mal formado y otros errores no controlados
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON inválido' });
  console.error(err);
  res.status(500).json({ message: 'Error interno', error: err.message });
});

// Que un error suelto no tumbe el servidor
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));

const port = config.app.port;

async function main() {
  if (config.dbMode !== 'memoria' && !(config.dbMode === 'auto' && config.db.auth === 'sql' && config.passwordIsPlaceholder)) {
    console.log(`[DB] Conectando a SQL Server (${config.db.auth === 'windows' ? 'autenticación de Windows' : 'usuario ' + config.db.user})...`);
  }

  try {
    await initRepo();
  } catch (err) {
    console.error('\n[DB] ✘', getStartupNote(), '\n');
    process.exit(1);
  }

  if (getMode() === 'sqlserver') {
    console.log(`[DB] ✔ ${getStartupNote()}`);
  } else {
    console.log('\n[DB] ⚠ MODO MEMORIA (sin SQL Server):', getStartupNote(), '\n');
  }

  const server = app.listen(port, () => {
    console.log(`Backend http://localhost:${port}/health`);
    console.log(`Swagger http://localhost:${port}/docs`);
    console.log(`API     http://localhost:${port}/api/books`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`El puerto ${port} ya está en uso. Cierra el otro proceso o cambia APP_PORT en .env.`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}

main();
