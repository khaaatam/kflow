const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const db = require('./lib/database');
const logger = require('./lib/logger');
const messageHandler = require('./handlers/message');
const { wrapClient } = require('./lib/sendWrapper');
const { warmUpLids, resolveId } = require('./lib/lid');
const os = require('os');
const isWindows = os.platform() === 'win32';

// --- LOAD FITUR BACKGROUND ---
const reminderCommand = require('./commands/reminder');
const eventCommand = require('./commands/event');
const tanggalCommand = require('./commands/tanggal');
const Memory = require('../models/Memory');

// --- 1. INISIALISASI DATABASE (fire-and-forget, gak block WhatsApp init) ---
let dbReady = false;
(async () => {
    try {
        await db.init();
        await Memory.cleanup();
        dbReady = true;
        logger.info('Database Siap.');
    } catch (e) {
        logger.error('DB Init Error:', e.message);
    }
})();

// --- 2. SETUP SERVER WEB ---
const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use('/', require('./routes/web'));

// --- 3. SETUP BOT WA ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: isWindows
            ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            : '/data/data/com.termux/files/usr/bin/chromium-browser',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows'
        ]
    }
});

// --- Wrap sendMessage dengan logging & watchdog ---
const sendOwnerNotif = async (text) => {
    if (!config.system.logNumber) return;
    const target = resolveId(config.system.logNumber);
    await client.sendMessage(target, text);
};

const restartBot = async (reason) => {
    logger.error(`[WATCHDOG] Auto-restart: ${reason}`);
    sendOwnerNotif(`⚠️ *WATCHDOG RESTART*\n${reason}`).catch(() => {});
    setTimeout(() => process.exit(1), 2000);
};

wrapClient(client, () => restartBot('Send timeout detected'));

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    logger.info('📱 Scan QR Code Diatas!');
});

client.on('ready', async () => {
    const cmdCount = messageHandler.commands ? messageHandler.commands.size : 0;

    logger.info(`${config.botName} Siap Melayani!`);
    logger.info('------------------------------------------------');
    logger.info(`Web Dashboard: http://localhost:${config.system.port}`);
    logger.info(`Handler: Siap memproses ${cmdCount} Command`);
    logger.info('------------------------------------------------');

    // Fix "Send Seen"
    try { await client.pupPage.evaluate(() => { window.WWebJS.sendSeen = async () => true; }); } catch { /* best-effort */ }

    // Notif ke Owner (fire-and-forget, gak block ready)
    sendOwnerNotif(`♻️ *SYSTEM ONLINE*\n${config.botName} berhasil restart.`)
        .then(() => logger.info('Notif ke owner terkirim'))
        .catch(() => logger.warn('Gagal kirim notif ke owner'));

    // Warm-up LID cache (fire-and-forget)
    warmUpLids(client).catch(() => {});

    // Date checker (daily at 7 AM)
    let lastDateCheck = null;
    setInterval(() => {
        const now = new Date();
        const today = now.toDateString();
        if (now.getHours() === 7 && now.getMinutes() === 0 && lastDateCheck !== today) {
            lastDateCheck = today;
            if (dbReady) tanggalCommand.checkUpcoming(client).catch(() => {});
        }
    }, 60000);

    // Restore reminders (jalan kalau DB udah ready)
    if (dbReady) {
        reminderCommand.restoreReminders(client, db);
    } else {
        logger.warn('DB belum ready, skip restore reminders');
    }

    // Event checker (tiap jam 7 pagi)
    const { EVENT_CHECK_HOUR, EVENT_CHECK_MINUTE, EVENT_CHECK_SECOND_MAX } = require('./lib/constants');
    let lastEventDate = null;
    setInterval(() => {
        const now = new Date();
        const today = now.toDateString();
        if (now.getHours() === EVENT_CHECK_HOUR && now.getMinutes() === EVENT_CHECK_MINUTE && now.getSeconds() < EVENT_CHECK_SECOND_MAX && lastEventDate !== today) {
            lastEventDate = today;
            if (dbReady) eventCommand.cekEventHarian(client, db, config.system.logNumber);
        }
    }, 60000);
});

// --- 4. TANGKAP PESAN ---
client.on('message_create', async (msg) => {
    try {
        await messageHandler(client, msg);
    } catch (error) {
        logger.error('CRASH SAAT TERIMA PESAN:', error.message);
    }
});

// --- 5. AUTO CLEAN TEMP ---
const cleanTempFolder = () => {
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
        fs.readdirSync(tempDir).forEach(file => {
            if (/\.(mp4|png|jpg|webp)$/i.test(file)) {
                try { fs.unlinkSync(path.join(tempDir, file)); } catch { /* ignore */ }
            }
        });
    } else {
        try { fs.mkdirSync(tempDir); } catch { /* exists */ }
    }
};
cleanTempFolder();

// --- START ---
(async () => {
    client.initialize();
    const server = app.listen(config.system.port, () => logger.info(`Server Web jalan di Port ${config.system.port}`));

    const shutdown = async (signal) => {
        logger.info(`${signal} received. Shutting down...`);
        server.close(() => logger.info('HTTP server closed.'));
        try { await client.destroy(); } catch { /* ignore */ }
        process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
})();
