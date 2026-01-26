require('dotenv').config(); // <--- BARIS SAKTI: Load .env

// 1. DAFTAR USER (WHITELIST)
const users = {
    '6289608506367@c.us': 'Tami',
    '62881081132332@c.us': "Tami2",
    '6283806618448@c.us': 'Dini'
};

// 2. DATABASE CONFIG
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

// 3. AI CONFIG (GEMINI)
const ai = {
    // SEKARANG DIA BACA DARI FILE .ENV (Bukan Hardcoded lagi)
    apiKey: process.env.GEMINI_API_KEY,
    modelName: "gemini-2.5-flash-lite" // Ganti ke model terbaru yang valid
};

// 4. SYSTEM CONFIG
const system = {
    port: 3000,
    logNumber: '62881081132332@c.us',
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
};

module.exports = { users, database, ai, system };