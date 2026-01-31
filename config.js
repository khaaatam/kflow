require('dotenv').config();

// 1. DAFTAR USER (Whitelist Nama)
const users = {
    '6289608506367@c.us': 'Tami',
    '62881081132332@c.us': "Tami2",
    '6283806618448@c.us': 'Dini'
};

// 2. DAFTAR OWNER (Wajib isi angka saja)
const ownerNumber = [
    '6289608506367',
    '62881081132332'
];

// 3. DATABASE
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

// 4. AI CONFIG
const ai = {
    apiKey: process.env.GEMINI_API_KEY,
    modelName: "gemini-2.5-pro"
};

// 5. SYSTEM CONFIG
const system = {
    port: 3000,
    logNumber: '62881081132332@c.us', // Nomor buat laporan error/startup
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

module.exports = { users, ownerNumber, database, ai, system };