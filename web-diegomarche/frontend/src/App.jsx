import React, { useEffect, useMemo, useState } from 'react'
import { listBooks, createBook, updateBook, deleteBook, getHealth } from './api'
import './styles.css'

// Nombre que se muestra en la cabecera (cambia según el frontend)
const CLIENTE = 'axios'

// Paleta de portadas: cada libro toma un color fijo según su título
const PORTADAS = [
  ['#7c2d12', '#c2410c'], ['#1e3a8a', '#3b82f6'], ['#14532d', '#16a34a'],
  ['#581c87', '#9333ea'], ['#7f1d1d', '#dc2626'], ['#134e4a', '#0d9488'],
  ['#713f12', '#ca8a04'], ['#312e81', '#6366f1'], ['#831843', '#db2777']
]
function portada(title = '') {
  let h = 0
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const [a, b] = PORTADAS[h % PORTADAS.length]
  return `linear-gradient(150deg, ${a}, ${b})`
}

function Estrellas({ valor }) {
  if (valor == null) return <span className="sin-rating">Sin calificar</span>
  const n = Number(valor)
  return (
    <span className="estrellas" title={`${n} de 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className="estrella">
          <span className="estrella-llena" style={{ width: `${Math.max(0, Math.min(1, n - i + 1)) * 100}%` }}>★</span>
          ★
        </span>
      ))}
      <b>{n.toFixed(1)}</b>
    </span>
  )
}

const VACIO = { title: '', author: '', genre: '', publishedYear: '', rating: '' }

function FormularioLibro({ inicial, onGuardar, onCerrar }) {
  const [f, setF] = useState(inicial ? {
    title: inicial.Title ?? '', author: inicial.Author ?? '', genre: inicial.Genre ?? '',
    publishedYear: inicial.PublishedYear ?? '', rating: inicial.Rating ?? ''
  } : VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    if (!f.title.trim() || !f.author.trim()) return setError('El título y el autor son obligatorios.')
    if (f.rating !== '' && (Number(f.rating) < 0 || Number(f.rating) > 5)) return setError('La calificación debe estar entre 0 y 5.')
    setGuardando(true)
    try {
      await onGuardar({
        title: f.title.trim(),
        author: f.author.trim(),
        genre: f.genre.trim() || null,
        publishedYear: f.publishedYear === '' ? null : Number(f.publishedYear),
        rating: f.rating === '' ? null : Number(f.rating)
      })
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCerrar])

  return (
    <div className="modal-fondo" onMouseDown={onCerrar}>
      <form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={enviar}>
        <div className="modal-portada" style={{ background: portada(f.title) }}>
          <span>{f.title || 'Nuevo libro'}</span>
          <small>{f.author || 'Autor'}</small>
        </div>
        <div className="modal-cuerpo">
          <h2>{inicial ? 'Editar libro' : 'Agregar libro'}</h2>
          <label>Título *<input autoFocus value={f.title} onChange={set('title')} placeholder="Ej. La Mañosa" maxLength={200} /></label>
          <label>Autor *<input value={f.author} onChange={set('author')} placeholder="Ej. Juan Bosch" maxLength={150} /></label>
          <div className="fila">
            <label>Género<input value={f.genre} onChange={set('genre')} placeholder="Novela" maxLength={100} /></label>
            <label>Año<input type="number" value={f.publishedYear} onChange={set('publishedYear')} placeholder="1936" /></label>
            <label>Calificación<input type="number" step="0.1" min="0" max="5" value={f.rating} onChange={set('rating')} placeholder="0 – 5" /></label>
          </div>
          {error && <div className="alerta alerta-error">{error}</div>}
          <div className="modal-acciones">
            <button type="button" className="btn btn-fantasma" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default function App() {
  const [filtros, setFiltros] = useState({ title: '', author: '', genre: '', year: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [health, setHealth] = useState(null)
  const [modal, setModal] = useState(null) // null | 'nuevo' | libro
  const [aviso, setAviso] = useState('')
  const [borrando, setBorrando] = useState(null)

  const fetchData = async (overridePage, overrideFiltros) => {
    setLoading(true)
    setError('')
    try {
      const res = await listBooks({ ...(overrideFiltros ?? filtros), page: overridePage ?? page, pageSize })
      setData({ items: Array.isArray(res.items) ? res.items : [], total: res.total ?? 0 })
    } catch (e) {
      setData({ items: [], total: 0 })
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page, pageSize])
  useEffect(() => { getHealth().then(setHealth).catch(() => setHealth(null)) }, [])
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(''), 2600)
    return () => clearTimeout(t)
  }, [aviso])

  const totalPaginas = Math.max(1, Math.ceil(data.total / pageSize))
  const promedio = useMemo(() => {
    const r = data.items.filter(b => b.Rating != null).map(b => Number(b.Rating))
    return r.length ? (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1) : '—'
  }, [data.items])
  const generos = useMemo(() => new Set(data.items.map(b => b.Genre).filter(Boolean)).size, [data.items])

  const buscar = (e) => {
    e.preventDefault()
    setPage(1)
    fetchData(1)
  }
  const limpiar = () => {
    const vacios = { title: '', author: '', genre: '', year: '' }
    setFiltros(vacios)
    setPage(1)
    fetchData(1, vacios)
  }
  const setFiltro = (k) => (e) => setFiltros({ ...filtros, [k]: e.target.value })

  const guardar = async (libro) => {
    if (modal === 'nuevo') {
      await createBook(libro)
      setAviso(`“${libro.title}” agregado`)
    } else {
      await updateBook(modal.Id, libro)
      setAviso(`“${libro.title}” actualizado`)
    }
    setModal(null)
    fetchData()
  }

  const eliminar = async (b) => {
    try {
      await deleteBook(b.Id)
      setBorrando(null)
      setAviso(`“${b.Title}” eliminado`)
      if (data.items.length === 1 && page > 1) setPage(page - 1)
      else fetchData()
    } catch (e) {
      setBorrando(null)
      setError(e.message)
    }
  }

  const hayFiltros = Object.values(filtros).some(Boolean)

  return (
    <>
      <header className="cabecera">
        <div className="contenedor cabecera-fila">
          <div className="marca">
            <span className="marca-icono">📚</span>
            <div>
              <strong>Biblioteca</strong>
              <small>React + {CLIENTE === 'axios' ? 'Axios' : 'Fetch'} · Express · SQL Server</small>
            </div>
          </div>
          <nav className="cabecera-acciones">
            {health && (
              <span className={`estado ${health.db === 'sqlserver' ? 'estado-ok' : 'estado-aviso'}`} title={health.note}>
                <i /> {health.db === 'sqlserver' ? 'SQL Server' : 'Modo memoria'}
              </span>
            )}
            <a className="btn btn-claro" href="/docs" target="_blank" rel="noreferrer">API · Swagger</a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="contenedor">
          <p className="hero-sup">Catálogo de libros</p>
          <h1>Tu estante, <em>ordenado.</em></h1>
          <p className="hero-texto">Busca, agrega, edita y elimina libros. Cada cambio se guarda en la base de datos a través de la API.</p>
          <div className="stats">
            <div className="stat"><b>{data.total}</b><span>{hayFiltros ? 'resultados' : 'libros en total'}</span></div>
            <div className="stat"><b>{promedio}</b><span>calificación promedio</span></div>
            <div className="stat"><b>{generos}</b><span>géneros en esta página</span></div>
          </div>
        </div>
      </section>

      <main className="contenedor principal">
        {health && health.db !== 'sqlserver' && (
          <div className="alerta alerta-aviso">
            El backend está en <b>modo memoria</b> (sin SQL Server). Los datos se guardan en <code>backend/data/books.json</code>.
            Para usar SQL Server ejecuta <code>crear-bd.bat</code> y revisa <code>SQLSERVER_SERVER</code> en <code>.env</code>.
          </div>
        )}

        <form className="buscador" onSubmit={buscar}>
          <div className="campo campo-grande">
            <span>🔎</span>
            <input placeholder="Buscar por título" value={filtros.title} onChange={setFiltro('title')} />
          </div>
          <input placeholder="Autor" value={filtros.author} onChange={setFiltro('author')} />
          <input placeholder="Género" value={filtros.genre} onChange={setFiltro('genre')} />
          <input placeholder="Año" type="number" value={filtros.year} onChange={setFiltro('year')} className="campo-anio" />
          <button type="submit" className="btn btn-oscuro">Buscar</button>
          {hayFiltros && <button type="button" className="btn btn-fantasma" onClick={limpiar}>Limpiar</button>}
        </form>

        <div className="barra">
          <h2>{hayFiltros ? 'Resultados' : 'Todos los libros'}</h2>
          <div className="barra-acciones">
            <button className="btn btn-fantasma" onClick={() => fetchData()} title="Recargar">↻ Recargar</button>
            <button className="btn btn-primario" onClick={() => setModal('nuevo')}>+ Agregar libro</button>
          </div>
        </div>

        {error && <div role="alert" className="alerta alerta-error">{error}</div>}

        {loading ? (
          <div className="rejilla">
            {Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => <div key={i} className="tarjeta esqueleto" />)}
          </div>
        ) : data.items.length === 0 && !error ? (
          <div className="vacio">
            <div className="vacio-icono">📖</div>
            <h3>No hay libros para mostrar</h3>
            <p>{hayFiltros ? 'Prueba con otros filtros.' : 'Agrega el primero para empezar tu catálogo.'}</p>
            {hayFiltros
              ? <button className="btn btn-fantasma" onClick={limpiar}>Limpiar filtros</button>
              : <button className="btn btn-primario" onClick={() => setModal('nuevo')}>+ Agregar libro</button>}
          </div>
        ) : (
          <div className="rejilla">
            {data.items.map(b => (
              <article key={b.Id} className="tarjeta">
                <div className="portada" style={{ background: portada(b.Title) }}>
                  <span className="portada-id">#{b.Id}</span>
                  <h3>{b.Title}</h3>
                  <p>{b.Author}</p>
                </div>
                <div className="tarjeta-cuerpo">
                  <div className="etiquetas">
                    {b.Genre && <span className="etiqueta">{b.Genre}</span>}
                    {b.PublishedYear && <span className="etiqueta etiqueta-anio">{b.PublishedYear}</span>}
                  </div>
                  <Estrellas valor={b.Rating} />
                  {borrando === b.Id ? (
                    <div className="confirmar">
                      <span>¿Eliminar?</span>
                      <button className="btn btn-peligro btn-chico" onClick={() => eliminar(b)}>Sí, eliminar</button>
                      <button className="btn btn-fantasma btn-chico" onClick={() => setBorrando(null)}>No</button>
                    </div>
                  ) : (
                    <div className="tarjeta-acciones">
                      <button className="btn btn-fantasma btn-chico" onClick={() => setModal(b)}>✎ Editar</button>
                      <button className="btn btn-fantasma btn-chico btn-texto-peligro" onClick={() => setBorrando(b.Id)}>Eliminar</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="paginacion">
          <button className="btn btn-fantasma" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Anterior</button>
          <span>Página <b>{page}</b> de <b>{totalPaginas}</b></span>
          <button className="btn btn-fantasma" disabled={page >= totalPaginas} onClick={() => setPage(page + 1)}>Siguiente →</button>
          <label className="por-pagina">
            Por página
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
              {[4, 8, 12, 20].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </main>

      <footer className="pie">
        <div className="contenedor">Proyecto Libros · Node.js + Express + SQL Server (stored procedures) + React</div>
      </footer>

      {modal && <FormularioLibro inicial={modal === 'nuevo' ? null : modal} onGuardar={guardar} onCerrar={() => setModal(null)} />}
      {aviso && <div className="toast">✓ {aviso}</div>}
    </>
  )
}
