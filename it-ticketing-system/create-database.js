// importujemy bibliotekę sqlite3
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Tworzymy połączenie z bazą danych (jeśli plik bazy nie istnieje, zostanie stworzony)
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Tworzymy tabelę użytkowników (jeśli nie istnieje)
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            password TEXT NOT NULL
        )
    `, (err) => {
        if (err) {
            console.error('Błąd przy tworzeniu tabeli:', err.message);
        } else {
            console.log('Tabela users została utworzona lub już istnieje.');
        }
    });
});

// Dodaj użytkownika przykładowego (opcjonalnie)
const bcrypt = require('bcryptjs');
const addUser = (email, password) => {
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword], function(err) {
        if (err) {
            console.error('Błąd przy dodawaniu użytkownika:', err.message);
        } else {
            console.log(`Użytkownik dodany z ID ${this.lastID}`);
        }
    });
};

// Dodaj przykładowego użytkownika (możesz to pominąć, jeśli nie chcesz dodawać)
addUser('admin@example.com', '12345');

// Zamykanie połączenia z bazą
db.close((err) => {
    if (err) {
        console.error('Błąd przy zamykaniu połączenia z bazą danych:', err.message);
    } else {
        console.log('Połączenie z bazą danych zostało zamknięte.');
    }
});
