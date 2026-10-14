USE BooksDB;
GO

-- Solo inserta los datos si la tabla está vacía (se puede ejecutar varias veces sin duplicar)
IF NOT EXISTS (SELECT 1 FROM dbo.Books)
BEGIN
  INSERT INTO dbo.Books (Title, Author, Genre, PublishedYear, Rating) VALUES
  (N'Cien años de soledad', N'Gabriel García Márquez', N'Realismo mágico', 1967, 4.7),
  (N'Don Quijote de la Mancha', N'Miguel de Cervantes', N'Novela', 1605, 4.5),
  (N'1984', N'George Orwell', N'Distopía', 1949, 4.6),
  (N'El principito', N'Antoine de Saint-Exupéry', N'Fábula', 1943, 4.8),
  (N'Rayuela', N'Julio Cortázar', N'Novela', 1963, 4.3),
  (N'Enriquillo', N'Manuel de Jesús Galván', N'Novela histórica', 1882, 4.2),
  (N'Over', N'Ramón Marrero Aristy', N'Novela social', 1939, 4.1);
END
GO
