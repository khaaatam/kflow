// config.js - pusat settingan bot

// 1. DAFTAR USER (WHITELIST)
// format: 'nomor@c.us': 'panggilan'
const users = {
    '6289608506367@c.us': 'Tami',  // id utama lu
    '6283806618448@c.us': 'Dini'   // id dini
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
    apiKey: "AIzaSyD7C7AkOOUKfVAmylvb9UKYXlCjp_JpyCg", // <--- GANTI INI
    modelName: "gemini-2.5-flash-lite" // model trial lu
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

// export biar bisa dipake di file lain
module.exports = { users, database, ai, system };