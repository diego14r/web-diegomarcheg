import dotenv from 'dotenv';
dotenv.config();

const env = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || String(v).trim() === '' ? fallback : String(v).trim();
};

// SQLSERVER_AUTH:
//   windows -> usa tu usuario de Windows (Trusted_Connection); no necesita contraseña (por defecto)
//   sql     -> usuario y contraseña de SQL Server (p. ej. sa)
const authRaw = env('SQLSERVER_AUTH', 'windows').toLowerCase();
const auth = authRaw === 'sql' ? 'sql' : 'windows';

const server = env('SQLSERVER_SERVER', 'localhost');
const instanceName = env('SQLSERVER_INSTANCE', undefined); // ej: SQLEXPRESS
const portExplicit = env('SQLSERVER_PORT', undefined);     // solo si el usuario lo puso en .env
const serverHasInstance = server.includes('\\');            // ej: localhost\SQLEXPRESS o (localdb)\MSSQLLocalDB
const password = env('SQLSERVER_PASSWORD', '');

// DB_MODE:
//   auto      -> intenta SQL Server; si no se puede conectar, usa memoria (por defecto)
//   sqlserver -> solo SQL Server (falla si no está disponible)
//   memoria   -> solo memoria (no necesita SQL Server; guarda en data/books.json)
const dbModeRaw = env('DB_MODE', 'auto').toLowerCase();
const dbMode = ['auto', 'sqlserver', 'memoria'].includes(dbModeRaw) ? dbModeRaw : 'auto';

export const config = {
  app: {
    port: parseInt(env('APP_PORT', '3000'), 10) || 3000
  },
  dbMode,
  // Si la contraseña sigue siendo la de ejemplo, no tiene sentido intentar SQL Server con auth=sql en modo auto
  passwordIsPlaceholder: password === '' || password === 'TuPasswordAqui',
  db: {
    auth,
    server,
    // Con instancia con nombre (SQLEXPRESS) NO se debe fijar el puerto
    port: instanceName || serverHasInstance ? undefined : parseInt(portExplicit || '1433', 10) || 1433,
    portExplicit: !!portExplicit,
    user: env('SQLSERVER_USER', 'sa'),
    password,
    database: env('SQLSERVER_DATABASE', 'BooksDB'),
    // Nombre del driver ODBC (solo auth=windows). Si no se indica, se prueban varios automáticamente.
    odbcDriver: env('SQLSERVER_ODBC_DRIVER', undefined),
    // Si el usuario dejó los valores por defecto, se prueban también SQLEXPRESS y LocalDB
    serverIsDefault: server.toLowerCase() === 'localhost' && !instanceName && !portExplicit,
    options: {
      encrypt: env('SQLSERVER_ENCRYPT', 'false').toLowerCase() === 'true',
      trustServerCertificate: env('TRUST_SERVER_CERTIFICATE', 'true').toLowerCase() === 'true',
      ...(instanceName ? { instanceName } : {})
    },
    connectionTimeout: 6000,
    requestTimeout: 15000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  }
};
