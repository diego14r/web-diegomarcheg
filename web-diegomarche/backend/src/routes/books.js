import { Router } from 'express';
import { explainDbError } from '../db.js';
import { getRepo } from '../repo.js';

const router = Router();

// Respuesta de error uniforme: 503 si la BD no responde, 500 en otros casos
function sendError(res, err, message) {
  const info = explainDbError(err);
  const status = ['conexion', 'login', 'db', 'sp', 'tabla'].includes(info.kind) ? 503 : 500;
  res.status(status).json({ message, error: err.message, hint: info.hint });
}

function parseId(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) {
    res.status(400).json({ message: 'id inválido' });
    return null;
  }
  return id;
}

function validateBook({ title, author, rating, publishedYear }) {
  if (!title || String(title).trim().length === 0) return 'title es requerido';
  if (!author || String(author).trim().length === 0) return 'author es requerido';
  if (rating != null && rating !== '' && (Number.isNaN(Number(rating)) || Number(rating) < 0 || Number(rating) > 5)) return 'rating debe estar entre 0 y 5';
  if (publishedYear != null && publishedYear !== '' && !Number.isInteger(Number(publishedYear))) return 'publishedYear debe ser un número entero';
  return null;
}

/**
 * @swagger
 * tags:
 *   name: Books
 *   description: Operaciones sobre libros
 */

/**
 * @swagger
 * /api/books:
 *   get:
 *     summary: Listar libros
 *     tags: [Books]
 *     parameters:
 *       - in: query
 *         name: title
 *         schema: { type: string }
 *         description: Filtro por título (LIKE)
 *       - in: query
 *         name: author
 *         schema: { type: string }
 *         description: Filtro por autor (LIKE)
 *       - in: query
 *         name: genre
 *         schema: { type: string }
 *         description: Género exacto
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *         description: Año de publicación exacto
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Lista paginada de libros
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *                 total: { type: integer }
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Book'
 */
router.get('/', async (req, res) => {
  try {
    const { title, author, genre, year } = req.query;
    const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '10', 10) || 10, 1), 100);
    const yearNum = year ? parseInt(year, 10) : null;

    const { items, total } = await getRepo().list({
      title, author, genre,
      year: Number.isNaN(yearNum) ? null : yearNum,
      page, pageSize
    });

    res.json({ page, pageSize, total, items });
  } catch (err) {
    console.error(err);
    sendError(res, err, 'Error al obtener libros');
  }
});

/**
 * @swagger
 * /api/books/{id}:
 *   get:
 *     summary: Obtener un libro por ID
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Libro encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Book'
 *       404:
 *         description: No encontrado
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const book = await getRepo().get(id);
    if (!book) return res.status(404).json({ message: 'No encontrado' });
    res.json(book);
  } catch (err) {
    console.error(err);
    sendError(res, err, 'Error al obtener libro');
  }
});

/**
 * @swagger
 * /api/books:
 *   post:
 *     summary: Crear un libro
 *     tags: [Books]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookInput'
 *     responses:
 *       201:
 *         description: Creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Book'
 *       400:
 *         description: Datos inválidos
 */
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const invalid = validateBook(body);
    if (invalid) return res.status(400).json({ message: invalid });
    const { title, author, genre, publishedYear, rating } = body;
    const book = await getRepo().insert({ title: String(title).trim(), author: String(author).trim(), genre, publishedYear, rating });
    res.status(201).json(book);
  } catch (err) {
    console.error(err);
    sendError(res, err, 'Error al crear libro');
  }
});

/**
 * @swagger
 * /api/books/{id}:
 *   put:
 *     summary: Actualizar un libro
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookInput'
 *     responses:
 *       200:
 *         description: Actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Book'
 *       404:
 *         description: No encontrado
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const body = req.body || {};
    const invalid = validateBook(body);
    if (invalid) return res.status(400).json({ message: invalid });
    const { title, author, genre, publishedYear, rating } = body;
    const book = await getRepo().update(id, { title: String(title).trim(), author: String(author).trim(), genre, publishedYear, rating });
    if (!book) return res.status(404).json({ message: 'No encontrado' });
    res.json(book);
  } catch (err) {
    console.error(err);
    sendError(res, err, 'Error al actualizar libro');
  }
});

/**
 * @swagger
 * /api/books/{id}:
 *   delete:
 *     summary: Eliminar un libro
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Eliminado
 *       404:
 *         description: No encontrado
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const affected = await getRepo().remove(id);
    if (!affected) return res.status(404).json({ message: 'No encontrado' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    sendError(res, err, 'Error al eliminar libro');
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Book:
 *       type: object
 *       properties:
 *         Id: { type: integer }
 *         Title: { type: string }
 *         Author: { type: string }
 *         Genre: { type: string, nullable: true }
 *         PublishedYear: { type: integer, nullable: true }
 *         Rating: { type: number, format: float, nullable: true, description: "0 a 5" }
 *     BookInput:
 *       type: object
 *       properties:
 *         title: { type: string }
 *         author: { type: string }
 *         genre: { type: string, nullable: true }
 *         publishedYear: { type: integer, nullable: true }
 *         rating: { type: number, format: float, nullable: true, description: "0 a 5" }
 *       required: [title, author]
 */

export default router;
