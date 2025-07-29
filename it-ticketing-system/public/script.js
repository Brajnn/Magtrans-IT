const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { google } = require('googleapis');
const app = express();

// Middleware do obsługi danych z formularza
app.use(express.urlencoded({ extended: true }));

// Middleware do sesji
app.use(session({
    secret: 'tajny_klucz',
    resave: false,
    saveUninitialized: true,
}));

function ensureAuthenticated(req, res, next) {
    if (req.session.user) {
        return next(); // Użytkownik jest zalogowany
    }
    res.redirect('/'); // Jeśli nie jest zalogowany, przekieruj na stronę logowania
}

// Konfiguracja Google Sheets API
const sheets = google.sheets('v4');
const spreadsheetId = 'YOUR_SPREADSHEET_ID'; // Wstaw ID swojego arkusza Google

// Funkcja do zapisywania zgłoszenia w Google Sheets
async function saveTicketToGoogleSheets(ticket) {
    const auth = await google.auth.getClient({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const request = {
        spreadsheetId,
        range: 'A1', // Wstaw zakres, w którym mają być zapisywane dane
        valueInputOption: 'RAW',
        resource: {
            values: [
                [ticket.problem, ticket.description, ticket.email, new Date().toISOString()],
            ],
        },
        auth,
    };

    await sheets.spreadsheets.values.append(request);
}

// Strona logowania
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Strona dashboard
app.get('/dashboard', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Dodawanie zgłoszenia
app.post('/submit-ticket', ensureAuthenticated, async (req, res) => {
    const { problem, description, email } = req.body;
    const ticket = { problem, description, email };
    await saveTicketToGoogleSheets(ticket); // Zapisz zgłoszenie w Google Sheets
    res.send('Twoje zgłoszenie zostało przyjęte. Oczekuj na kontakt.');
});

// Wylogowanie
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.listen(3000, () => {
    console.log('Serwer działa na porcie 3000');
});
