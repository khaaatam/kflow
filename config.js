require('dotenv').config();
const fs = require('fs');
const path = require('path');

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

const users = parseUsersMap(process.env.BOT_USERS, {
    '193836185837720@lid': 'Tami',
    '193836185837720:20@lid': 'Tami',
    '6289608506367@c.us': 'Tami',
    '6289608506367:2@c.us': 'Tami',
    '62881081132332@c.us': 'Tami',
    '6283806618448@c.us': 'Dini'
});

const ownerNumber = parseList(process.env.BOT_OWNER_NUMBERS, [
    '6289608506367',
    '193836185837720',
    '62896085063672',
    '628960850636720',
    '62881081132332'
]);

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
    modelName: process.env.ROUTER_MODEL || 'gemini-2.5-flash'
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
