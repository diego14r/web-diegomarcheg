USE BooksDB;
GO

CREATE OR ALTER PROCEDURE dbo.Books_List
  @title NVARCHAR(200) = NULL,
  @author NVARCHAR(150) = NULL,
  @genre NVARCHAR(100) = NULL,
  @year INT = NULL,
  @page INT = 1,
  @pageSize INT = 10
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @offset INT = (CASE WHEN @page < 1 THEN 0 ELSE (@page - 1) * @pageSize END);

  ;WITH Filtered AS (
    SELECT *
    FROM dbo.Books
    WHERE (@title IS NULL OR Title LIKE '%' + @title + '%')
      AND (@author IS NULL OR Author LIKE '%' + @author + '%')
      AND (@genre IS NULL OR Genre = @genre)
      AND (@year IS NULL OR PublishedYear = @year)
  )
  SELECT Id, Title, Author, Genre, PublishedYear, Rating
  FROM Filtered
  ORDER BY Id
  OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

  SELECT COUNT(*) AS total
  FROM dbo.Books
  WHERE (@title IS NULL OR Title LIKE '%' + @title + '%')
    AND (@author IS NULL OR Author LIKE '%' + @author + '%')
    AND (@genre IS NULL OR Genre = @genre)
    AND (@year IS NULL OR PublishedYear = @year);
END
GO

CREATE OR ALTER PROCEDURE dbo.Books_Get
  @id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT Id, Title, Author, Genre, PublishedYear, Rating FROM dbo.Books WHERE Id = @id;
END
GO

CREATE OR ALTER PROCEDURE dbo.Books_Insert
  @title NVARCHAR(200),
  @author NVARCHAR(150),
  @genre NVARCHAR(100) = NULL,
  @year INT = NULL,
  @rating DECIMAL(2,1) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO dbo.Books (Title, Author, Genre, PublishedYear, Rating)
  VALUES (@title, @author, @genre, @year, @rating);
  SELECT SCOPE_IDENTITY() AS Id;
END
GO

CREATE OR ALTER PROCEDURE dbo.Books_Update
  @id INT,
  @title NVARCHAR(200),
  @author NVARCHAR(150),
  @genre NVARCHAR(100) = NULL,
  @year INT = NULL,
  @rating DECIMAL(2,1) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.Books
  SET Title = @title,
      Author = @author,
      Genre = @genre,
      PublishedYear = @year,
      Rating = @rating
  WHERE Id = @id;

  SELECT Id, Title, Author, Genre, PublishedYear, Rating FROM dbo.Books WHERE Id = @id;
END
GO

CREATE OR ALTER PROCEDURE dbo.Books_Delete
  @id INT
AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM dbo.Books WHERE Id = @id;
  SELECT @@ROWCOUNT AS affected;
END
GO
