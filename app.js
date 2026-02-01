const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs'); // 👈 SAYA CUMA NAMBAH INI (BUAT HAPUS FILE SAMPAH)
const config = require('./config');
const db = require('./lib/database');
const messageHandler = require('./handlers/message');


// --- LOAD FITUR BACKGROUND (Cuma ini yang perlu di-require manual) ---
const reminderCommand = require('./commands/reminder');
const eventCommand = require('./commands/event');

// --- 1. INISIALISASI DATABASE (WAJIB ADA) ---
(async () => {
    try {
        await db.init();
    } catch (e) {
        console.error("⚠️ Skip DB Init:", e.message);
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
    puppeteer: config.system.puppeteer
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('📱 Scan QR Code Diatas!');
});

client.on('ready', async () => {
    const cmdCount = messageHandler.commands ? messageHandler.commands.size : 0;

    console.log(`✅${config.botName} Siap Melayani!`);
    console.log('------------------------------------------------');
    console.log(`🌐 Web Dashboard: http://localhost:${config.system.port}`);
    console.log(`🧠 Handler: Siap memproses ${cmdCount} Command Otomatis`);
    console.log('⏰ Cron Job: Event & Reminder Aktif');
    console.log('------------------------------------------------');

    // Fix Bug "Send Seen"
    try { await client.pupPage.evaluate(() => { window.WWebJS.sendSeen = async () => true; }); } catch (e) { }

    // Notif ke Owner
    if (config.system.logNumber) {
        client.sendMessage(config.system.logNumber, `♻️ *SYSTEM ONLINE*\n${config.botName} berhasil restart & database terhubung.`).catch(() => { });
    }

    // Restore Reminder yang tertunda (Background Task)
    reminderCommand.restoreReminders(client, db);

    // Cek Event Harian tiap jam 7 pagi (Background Task)
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 7 && now.getMinutes() === 0 && now.getSeconds() === 0) {
            eventCommand.cekEventHarian(client, db, config.system.logNumber);
        }
    }, 1000);
});

// --- 4. TANGKAP PESAN ---
client.on('message_create', (msg) => {
    // Serahkan semua ke Manajer (Handler)
    messageHandler(client, msg);
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
                } catch (e) { }
            }
        });
    } else {
        try { fs.mkdirSync(tempDir); } catch (e) { }
    }
};
// Jalankan pembersihan
cleanTempFolder();
// ============================================================

// Start Client & Web
client.initialize();
app.listen(config.system.port, () => console.log(`🌍 Server Web jalan di Port ${config.system.port}`));