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
    }
];

// Tymczasowa baza zgłoszeń (w przyszłości Google Sheets)
let tickets = [
    {
        id: 1,
        problem: 'Komputer',
        description: 'Komputer nie uruchamia się po wczorajszej aktualizacji systemu. Pojawia się niebieski ekran.',
        email: 'user@example.com',
        userEmail: 'user@example.com',
        date: new Date('2025-01-27T10:30:00Z').toISOString(),
        status: 'Otwarte',
        priority: 'Wysoki'
    },
    {
        id: 2,
        problem: 'Drukarka',
        description: 'Drukarka HP LaserJet nie drukuje dokumentów. Lampka błędu świeci się na czerwono.',
        email: 'anna@example.com',
        userEmail: 'anna@example.com',
        date: new Date('2025-01-26T14:15:00Z').toISOString(),
        status: 'W trakcie',
        priority: 'Normalny'
    },
    {
        id: 3,
        problem: 'Email',
        description: 'Nie mogę wysyłać emaili z Outlook. Otrzymuję błąd połączenia z serwerem.',
        email: 'user@example.com',
        userEmail: 'user@example.com',
        date: new Date('2025-01-25T09:45:00Z').toISOString(),
        status: 'Rozwiązane',
        priority: 'Normalny'
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
    res.sendFile(path.join(__dirname, 'public', 'add-ticket.html'));
});

// Lista zgłoszeń - różna dla admina i użytkownika
app.get('/list-tickets', ensureAuthenticated, (req, res) => {
    const userTickets = req.session.user.role === 'admin' 
        ? tickets 
        : tickets.filter(ticket => ticket.userEmail === req.session.user.email);
    
    res.sendFile(path.join(__dirname, 'public', 'list-tickets.html'));
});

// API endpoint do pobierania zgłoszeń
app.get('/api/tickets', ensureAuthenticated, (req, res) => {
    const userTickets = req.session.user.role === 'admin' 
        ? tickets 
        : tickets.filter(ticket => ticket.userEmail === req.session.user.email);
    
    res.json(userTickets);
});

// API endpoint do pobierania statystyk (tylko admin)
app.get('/api/stats', ensureAuthenticated, ensureAdmin, (req, res) => {
    const stats = {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'Otwarte').length,
        inProgress: tickets.filter(t => t.status === 'W trakcie').length,
        closed: tickets.filter(t => t.status === 'Rozwiązane').length,
        todayClosed: tickets.filter(t => {
            const today = new Date().toDateString();
            const ticketDate = new Date(t.date).toDateString();
            return t.status === 'Rozwiązane' && ticketDate === today;
        }).length
    };
    res.json(stats);
});

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

// Obsługa dodawania zgłoszenia
app.post('/submit-ticket', ensureAuthenticated, (req, res) => {
    const { problem, description, priority } = req.body;
    
    const newTicket = {
        id: tickets.length + 1,
        problem,
        description,
        email: req.session.user.email,
        userEmail: req.session.user.email,
        date: new Date().toISOString(),
        status: 'Otwarte',
        priority: priority || 'Normalny'
    };
    
    tickets.push(newTicket);
    
    res.send(`
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Zgłoszenie wysłane</title>
            <link rel="stylesheet" href="style.css">
        </head>
        <body>
            <div class="container">
                <h1>✅ Zgłoszenie wysłane</h1>
                <p>Twoje zgłoszenie zostało przyjęte i otrzymało numer #${newTicket.id}</p>
                <p>Oczekuj na kontakt od zespołu IT.</p>
                <button onclick="location.href='/dashboard'">Wróć do panelu</button>
                <button onclick="location.href='/list-tickets'">Zobacz swoje zgłoszenia</button>
            </div>
        </body>
        </html>
    `);
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