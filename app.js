const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const config = require('./config');

// Import Modules
const db = require('./lib/database');
const webRoutes = require('./routes/web');
const messageHandler = require('./handlers/message');
const reminderCommand = require('./commands/reminder');
const eventCommand = require('./commands/event');

// --- 1. SETUP SYSTEM ---
process.on('uncaughtException', (err) => console.log('⚠️ Error:', err.message));
process.on('unhandledRejection', (reason) => console.log('⚠️ Rejection:', reason));

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.use('/', webRoutes);

// --- 2. SETUP WHATSAPP ---
const isTermux = process.platform === 'android';
let puppeteerConfig = config.system.puppeteer;

if (isTermux) {
    console.log('📱 Mode: ANDROID (Termux Detected)');
    puppeteerConfig.executablePath = '/data/data/com.termux/files/usr/bin/chromium-browser';
    puppeteerConfig.args.push('--no-first-run', '--no-zygote', '--single-process', '--disable-accelerated-2d-canvas', '--disable-software-rasterizer');
} else {
    console.log('💻 Mode: PC (Windows/Linux Detected)');
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerConfig,
    // Tetap pasang ini buat jaga-jaga
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('SCAN QR DI ATAS!');
});

// 👇 BAGIAN INI KITA HAPUS LOG-NYA BIAR GAK SPAM 👇
client.on('loading_screen', (percent, message) => {
});

client.on('authenticated', () => {
    console.log('🔐 AUTHENTICATED! (Sedang masuk...)');
});

client.on('auth_failure', (msg) => {
    console.error('❌ AUTHENTICATION FAILURE:', msg);
});

client.on('ready', async () => {
    // Fix Bug WA Web
    const bugFix = async () => {
        try {
            await client.pupPage.evaluate(() => {
                window.WWebJS.sendSeen = async () => true;
            });
        } catch (e) { }
    };
    await bugFix();
    setInterval(bugFix, 60000);

    console.log(`✅ BOT SIAP! Dashboard: http://localhost:${config.system.port}`);

    if (config.system.logNumber) {
        const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        client.sendMessage(config.system.logNumber, `♻️ *SYSTEM ALERT* [${now}]\nBot berhasil restart dan sudah aktif kembali! 🚀`)
            .catch(e => console.error("Gagal kirim log startup:", e.message));
    }

    reminderCommand.restoreReminders(client, db);

    // Cleanup Log Lama
    db.query("DELETE FROM full_chat_logs WHERE waktu < DATE_SUB(NOW(), INTERVAL 3 MONTH)")
        .catch(e => console.error('Gagal Cleanup:', e.message));

    // Cron Job Event
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 7 && now.getMinutes() === 0 && now.getSeconds() === 0) {
            eventCommand.cekEventHarian(client, db, config.system.logNumber);
        }
    }, 1000);
});

// --- 3. SAMBUNGKAN OTAK BOT ---
client.on('message_create', (msg) => {
    messageHandler(client, msg);
});

// --- 4. START EVERYTHING ---
const startBot = async () => {
    // 1. Beresin Database dulu
    await db.init();

    // 2. Baru nyalain Bot WA
    client.initialize();

    // 3. Nyalain Web Dashboard
    app.listen(config.system.port, () => {
        console.log(`🌍 Server Web jalan di Port ${config.system.port}`);
    });
};

startBot(); // <--- Ini saklar utamanya