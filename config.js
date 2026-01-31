require('dotenv').config();

const users = {
    '6289608506367@c.us': 'Tami',
    '62881081132332@c.us': "Tami2",
    '6283806618448@c.us': 'Dini'
};

const ownerNumber = [
    '6289608506367',
    '62881081132332'
];

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

const ai = {
    apiKey: process.env.GEMINI_API_KEY,
    modelName: "gemini-2.5-pro"
};

const system = {
    port: 3000,
    logNumber: '62881081132332@c.us',
    puppeteer: {
        executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
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