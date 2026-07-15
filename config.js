require('dotenv').config();

const parseList = (value, fallback = []) => {
    if (!value) return fallback;
    return value.split(',').map(v => v.trim()).filter(Boolean);
};

const parseUsersMap = (value, fallback = {}) => {
    if (!value) return fallback;

    const result = {};
    value.split(',').forEach(pair => {
        const [id, name] = pair.split(':').map(v => v && v.trim());
        if (id && name) result[id] = name;
    });

    return Object.keys(result).length ? result : fallback;
};

const creator = parseList(process.env.BOT_CREATORS, ['JikaeL']);

const botName = process.env.BOT_NAME || 'JikaeLBot';

const users = parseUsersMap(process.env.BOT_USERS, {});

const ownerNumber = parseList(process.env.BOT_OWNER_NUMBERS, []);

const database = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kflow_db',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 3),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

const ai = {
    apiKey: process.env.ROUTER_API_KEY,
    routerUrl: process.env.ROUTER_URL || 'http://localhost:20128/v1',
    modelName: process.env.ROUTER_MODEL || 'mimo/mimo-v2-flash'
};

const puppeteerExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
const defaultPuppeteerArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote'
];

const system = {
    port: Number(process.env.PORT || 3000),
    logNumber: process.env.LOG_NUMBER || '62881081132332@c.us',
    dashboardPassword: process.env.DASHBOARD_PASSWORD || '',
    puppeteer: {
        ...(puppeteerExecutablePath ? { executablePath: puppeteerExecutablePath } : {}),
        headless: process.env.PUPPETEER_HEADLESS ? process.env.PUPPETEER_HEADLESS === 'true' : true,
        args: parseList(process.env.PUPPETEER_ARGS, defaultPuppeteerArgs)
    }
};

module.exports = { creator, botName, users, ownerNumber, database, ai, system };

// --- ENV VALIDATION (startup warning) ---
const logger = require('./lib/logger');
const missing = [];
if (!process.env.BOT_USERS) missing.push('BOT_USERS');
if (!process.env.BOT_OWNER_NUMBERS) missing.push('BOT_OWNER_NUMBERS');
if (!process.env.ROUTER_API_KEY) missing.push('ROUTER_API_KEY');
if (!process.env.DB_HOST) missing.push('DB_HOST');
if (missing.length) {
    logger.warn(`⚠️ Missing env vars: ${missing.join(', ')}. Check .env file!`);
}
if (Object.keys(users).length === 0) {
    logger.warn('⚠️ BOT_USERS kosong! Tidak ada user terdaftar. Bot tidak akan bisa memproses pesan.');
}
if (ownerNumber.length === 0) {
    logger.warn('⚠️ BOT_OWNER_NUMBERS kosong! Owner commands (!update, !restart) tidak akan bisa diakses.');
}
