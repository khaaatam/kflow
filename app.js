const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const config = require('./config');

// Import Modules Baru
const db = require('./lib/database');
const webRoutes = require('./routes/web');
const messageHandler = require('./handlers/message');

// Cron Jobs
const reminderCommand = require('./commands/reminder');
const eventCommand = require('./commands/event');

// --- 1. SETUP SYSTEM ---
process.on('uncaughtException', (err) => console.log('⚠️ Error:', err.message));
process.on('unhandledRejection', (reason) => console.log('⚠️ Rejection:', reason));

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

// --- 2. PASANG ROUTE WEB ---
app.use('/', webRoutes);

// --- 3. SETUP WHATSAPP ---
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
    puppeteer: puppeteerConfig
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('SCAN QR DI ATAS!');
});

client.on('ready', async () => {
    // 3. Fix WhatsApp Web Bug (VERSIS KUAT) 💪
    // Kita paksa inject script ini berkala biar gak ilang
    const bugFix = async () => {
        try {
            await client.pupPage.evaluate(() => {
                // Paksa fungsi sendSeen jadi kosong biar gak error
                window.WWebJS.sendSeen = async () => true;
            });
        } catch (e) { }
    };

    // Jalanin sekali pas ready
    await bugFix();

    // Jalanin lagi tiap 1 menit (Jaga-jaga kalau page reload)
    setInterval(bugFix, 60000);


    console.log(`✅ BOT SIAP! Dashboard: http://localhost:${config.system.port}`);

    if (config.system.logNumber) {
        client.sendMessage(config.system.logNumber, "♻️ *SYSTEM ALERT*\nBot berhasil restart dan sudah aktif kembali! 🚀")
            .catch(e => console.error("Gagal kirim log startup:", e.message));
    }

    // Restore Tasks
    reminderCommand.restoreReminders(client, db); // Kirim db pool

    // Auto Cleanup Log
    db.query("DELETE FROM full_chat_logs WHERE waktu < DATE_SUB(NOW(), INTERVAL 3 MONTH)")
        .then(() => console.log('🧹 Cleanup Chat Log Sukses'))
        .catch(e => console.error('Gagal Cleanup:', e.message));

    // Cron Job Event (Jam 7 Pagi)
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 7 && now.getMinutes() === 0 && now.getSeconds() === 0) {
            console.log("⏰ Cek Event Harian...");
            eventCommand.cekEventHarian(client, db, config.system.logNumber);
        }
    }, 1000);
});

// --- 4. SAMBUNGKAN OTAK BOT ---
client.on('message_create', (msg) => messageHandler(client, msg));

// --- 5. START ---
client.initialize();
app.listen(config.system.port, () => {
    console.log(`🌍 Server Web jalan di Port ${config.system.port}`);
});