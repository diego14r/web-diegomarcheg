// Conexión a SQL Server.
//   auth=windows -> driver nativo msnodesqlv8 (ODBC) con tu usuario de Windows (Trusted_Connection)
//   auth=sql     -> driver tedious con usuario y contraseña de SQL Server
import { config } from './config.js';

// Drivers ODBC que se prueban en orden (auth=windows) si no se indica SQLSERVER_ODBC_DRIVER
const ODBC_DRIVERS = [
  'ODBC Driver 18 for SQL Server',
  'ODBC Driver 17 for SQL Server',
  'SQL Server Native Client 11.0',
  'SQL Server'
];

let sql;            // módulo mssql ya cargado (sabor tedious o msnodesqlv8)
let pool;
let connecting;
let resolvedDriver; // driver ODBC que funcionó
let resolvedServer; // servidor con el que se logró conectar

export async function loadSql() {
  if (sql) return sql;
  if (config.db.auth === 'windows') {
    try {
      sql = (await import('mssql/msnodesqlv8.js')).default;
    } catch (err) {
      const e = new Error(`No se pudo cargar el driver de autenticación de Windows (msnodesqlv8): ${String(err.message).split('\n')[0]}`);
      e.code = 'EDRIVER';
      throw e;
    }
  } else {
    sql = (await import('mssql')).default;
  }
  return sql;
}

export function getSql() {
  if (!sql) throw new Error('Driver no cargado: llama a loadSql() primero');
  return sql;
}

export function serverLabel() {
  if (resolvedServer) return resolvedServer;
  const { server, port, options } = config.db;
  if (options.instanceName) return `${server}\\${options.instanceName}`;
  if (config.db.auth === 'windows' && !config.db.portExplicit) return server;
  return port ? `${server},${port}` : server;
}

// Servidores a probar con auth=windows. Si el usuario dejó los valores por defecto,
// también se prueban SQL Express y LocalDB, que son los más comunes en una laptop.
function windowsServerCandidates() {
  const first = serverLabel();
  const list = [first];
  if (config.db.serverIsDefault) list.push('localhost\\SQLEXPRESS', '(localdb)\\MSSQLLocalDB');
  return list;
}

function odbcConnStr(driver, server, database) {
  const { encrypt, trustServerCertificate } = config.db.options;
  let s = `Driver={${driver}};Server=${server};Database=${database};Trusted_Connection=Yes;`;
  // Solo los drivers ODBC 17/18 entienden estas opciones (el 18 cifra por defecto y exige confiar en el certificado local)
  if (/ODBC Driver 1[78]/i.test(driver)) {
    s += `Encrypt=${encrypt ? 'Yes' : 'No'};TrustServerCertificate=${trustServerCertificate ? 'Yes' : 'No'};`;
  }
  return s;
}

const msgOf = (err) => String((err && (err.message || (err.originalError && err.originalError.message))) || err);
const stateOf = (err) => (err && (err.sqlstate || (err.originalError && err.originalError.sqlstate))) || '';

export const isDriverMissing = (err) => stateOf(err) === 'IM002' || /no default driver|Data source name not found|driver.*(not found|no encontr)/i.test(msgOf(err));
export const isDbMissing = (err) => /cannot open database|no se puede abrir la base de datos/i.test(msgOf(err));
export const isLoginFailed = (err) => /login failed|error de inicio de sesi/i.test(msgOf(err)) && !isDbMissing(err);

function baseConfig(poolMax) {
  return {
    connectionTimeout: config.db.connectionTimeout,
    requestTimeout: config.db.requestTimeout,
    pool: { ...config.db.pool, ...(poolMax ? { max: poolMax, min: 0 } : {}) }
  };
}

// Crea y conecta un pool NUEVO (sin caché). `database` permite conectarse a master para crear la BD.
export async function createPool({ database = config.db.database, poolMax } = {}) {
  await loadSql();

  if (config.db.auth === 'sql') {
    const p = new sql.ConnectionPool({
      ...baseConfig(poolMax),
      user: config.db.user,
      password: config.db.password,
      server: config.db.server,
      port: config.db.port,
      database,
      options: config.db.options
    });
    return p.connect();
  }

  // ---- auth=windows (ODBC) ----
  const drivers = resolvedDriver ? [resolvedDriver] : (config.db.odbcDriver ? [config.db.odbcDriver] : ODBC_DRIVERS);
  const servers = resolvedServer ? [resolvedServer] : windowsServerCandidates();
  const tryConnect = (driver, server) =>
    new sql.ConnectionPool({ ...baseConfig(poolMax), connectionString: odbcConnStr(driver, server, database), options: {} }).connect();

  // 1) Encontrar un driver ODBC instalado (si falta, el error es inmediato: IM002)
  let driver = null;
  let lastErr = null;
  for (const d of drivers) {
    try {
      const p = await tryConnect(d, servers[0]);
      resolvedDriver = d;
      resolvedServer = servers[0];
      return p;
    } catch (err) {
      lastErr = err;
      if (isDriverMissing(err)) continue;
      driver = d; // el driver existe; el error es de servidor/BD/login
      break;
    }
  }
  if (!driver) {
    const e = new Error('No se encontró ningún driver ODBC de SQL Server en esta computadora.');
    e.code = 'EODBCDRIVER';
    e.originalError = lastErr;
    throw e;
  }
  resolvedDriver = driver;
  // El servidor respondió (existe) pero falta la BD o el login: no tiene sentido probar otros servidores
  if (isDbMissing(lastErr) || isLoginFailed(lastErr)) throw lastErr;

  // 2) Probar otros servidores típicos (SQLEXPRESS, LocalDB)
  for (const s of servers.slice(1)) {
    try {
      const p = await tryConnect(driver, s);
      resolvedServer = s;
      console.log(`[DB] Conectado usando el servidor "${s}". Para no volver a buscarlo, pon SQLSERVER_SERVER=${s} en .env.`);
      return p;
    } catch (err) {
      lastErr = err;
      if (isDbMissing(err) || isLoginFailed(err)) { resolvedServer = s; throw err; }
    }
  }
  throw lastErr;
}

// Pool compartido por la aplicación (se crea una vez y se reutiliza)
export async function getPool() {
  if (pool && pool.connected) return pool;
  if (connecting) return connecting;

  connecting = (async () => {
    const p = await createPool();
    // Si la conexión se cae más tarde, se descarta y se vuelve a crear en la siguiente petición
    p.on('error', (err) => {
      console.error('[DB] Error en el pool:', err.message);
      pool = undefined;
    });
    pool = p;
    return pool;
  })();

  try {
    return await connecting;
  } catch (err) {
    pool = undefined; // no dejar un pool roto en caché: se reintenta en la próxima petición
    throw err;
  } finally {
    connecting = undefined;
  }
}

export function getResolved() {
  return { driver: resolvedDriver, server: resolvedServer };
}

// Traduce errores típicos de SQL Server a un mensaje entendible
export function explainDbError(err) {
  const msg = msgOf(err);
  const code = err && (err.code || (err.originalError && err.originalError.code));
  const { database, user, auth } = config.db;
  const destino = serverLabel();

  if (code === 'EDRIVER') {
    return { kind: 'driver', hint: 'Falta el paquete msnodesqlv8 (driver para autenticación de Windows). Ejecuta "npm install" dentro de backend. Si no se puede instalar, usa SQLSERVER_AUTH=sql en .env (usuario y contraseña de SQL Server).' };
  }
  if (code === 'EODBCDRIVER' || isDriverMissing(err)) {
    return { kind: 'driver', hint: 'No hay ningún driver ODBC de SQL Server instalado (viene con SQL Server y con SSMS). Instala "Microsoft ODBC Driver 17 for SQL Server" o indica el nombre exacto en SQLSERVER_ODBC_DRIVER en .env.' };
  }
  if (isDbMissing(err)) {
    return { kind: 'db', hint: `La base de datos "${database}" no existe en ${destino}. Ejecuta crear-bd.bat (o "npm run crear-bd" dentro de backend).` };
  }
  if (code === 'ELOGIN' || isLoginFailed(err)) {
    if (auth === 'windows') {
      return { kind: 'login', hint: `SQL Server (${destino}) rechazó tu usuario de Windows. En SSMS entra con autenticación de Windows, ve a Seguridad → Inicios de sesión y verifica que tu usuario esté y tenga acceso; o cambia a SQLSERVER_AUTH=sql en .env con usuario y contraseña.` };
    }
    return { kind: 'login', hint: `Login fallido para el usuario "${user}". Revisa SQLSERVER_USER / SQLSERVER_PASSWORD en .env y que SQL Server tenga autenticación mixta ("SQL Server and Windows Authentication"). Si entras a SSMS con Windows, pon SQLSERVER_AUTH=windows en .env.` };
  }
  if (code === 'ESOCKET' || code === 'ETIMEOUT' || /ECONNREFUSED|failed to connect|timeout|ENOTFOUND|could not open a connection|error locating server|network-related|08001|no existe el servidor/i.test(msg)) {
    return { kind: 'conexion', hint: `No se pudo conectar a SQL Server en "${destino}". Verifica que el servicio SQL Server esté iniciado (services.msc) y que SQLSERVER_SERVER en .env sea el mismo nombre de servidor que usas en SSMS (por ejemplo localhost, localhost\\SQLEXPRESS o (localdb)\\MSSQLLocalDB).` };
  }
  if (/Could not find stored procedure|no se encontr.*procedimiento/i.test(msg)) {
    return { kind: 'sp', hint: 'Faltan los stored procedures. Ejecuta crear-bd.bat (o sql/procs.sql en SSMS).' };
  }
  if (/Invalid object name|nombre de objeto .* no v/i.test(msg)) {
    return { kind: 'tabla', hint: 'Falta la tabla dbo.Books. Ejecuta crear-bd.bat (o sql/schema.sql en SSMS).' };
  }
  return { kind: 'otro', hint: msg };
}
