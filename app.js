const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const db = require('./lib/database');
const logger = require('./lib/logger');
const messageHandler = require('./handlers/message');
const os = require('os');
const isWindows = os.platform() === 'win32';


// --- LOAD FITUR BACKGROUND (Cuma ini yang perlu di-require manual) ---
const reminderCommand = require('./commands/reminder');
const eventCommand = require('./commands/event');
const Memory = require('./models/Memory');

// --- 1. INISIALISASI DATABASE (WAJIB ADA) ---
(async () => {
    try {
        await db.init();
        await Memory.cleanup(); // Clean old memories on startup
    } catch (e) {
        logger.error("Skip DB Init:", e.message);
    }
})();

// --- 2. SETUP SERVER WEB (Opsional buat Dashboard) ---
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
            '--disable-gpu',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--no-default-browser-check',
            '--js-flags=--max-old-space-size=128'
        ]
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('📱 Scan QR Code Diatas!');
});

client.on('ready', async () => {
    const cmdCount = messageHandler.commands ? messageHandler.commands.size : 0;

    logger.info(`${config.botName} Siap Melayani!`);
    logger.info('------------------------------------------------');
    logger.info(`Web Dashboard: http://localhost:${config.system.port}`);
    logger.info(`Handler: Siap memproses ${cmdCount} Command Otomatis`);
    logger.info('Cron Job: Event & Reminder Aktif');
    logger.info('------------------------------------------------');

    // Fix Bug "Send Seen"
    try { await client.pupPage.evaluate(() => { window.WWebJS.sendSeen = async () => true; }); } catch (e) { /* sendSeen fix is best-effort */ }

    // Notif ke Owner
    if (config.system.logNumber) {
        client.sendMessage(config.system.logNumber, `♻️ *SYSTEM ONLINE*\n${config.botName} berhasil restart & database terhubung.`)
            .then(() => logger.info("Notif ke owner terkirim"))
            .catch((e) => logger.error("Gagal kirim notif ke owner:", e.message));
    }

    // Restore Reminder yang tertunda (Background Task)
    reminderCommand.restoreReminders(client, db);

    // Cek Event Harian tiap jam 7 pagi (cek tiap 60 detik)
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 7 && now.getMinutes() === 0 && now.getSeconds() < 60) {
            eventCommand.cekEventHarian(client, db, config.system.logNumber);
        }
    }, 60000);
});

// --- 4. TANGKAP PESAN ---
client.on('message_create', async (msg) => {
    try {
        // Cek wujud messageHandler-nya apa, biar gak crash
        if (typeof messageHandler === 'function') {
            await messageHandler(client, msg);
        } else if (typeof messageHandler.default === 'function') {
            await messageHandler.default(client, msg);
        } else if (typeof messageHandler.messageHandler === 'function') {
            await messageHandler.messageHandler(client, msg);
        } else {
            logger.error("ERROR FATAL: messageHandler gagal di-load. Pastikan module.exports bener di message.js!");
        }
    } catch (error) {
        logger.error("CRASH SAAT TERIMA PESAN:", error.message);
    }
});

// ============================================================
// 🧹 FITUR TAMBAHAN: AUTO CLEAN TEMP (SAYA SELIPIN DISINI)
// ============================================================
// Ini gak bakal ganggu fitur lain, cuma jalan sekali pas start
const cleanTempFolder = () => {
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
            // Hapus cuma file media sisa (biar storage gak penuh)
            if (file.endsWith('.mp4') || file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.webp')) {
                try {
                    fs.unlinkSync(path.join(tempDir, file));
                } catch (e) { /* temp file already removed */ }
            }
        });
    } else {
        try { fs.mkdirSync(tempDir); } catch (e) { /* dir exists */ }
    }
};
// Jalankan pembersihan
cleanTempFolder();
// ============================================================

// Start Client & Web
client.initialize();
const server = app.listen(config.system.port, () => logger.info(`Server Web jalan di Port ${config.system.port}`));

// Graceful shutdown
const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
        logger.info('HTTP server closed.');
    });
    try {
        await client.destroy();
        logger.info('WhatsApp client destroyed.');
    } catch (e) {
        logger.error('Error destroying client:', e.message);
    }
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));