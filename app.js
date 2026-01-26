const express = require('express');
const mysql = require('mysql2'); // Note: Biasanya mysql biasa, tapi kalau lu pake mysql2 juga oke. Sesuaikan dgn package.json
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

// --- IMPORT MODULE COMMANDS ---
const config = require('./config');
const systemCommand = require('./commands/system');
const financeCommand = require('./commands/finance');
const aiCommand = require('./commands/ai');
const reminderCommand = require('./commands/reminder');
const adminCommand = require('./commands/admin');
const ayangCommand = require('./commands/ayang');
const eventCommand = require('./commands/event');
const statsCommand = require('./commands/stats');
const saranCommand = require('./commands/saran');
const tamiCommand = require('./commands/tami');

// --- 1. SETUP SYSTEM & ERROR HANDLING ---
process.on('uncaughtException', (err) => console.log('⚠️ Error (Abaikan):', err.message));
process.on('unhandledRejection', (reason) => console.log('⚠️ Promise Rej (Abaikan):', reason));

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

// --- 2. DATABASE CONNECTION ---
// Pake createConnection biar simpel (sesuai config lu biasanya)
// Kalau mau pool, pastikan config.database support connectionLimit
const db = mysql.createConnection(config.database);

db.connect((err) => {
    if (err) {
        console.error('❌ Error connecting to database:', err);
    } else {
        console.log('✅ Connected to database');
    }
});

// Jaga-jaga koneksi putus (Auto Reconnect Sederhana)
db.on('error', function (err) {
    console.log('⚠️ DB Error:', err.code);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        // Logic reconnect manual kalau perlu, atau biarkan process manager handle
    }
});

// --- 3. WEB DASHBOARD ROUTES ---
app.get('/', (req, res) => {
    const qHistory = "SELECT * FROM transaksi ORDER BY id DESC LIMIT 50";
    const qChartOrang = "SELECT sumber, SUM(nominal) as total FROM transaksi WHERE jenis='keluar' GROUP BY sumber";
    const qChartJenis = "SELECT jenis, SUM(nominal) as total FROM transaksi GROUP BY jenis";

    db.query(qHistory, (err, resHistory) => {
        if (err) { console.log(err); return res.send("Error DB History"); }
        db.query(qChartOrang, (err, resOrang) => {
            if (err) { console.log(err); return res.send("Error DB Chart Orang"); }
            db.query(qChartJenis, (err, resJenis) => {
                if (err) { console.log(err); return res.send("Error DB Chart Jenis"); }
                res.render('index', { data: resHistory, statsOrang: resOrang, statsJenis: resJenis });
            });
        });
    });
});

app.post('/tambah', (req, res) => {
    const { jenis, nominal, keterangan } = req.body;
    db.query("INSERT INTO transaksi (jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, 'WEB')",
        [jenis, nominal, keterangan], () => res.redirect('/'));
});

app.get('/hapus/:id', (req, res) => {
    db.query('DELETE FROM transaksi WHERE id = ?', [req.params.id], () => res.redirect('/'));
});

// --- 4. CONFIG BOT WA ---
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

// Helper Log
const sendLog = async (pesan) => {
    if (config.system && config.system.logNumber) {
        try { await client.sendMessage(config.system.logNumber, `🖥️ *SYSTEM LOG*\n\n${pesan}`); } catch (err) { }
    }
};

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));

client.on('ready', async () => {
    console.log(`✅ BOT SIAP! Dashboard: http://localhost:${config.system.port}`);

    // Restore Tasks
    reminderCommand.restoreReminders(client, db);

    // Kirim notif nyala
    sendLog("Bot berhasil nyala (RESTART/ONLINE). Siap bertugas! 🚀");

    try { await client.pupPage.evaluate(() => { window.WWebJS.sendSeen = async () => true; }); } catch (e) { }

    // Auto Cleanup
    db.query("DELETE FROM full_chat_logs WHERE waktu < DATE_SUB(NOW(), INTERVAL 3 MONTH)", (err) => {
        if (!err) console.log('🧹 Cleanup Chat Log Sukses');
    });

    // Cron Job Event
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 7 && now.getMinutes() === 0 && now.getSeconds() === 0) {
            console.log("⏰ Menjalankan pengecekan event harian...");
            eventCommand.cekEventHarian(client, db, config.system.logNumber);
        }
    }, 1000);
});

// --- 5. LOGIKA PESAN (ROUTER UTAMA) ---
client.on('message_create', async msg => {
    try {
        const rawText = msg.body;
        const text = rawText.toLowerCase().trim();

        // Skip Status & System
        if (msg.from === 'status@broadcast' || msg.type === 'e2e_notification' || msg.type === 'call_log') return;

        // Identifikasi Pengirim
        let senderId = msg.fromMe ? client.info.wid._serialized : (msg.author || msg.from);
        if (!senderId) return;

        // --- LEVEL 1: GATEKEEPER ---
        // Cek apakah pengirim ada di daftar user (config.js)
        const namaPengirim = config.users[senderId];

        // JIKA BUKAN USER TERDAFTAR -> STOP.
        // (Kalau lu mau Dini bisa pake command !tami, Dini harus didaftarin di config.users dulu)
        if (!namaPengirim) return;

        // --- LEVEL 2: ADMIN & LOGGING ---
        if (await adminCommand(client, msg, text, db)) return;

        const isForwarded = msg.isForwarded ? 1 : 0;

        // Log Chat (Database)
        db.query(
            "INSERT INTO full_chat_logs (nama_pengirim, pesan, is_forwarded) VALUES (?, ?, ?)",
            [namaPengirim, rawText, isForwarded],
            (err) => { if (err) console.error('❌ Gagal log chat:', err.message); }
        );

        // --- LEVEL 3: COMMAND ROUTER ---
        // Urutan pengecekan command (Siapa cepat dia dapat)

        // 1. SYSTEM (!ping, !uptime)
        if (await systemCommand(client, msg, text, senderId, namaPengirim)) return;

        // 2. FINANCE (!catat, !saldo, !today, !in, !out)
        // (Parameter namaPengirim dihapus karena finance.js nyari sendiri)
        if (await financeCommand(client, msg, text, db)) return;

        // 3. FITUR BARU (!stats, !saran, !tami)
        if (await statsCommand(client, msg, text, db)) return;
        if (await saranCommand(client, msg, text, db)) return;
        if (await tamiCommand(client, msg, text, db)) return;

        // 4. UTILITIES (!event, !ingatin, !ayang)
        if (text.startsWith('!event')) {
            if (await eventCommand(client, msg, text, db, senderId)) return;
        }
        if (text.startsWith('!ingatin') || text.startsWith('!remind')) {
            if (await reminderCommand(client, msg, text, db, senderId)) return;
        }
        if (text === '!ayang') {
            if (await ayangCommand(client, msg, db, namaPengirim)) return;
        }

        // --- LEVEL 4: AI OBSERVER (AUTO-LEARN) ---
        // Kalau bukan command, masuk ke sini buat belajar (atau reply kalau diajak ngobrol)

        if (text.startsWith('!')) return; // Jangan belajar dari command yg typo/gagal

        // Filter: Jangan belajar dari respon bot sendiri
        if (msg.fromMe) {
            const botKeywords = ['✅', '❌', '⚠️', '🤯', '🤖', 'system log', 'memori baru'];
            if (botKeywords.some(keyword => text.includes(keyword))) return;
        }

        // Jalankan AI
        await aiCommand.observe(client, msg, db, namaPengirim);

    } catch (error) {
        console.log('❌ Error Main Logic:', error);
    }
});

// Detak Jantung DB
setInterval(() => {
    db.query('SELECT 1', (err) => { if (err) console.error('⚠️ Detak jantung DB gagal:', err.message); });
}, 30000);

client.initialize();
app.listen(config.system.port);