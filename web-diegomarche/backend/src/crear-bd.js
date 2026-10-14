// Crea la base de datos BooksDB, la tabla, los stored procedures y los datos de ejemplo
// ejecutando sql/schema.sql, sql/procs.sql y sql/seed.sql con la misma conexión que usa el backend.
// Uso:  npm run crear-bd      (o doble clic en crear-bd.bat en la carpeta raíz)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { createPool, explainDbError, getResolved } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.join(__dirname, '..', 'sql');
const FILES = ['schema.sql', 'procs.sql', 'seed.sql'];

// Divide un script en lotes separados por líneas "GO" (como hace SSMS / sqlcmd)
function splitBatches(text) {
  return text
    .replace(/^﻿/, '') // BOM
    .split(/^\s*GO\s*(?:\d+\s*)?$/gim)
    .map(b => b.trim())
    .filter(b => b.length > 0);
}

async function main() {
  console.log(`Creando la base de datos "${config.db.database}" en SQL Server (autenticación ${config.db.auth === 'windows' ? 'de Windows' : 'de SQL Server'})...`);

  let pool;
  try {
    // Se conecta a master porque BooksDB puede no existir todavía.
    // Un solo canal (poolMax: 1) para que el "USE BooksDB" de los scripts se mantenga entre lotes.
    pool = await createPool({ database: 'master', poolMax: 1 });
  } catch (err) {
    console.error('\n✘ No se pudo conectar a SQL Server.');
    console.error('  Detalle:', err.message);
    console.error('  Qué hacer:', explainDbError(err).hint, '\n');
    process.exit(1);
  }

  const r = getResolved();
  console.log(`Conectado a "${r.server}"${r.driver ? ` (driver: ${r.driver})` : ''}.`);

  try {
    for (const file of FILES) {
      const text = fs.readFileSync(path.join(SQL_DIR, file), 'utf8');
      const batches = splitBatches(text);
      process.stdout.write(`  ${file} (${batches.length} lotes)... `);
      for (const batch of batches) {
        await pool.request().batch(batch);
      }
      console.log('OK');
    }
    const check = await pool.request().query(`SELECT COUNT(*) AS n FROM ${config.db.database}.dbo.Books`);
    console.log(`\n✔ Base de datos ${config.db.database} lista con ${check.recordset[0].n} libros.`);
    if (r.server && r.server !== config.db.server && config.db.serverIsDefault) {
      console.log(`  Consejo: pon SQLSERVER_SERVER=${r.server} en .env para que el backend no tenga que buscarlo.`);
    }
    console.log('  Ahora inicia el backend (npm run dev) y debe decir "Conectado a SQL Server".');
  } catch (err) {
    console.error('\n✘ Error ejecutando los scripts SQL:', err.message);
    console.error('  Qué hacer:', explainDbError(err).hint);
    process.exitCode = 1;
  } finally {
    await pool.close().catch(() => {});
  }
}

main();
