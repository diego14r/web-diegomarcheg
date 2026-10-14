# Biblioteca — Gestión de libros

Aplicación web académica para administrar un catálogo de libros: listar, buscar, agregar, editar y eliminar. El frontend consume una API REST hecha en Node.js y Express, y los datos se guardan en Microsoft SQL Server a través de procedimientos almacenados.

## Tecnologías

- **Frontend:** React, Vite y Axios
- **Backend:** JavaScript, Node.js y Express
- **Base de datos:** Microsoft SQL Server (procedimientos almacenados)
- **Conexión a base de datos:** `mssql`, `msnodesqlv8` y autenticación de Windows
- **Documentación de la API:** Swagger (`swagger-jsdoc` y `swagger-ui-express`)

## Estructura

```
├── backend/
│   ├── sql/
│   │   ├── schema.sql      Base de datos BooksDB y tabla dbo.Books
│   │   ├── procs.sql       Procedimientos almacenados (Books_List, Get, Insert, Update, Delete)
│   │   └── seed.sql        Datos de ejemplo
│   ├── src/
│   │   ├── index.js        Servidor Express
│   │   ├── config.js       Configuración leída de .env
│   │   ├── db.js           Conexión a SQL Server
│   │   ├── repo.js         Acceso a datos
│   │   ├── crear-bd.js     Script que crea la base de datos
│   │   ├── swagger.js      Configuración de Swagger
│   │   └── routes/books.js Rutas de la API
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx         Interfaz principal
│   │   ├── api.js          Llamadas a la API con Axios
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.js      Proxy de /api hacia el backend
│   └── package.json
├── iniciar-todo.bat        Instala, crea la BD y levanta todo
└── crear-bd.bat            Solo crea la base de datos
```

## Requisitos

- [Node.js](https://nodejs.org) 18 o superior
- SQL Server (Developer, Express o LocalDB) con acceso mediante autenticación de Windows

## Cómo ejecutarlo

### Opción rápida (Windows)

Doble clic en **`iniciar-todo.bat`**. Instala las dependencias la primera vez, crea la base de datos `BooksDB` y abre el backend, el frontend y el navegador.

### Opción manual

```bash
# 1. Backend
cd backend
npm install
npm run crear-bd     # crea BooksDB, la tabla, los procedimientos y los datos
npm run dev          # http://localhost:3000

# 2. Frontend (en otra terminal)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

También se pueden ejecutar los scripts de `backend/sql` en SSMS, en este orden: `schema.sql`, `procs.sql`, `seed.sql`.

## Configuración

El archivo `backend/.env` ya viene listo para autenticación de Windows. Lo único que puede hacer falta cambiar es el nombre del servidor:

| Variable | Descripción |
|----------|-------------|
| `SQLSERVER_SERVER` | Nombre del servidor tal como se escribe en SSMS (`localhost`, `localhost\SQLEXPRESS`, `(localdb)\MSSQLLocalDB`). Con `localhost` también se prueban SQLEXPRESS y LocalDB. |
| `SQLSERVER_AUTH` | `windows` (por defecto) o `sql` para usar `SQLSERVER_USER` y `SQLSERVER_PASSWORD`. |
| `SQLSERVER_DATABASE` | Nombre de la base de datos (`BooksDB`). |
| `APP_PORT` | Puerto del backend (`3000`). |
| `DB_MODE` | `auto` (por defecto): si no hay SQL Server disponible, usa un archivo local `data/books.json`. `sqlserver`: solo SQL Server. |

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/books` | Lista paginada. Filtros: `title`, `author`, `genre`, `year`, `page`, `pageSize` |
| GET | `/api/books/:id` | Obtener un libro |
| POST | `/api/books` | Crear (`title` y `author` obligatorios) |
| PUT | `/api/books/:id` | Actualizar |
| DELETE | `/api/books/:id` | Eliminar |
| GET | `/health` | Estado del backend |

Documentación interactiva: http://localhost:3000/docs

## Problemas comunes

- **No se pudo conectar a SQL Server:** verificar que el servicio esté iniciado y que `SQLSERVER_SERVER` sea el mismo nombre que se usa en SSMS.
- **Login fallido con usuario de Windows:** en SSMS, revisar en Seguridad → Inicios de sesión que el usuario de Windows tenga acceso.
- **No hay driver ODBC:** instalar *Microsoft ODBC Driver 17 for SQL Server*.
- **`nodemon` o `vite` no se reconoce:** falta ejecutar `npm install` en esa carpeta.
