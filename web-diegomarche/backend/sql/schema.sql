-- Crear base de datos y tabla Books
IF DB_ID('BooksDB') IS NULL
BEGIN
    CREATE DATABASE BooksDB;
END
GO

USE BooksDB;
GO

IF OBJECT_ID('dbo.Books', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Books (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(200) NOT NULL,
        Author NVARCHAR(150) NOT NULL,
        Genre NVARCHAR(100) NULL,
        PublishedYear INT NULL,
        Rating DECIMAL(2,1) NULL CHECK (Rating BETWEEN 0 AND 5),
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Books_Title ON dbo.Books (Title);
    CREATE INDEX IX_Books_Author ON dbo.Books (Author);
END
GO
