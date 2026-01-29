require('dotenv').config();

// 1. DAFTAR USER (WHITELIST - Buat Nama doang)
const users = {
    '6289608506367@c.us': 'Tami',
    '62881081132332@c.us': "Tami2",
    '6283806618448@c.us': 'Dini'
};

// 2. DAFTAR OWNER/ADMIN (PENTING! INI YANG BOLEH PAKE !update)
// Masukin angkanya aja tanpa @c.us
const ownerNumber = [
    '6289608506367', // Tami Utama
    '62881081132332' // Tami Cadangan
];

// 3. DATABASE CONFIG
const database = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kflow_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

// 4. AI CONFIG (GEMINI)
const ai = {
    apiKey: process.env.GEMINI_API_KEY,
    modelName: "gemini-2.0-flash-lite" // Ganti ke model yang valid/terbaru
};

// 5. SYSTEM CONFIG
const system = {
    port: 3000,
    logNumber: '62881081132332@c.us',
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote'
        ]
    }
};

// 👇 JANGAN LUPA EXPORT 'ownerNumber' DISINI!
module.exports = { users, ownerNumber, database, ai, system };