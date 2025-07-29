const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const app = express();

// Middleware do obsługi danych z formularza
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Middleware do sesji
app.use(session({
    secret: 'tajny_klucz',
    resave: false,
    saveUninitialized: true,
}));

// Funkcja zabezpieczająca dostęp do chronionych tras
function ensureAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/');
}

// Funkcja sprawdzająca czy użytkownik to admin
function ensureAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.status(403).send('Brak uprawnień');
}

// Przykładowi użytkownicy z rolami
const users = [
    { 
        email: 'admin@example.com', 
        password: bcrypt.hashSync('admin123', 10),
        role: 'admin',
        name: 'Administrator'
    },
    { 
        email: 'user@example.com', 
        password: bcrypt.hashSync('user123', 10),
        role: 'user',
        name: 'Jan Kowalski'
    },
    { 
        email: 'anna@example.com', 
        password: bcrypt.hashSync('anna123', 10),
        role: 'user',
        name: 'Anna Nowak'
    },
    { 
        email: 'brajan.alterman@magtrans.eu', 
        password: bcrypt.hashSync('brajan123', 10),
        role: 'admin',
        name: 'Brajan Alterman'
    }
];


// Strona główna (formularz logowania)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard - przekierowanie na podstawie roli
app.get('/dashboard', ensureAuthenticated, (req, res) => {
    if (req.session.user.role === 'admin') {
        res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'user-dashboard.html'));
    }
});

// Admin dashboard (tylko dla adminów)
app.get('/admin-dashboard', ensureAuthenticated, ensureAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// User dashboard (dla zwykłych użytkowników)
app.get('/user-dashboard', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user-dashboard.html'));
});

// Strona dodawania zgłoszenia
app.get('/add-ticket', ensureAuthenticated, (req, res) => {
    res.redirect('https://docs.google.com/forms/d/e/1FAIpQLSdH3EXkliHICxTE3KldHeF_bVDV1mJwKm12AyejgkKGx43hCA/viewform?usp=dialog'); 
});

// Lista zgłoszeń - różna dla admina i użytkownika
app.get('/list-tickets', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'list-tickets.html'));
});

// API endpoint do pobierania zgłoszeń
const axios = require('axios'); // npm install axios

app.get('/api/tickets', ensureAuthenticated, async (req, res) => {
    try {
        const url = 'https://script.google.com/macros/s/AKfycbzilv-ZS1Umy_NzuBIeIG6YBUvltQkaK7dStexdj7ge/dev';
        const response = await axios.get(url);
        const entries = response.data;

        if (!Array.isArray(entries)) {
            throw new Error('Oczekiwano tablicy wyników z Google Apps Script');
        }

        const allTickets = entries.map(entry => ({
            id: entry["ID"],
            timestamp: entry["Sygnatura czasowa"],
            problem: entry["Problem"] || entry["Problem "] || "",
            description: entry["Opis problemu"] || entry["Opis problemu "] || "",
            email: entry["Adres e-mail"] || "",
            status: entry["Status"] || "",
            priority: entry["Priorytet"] || "",
            date: entry["Data"] || ""
        }));

        const visibleTickets = req.session.user.role === 'admin'
            ? allTickets
            : allTickets.filter(t => t.email === req.session.user.email);

        res.json(visibleTickets);

    } catch (err) {
        console.error('Błąd pobierania zgłoszeń:', err.message);
        res.status(500).send('Nie udało się pobrać zgłoszeń z Google Sheets.');
    }
});


/*
// API endpoint do pobierania statystyk (tylko admin)
app.get('/api/stats', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const sheetID = 'TWÓJ_ID_ARKUSZA';
        const url = `https://spreadsheets.google.com/feeds/list/${sheetID}/od6/public/values?alt=json`;
        const response = await axios.get(url);
        const entries = response.data.feed.entry;

        const tickets = entries.map(entry => ({
            status: entry.gsx$status.$t,
            date: entry.gsx$data.$t
        }));

        const today = new Date().toDateString();

        const stats = {
            total: tickets.length,
            open: tickets.filter(t => t.status === 'Otwarte').length,
            inProgress: tickets.filter(t => t.status === 'W trakcie').length,
            closed: tickets.filter(t => t.status === 'Rozwiązane').length,
            todayClosed: tickets.filter(t => {
                const ticketDate = new Date(t.date).toDateString();
                return t.status === 'Rozwiązane' && ticketDate === today;
            }).length
        };

        res.json(stats);
    } catch (err) {
        console.error('Błąd statystyk:', err.message);
        res.status(500).send('Nie udało się pobrać statystyk.');
    }
});
*/
// API endpoint do pobierania informacji o użytkowniku
app.get('/api/user', ensureAuthenticated, (req, res) => {
    res.json({
        email: req.session.user.email,
        name: req.session.user.name,
        role: req.session.user.role
    });
});

// Obsługa logowania
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);

    if (user && bcrypt.compareSync(password, user.password)) {
        req.session.user = user;
        res.redirect('/dashboard');
    } else {
        res.send(`
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Błąd logowania</title>
                <link rel="stylesheet" href="style.css">
            </head>
            <body>
                <div class="container">
                    <h1>❌ Błąd logowania</h1>
                    <p>Błędny email lub hasło</p>
                    <button onclick="location.href='/'">Spróbuj ponownie</button>
                </div>
            </body>
            </html>
        `);
    }
});


// Wylogowanie
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Serwowanie plików statycznych
app.use(express.static(path.join(__dirname, 'public')));

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
    console.log('Konta testowe:');
    console.log('Admin: admin@example.com / admin123');
    console.log('User: user@example.com / user123');
    console.log('User: anna@example.com / anna123');
});