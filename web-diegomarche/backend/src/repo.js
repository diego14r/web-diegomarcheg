// Capa de acceso a datos con dos implementaciones:
//   - sqlserver: usa los stored procedures de SQL Server (dbo.Books_*)
//   - memoria:   guarda los libros en data/books.json (no necesita SQL Server)
// El modo se decide una sola vez al arrancar (ver initRepo) según DB_MODE en .env.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { getPool, getSql, explainDbError, serverLabel } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'books.json');

// Mismos libros que sql/seed.sql
const SEED = [
  { Title: 'Cien años de soledad', Author: 'Gabriel García Márquez', Genre: 'Realismo mágico', PublishedYear: 1967, Rating: 4.7 },
  { Title: 'Don Quijote de la Mancha', Author: 'Miguel de Cervantes', Genre: 'Novela', PublishedYear: 1605, Rating: 4.5 },
  { Title: '1984', Author: 'George Orwell', Genre: 'Distopía', PublishedYear: 1949, Rating: 4.6 },
  { Title: 'El principito', Author: 'Antoine de Saint-Exupéry', Genre: 'Fábula', PublishedYear: 1943, Rating: 4.8 },
  { Title: 'Rayuela', Author: 'Julio Cortázar', Genre: 'Novela', PublishedYear: 1963, Rating: 4.3 },
  { Title: 'Enriquillo', Author: 'Manuel de Jesús Galván', Genre: 'Novela histórica', PublishedYear: 1882, Rating: 4.2 },
  { Title: 'Over', Author: 'Ramón Marrero Aristy', Genre: 'Novela social', PublishedYear: 1939, Rating: 4.1 }
];

// ---------------------------------------------------------------------------
// Implementación en memoria (persistida en data/books.json)
// ---------------------------------------------------------------------------
function createMemoryRepo() {
  let books = [];

  function load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (Array.isArray(parsed)) { books = parsed; return; }
      }
    } catch (e) {
      console.warn('[DB] data/books.json dañado, se vuelve a crear:', e.message);
    }
    books = SEED.map((b, i) => ({ Id: i + 1, ...b }));
    save();
  }

  function save() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(books, null, 2), 'utf8');
  }

  const norm = (s) => String(s ?? '').toLowerCase();
  const toRating = (r) => (r == null || r === '' ? null : Math.round(Number(r) * 10) / 10);
  const toYear = (y) => (y == null || y === '' ? null : parseInt(y, 10));
  const pick = (b) => ({ Id: b.Id, Title: b.Title, Author: b.Author, Genre: b.Genre, PublishedYear: b.PublishedYear, Rating: b.Rating });

  load();

  return {
    mode: 'memoria',
    async list({ title, author, genre, year, page, pageSize }) {
      const filtered = books.filter(b =>
        (!title || norm(b.Title).includes(norm(title))) &&
        (!author || norm(b.Author).includes(norm(author))) &&
        (!genre || b.Genre === genre) &&
        (year == null || b.PublishedYear === year)
      ).sort((a, b) => a.Id - b.Id);
      const offset = (page - 1) * pageSize;
      return { items: filtered.slice(offset, offset + pageSize).map(pick), total: filtered.length };
    },
    async get(id) {
      const b = books.find(x => x.Id === id);
      return b ? pick(b) : null;
    },
    async insert({ title, author, genre, publishedYear, rating }) {
      const Id = books.reduce((m, b) => Math.max(m, b.Id), 0) + 1;
      const b = { Id, Title: title, Author: author, Genre: genre || null, PublishedYear: toYear(publishedYear), Rating: toRating(rating) };
      books.push(b);
      save();
      return pick(b);
    },
    async update(id, { title, author, genre, publishedYear, rating }) {
      const b = books.find(x => x.Id === id);
      if (!b) return null;
      Object.assign(b, { Title: title, Author: author, Genre: genre || null, PublishedYear: toYear(publishedYear), Rating: toRating(rating) });
      save();
      return pick(b);
    },
    async remove(id) {
      const before = books.length;
      books = books.filter(x => x.Id !== id);
      if (books.length !== before) save();
      return before - books.length;
    }
  };
}

// ---------------------------------------------------------------------------
// Implementación SQL Server (stored procedures)
// ---------------------------------------------------------------------------
function createSqlRepo() {
  const sql = getSql();
  return {
    mode: 'sqlserver',
    async list({ title, author, genre, year, page, pageSize }) {
      const pool = await getPool();
      const result = await pool.request()
        .input('title', sql.NVarChar(200), title || null)
        .input('author', sql.NVarChar(150), author || null)
        .input('genre', sql.NVarChar(100), genre || null)
        .input('year', sql.Int, year ?? null)
        .input('page', sql.Int, page)
        .input('pageSize', sql.Int, pageSize)
        .execute('dbo.Books_List');
      const items = result.recordsets[0] || [];
      const total = result.recordsets[1]?.[0]?.total ?? 0;
      return { items, total };
    },
    async get(id) {
      const pool = await getPool();
      const result = await pool.request().input('id', sql.Int, id).execute('dbo.Books_Get');
      return result.recordset?.[0] ?? null;
    },
    async insert({ title, author, genre, publishedYear, rating }) {
      const pool = await getPool();
      const insertResult = await pool.request()
        .input('title', sql.NVarChar(200), title)
        .input('author', sql.NVarChar(150), author)
        .input('genre', sql.NVarChar(100), genre || null)
        .input('year', sql.Int, publishedYear || null)
        .input('rating', sql.Decimal(2, 1), rating != null && rating !== '' ? Number(rating) : null)
        .execute('dbo.Books_Insert');
      const newId = Number(insertResult.recordset?.[0]?.Id);
      if (!newId) throw new Error('No se pudo obtener el ID insertado');
      return this.get(newId);
    },
    async update(id, { title, author, genre, publishedYear, rating }) {
      const pool = await getPool();
      const result = await pool.request()
        .input('id', sql.Int, id)
        .input('title', sql.NVarChar(200), title)
        .input('author', sql.NVarChar(150), author)
        .input('genre', sql.NVarChar(100), genre || null)
        .input('year', sql.Int, publishedYear || null)
        .input('rating', sql.Decimal(2, 1), rating != null && rating !== '' ? Number(rating) : null)
        .execute('dbo.Books_Update');
      return result.recordset?.[0] ?? null;
    },
    async remove(id) {
      const pool = await getPool();
      const del = await pool.request().input('id', sql.Int, id).execute('dbo.Books_Delete');
      return del.recordset?.[0]?.affected ?? 0;
    }
  };
}

// ---------------------------------------------------------------------------
// Selección del modo al arrancar
// ---------------------------------------------------------------------------
let repo = null;
let startupNote = '';

export async function initRepo() {
  const { dbMode, passwordIsPlaceholder, db } = config;

  if (dbMode === 'memoria') {
    repo = createMemoryRepo();
    startupNote = 'DB_MODE=memoria en .env: los datos se guardan en data/books.json (no se usa SQL Server).';
    return repo;
  }

  if (dbMode === 'auto' && db.auth === 'sql' && passwordIsPlaceholder) {
    repo = createMemoryRepo();
    startupNote = 'SQLSERVER_AUTH=sql pero SQLSERVER_PASSWORD no está configurada en .env, así que se usa el modo memoria (data/books.json). '
      + 'Pon tu contraseña (o usa SQLSERVER_AUTH=windows) y ejecuta crear-bd.bat.';
    return repo;
  }

  try {
    await getPool();
    repo = createSqlRepo();
    startupNote = `Conectado a SQL Server (${serverLabel()}, base de datos ${db.database}, autenticación ${db.auth === 'windows' ? 'de Windows' : 'de SQL Server'}).`;
    return repo;
  } catch (err) {
    const hint = explainDbError(err).hint;
    if (dbMode === 'sqlserver') {
      startupNote = `No se pudo conectar a SQL Server y DB_MODE=sqlserver no permite el modo memoria. ${hint}`;
      throw err;
    }
    repo = createMemoryRepo();
    startupNote = `No se pudo conectar a SQL Server (${err.message}). Se usa el modo memoria (data/books.json). ${hint}`;
    return repo;
  }
}

export function getRepo() {
  if (!repo) throw new Error('Repositorio no inicializado: llama a initRepo() primero');
  return repo;
}

export function getMode() {
  return repo ? repo.mode : 'iniciando';
}

export function getStartupNote() {
  return startupNote;
}
