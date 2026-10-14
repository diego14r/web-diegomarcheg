import axios from 'axios';

const api = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' }, timeout: 20000 });

// Convierte cualquier fallo en un mensaje claro para el usuario
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const body = error.response && error.response.data;
    if (body && (body.message || body.hint)) {
      return Promise.reject(new Error([body.message, body.hint].filter(Boolean).join(' — ')));
    }
    if (!error.response || error.response.status >= 500) {
      return Promise.reject(new Error('El backend no responde. Inicia backend (npm run dev) y revisa su consola.'));
    }
    return Promise.reject(new Error(`Error ${error.response.status}`));
  }
);

// Estado del backend: { status, db: 'sqlserver' | 'memoria', note }
export async function getHealth() {
  const { data } = await axios.get('/health', { timeout: 10000 });
  return data;
}

export async function listBooks({ title, author, genre, year, page = 1, pageSize = 10 } = {}) {
  const params = {};
  if (title) params.title = title;
  if (author) params.author = author;
  if (genre) params.genre = genre;
  if (year) params.year = year;
  params.page = page;
  params.pageSize = pageSize;
  const { data } = await api.get('/books', { params });
  return data;
}

export async function getBook(id) {
  const { data } = await api.get(`/books/${id}`);
  return data;
}

export async function createBook({ title, author, genre, publishedYear, rating }) {
  const { data } = await api.post('/books', { title, author, genre, publishedYear, rating });
  return data;
}

export async function updateBook(id, { title, author, genre, publishedYear, rating }) {
  const { data } = await api.put(`/books/${id}`, { title, author, genre, publishedYear, rating });
  return data;
}

export async function deleteBook(id) {
  await api.delete(`/books/${id}`);
  return true;
}
