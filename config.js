require('dotenv').config();

const parseList = (value, fallback = []) => {
    if (!value) return fallback;
    return value.split(',').map(v => v.trim()).filter(Boolean);
};

const parseUsersMap = (value, fallback = {}) => {
    if (!value) return fallback;

    const result = {};
    value.split(',').forEach(pair => {
        const item = pair.trim();
        if (!item) return;

        // Pakai separator '=' supaya whatsapp ID yang mengandung ':' tetap aman.
        const separatorIndex = item.indexOf('=');
        if (separatorIndex < 1) return;

        const id = item.slice(0, separatorIndex).trim();
        const name = item.slice(separatorIndex + 1).trim();

        if (id && name) result[id] = name;
    });

    return Object.keys(result).length ? result : fallback;
};

const creator = parseList(process.env.BOT_CREATORS, ['JikaeL']);

const botName = process.env.BOT_NAME || 'JikaeLBot';

const users = parseUsersMap(process.env.BOT_USERS, {
    '6289608506367@c.us': 'Tami',
    '193836185837720@lid': 'Tami',
    '6289608506367:19@c.us': 'Tami',
    '62881081132332@c.us': 'Tami',
    '6283806618448@c.us': 'Dini'
});

const ownerNumber = parseList(process.env.BOT_OWNER_NUMBERS, [
    '6289608506367',
    '193836185837720',
    '628960850636719',
    '62881081132332'
]);

const database = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kflow_db',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

const ai = {
    apiKey: process.env.GEMINI_API_KEY,
    modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
};

const termuxChromiumPath = '/data/data/com.termux/files/usr/bin/chromium-browser';
const puppeteerExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH || termuxChromiumPath;

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
    puppeteer: {
        executablePath: puppeteerExecutablePath,
        headless: process.env.PUPPETEER_HEADLESS ? process.env.PUPPETEER_HEADLESS === 'true' : true,
        args: parseList(process.env.PUPPETEER_ARGS, defaultPuppeteerArgs)
    }
};

module.exports = { creator, botName, users, ownerNumber, database, ai, system };
