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
        const item = pair.trim();
        if (!item) return;

        const separatorIndex = item.indexOf('=');
        if (separatorIndex < 1) return;

        const id = item.slice(0, separatorIndex).trim();
        const name = item.slice(separatorIndex + 1).trim();

        if (id && name) result[id] = name;
    });

    return Object.keys(result).length ? result : fallback;
};

const resolveBinaryFromPath = (binaryName) => {
    const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    for (const dir of pathDirs) {
        const candidate = path.join(dir, binaryName);
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
};

const resolveChromiumExecutable = () => {
    const envCandidate = (process.env.PUPPETEER_EXECUTABLE_PATH || '').trim();
    if (envCandidate && fs.existsSync(envCandidate)) return envCandidate;

    const absoluteCandidates = [
        '/data/data/com.termux/files/usr/bin/chromium-browser',
        '/data/data/com.termux/files/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome'
    ];

    for (const candidate of absoluteCandidates) {
        if (fs.existsSync(candidate)) return candidate;
    }

    const pathCandidates = ['chromium-browser', 'chromium', 'google-chrome', 'google-chrome-stable'];
    for (const bin of pathCandidates) {
        const found = resolveBinaryFromPath(bin);
        if (found) return found;
    }

    return null;
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

const defaultPuppeteerArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote'
];

const chromiumExecutable = resolveChromiumExecutable();
if (!chromiumExecutable) {
    console.warn('⚠️ Chromium tidak ditemukan. Set PUPPETEER_EXECUTABLE_PATH ke binary Chromium yang valid.');
}

const system = {
    port: Number(process.env.PORT || 3000),
    logNumber: process.env.LOG_NUMBER || '62881081132332@c.us',
    puppeteer: {
        ...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
        headless: process.env.PUPPETEER_HEADLESS ? process.env.PUPPETEER_HEADLESS === 'true' : true,
        args: parseList(process.env.PUPPETEER_ARGS, defaultPuppeteerArgs)
    }
};

module.exports = { creator, botName, users, ownerNumber, database, ai, system };
