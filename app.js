const express = require('express');
const mysql = require('mysql2');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

// --- IMPORT MODULE ---
const config = require('./config');
const systemCommand = require('./commands/system');
const financeCommand = require('./commands/finance');
const aiCommand = require('./commands/ai');
const reminderCommand = require('./commands/reminder');
const adminCommand = require('./commands/admin');

// --- 1. SETUP SYSTEM ---
process.on('uncaughtException', (err) => console.log('⚠️ Error (Abaikan):', err.message));
process.on('unhandledRejection', (reason) => console.log('⚠️ Promise Rej (Abaikan):', reason));

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

// --- 2. DATABASE CONNECTION ---
const db = mysql.createPool(config.database);

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

app.post('/update', (req, res) => {
    const { id, jenis, nominal, keterangan, sumber, tanggal } = req.body;
    const sql = 'UPDATE transaksi SET jenis=?, nominal=?, keterangan=?, sumber=?, tanggal=? WHERE id=?';
    db.query(sql, [jenis, nominal, keterangan, sumber, tanggal, id], (err) => {
        if (err) console.log('Gagal update:', err);
        res.redirect('/');
    });
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

// Helper: Kirim Log ke WA
const sendLog = async (pesan) => {
    if (config.system && config.system.logNumber) {
        try {
            await client.sendMessage(config.system.logNumber, `🖥️ *SYSTEM LOG*\n\n${pesan}`);
        } catch (err) {
            console.error("Gagal kirim log ke WA:", err);
        }
    }
};

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));

client.on('ready', async () => {
    console.log(`✅ BOT SIAP! Dashboard: http://localhost:${config.system.port}`);

    // Restore Reminder
    reminderCommand.restoreReminders(client, db);

    // Lapor Online
    sendLog("Bot berhasil nyala (RESTART/ONLINE). Siap bertugas! 🚀");

    try { await client.pupPage.evaluate(() => { window.WWebJS.sendSeen = async () => true; }); } catch (e) { }

    // Auto Cleanup Chat Log > 3 Bulan
    db.query("DELETE FROM full_chat_logs WHERE waktu < DATE_SUB(NOW(), INTERVAL 3 MONTH)", (err) => {
        if (!err) console.log('🧹 Cleanup Chat Log Sukses');
    });
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Koneksi WA putus!', reason);
    client.destroy().then(() => { client.initialize(); });
});

// --- 5. LOGIKA PESAN (ROUTER UTAMA) ---
client.on('message_create', async msg => {
    try {
        const rawText = msg.body;
        const text = rawText.toLowerCase().trim();

        // [FIX CRITICAL] SKIP STATUS WA & SYSTEM MESSAGE
        // Ini biang kerok error "getContactById undefined"
        if (msg.from === 'status@broadcast' || msg.type === 'e2e_notification' || msg.type === 'call_log') return;

        // [FIX CRITICAL] CARA AMBIL SENDER ID YANG AMAN
        // 1. msg.author = Pengirim di Group
        // 2. msg.from = Pengirim di Japri
        // 3. client.info.wid._serialized = Diri sendiri (kalo fromMe)
        let senderId;
        if (msg.fromMe) {
            senderId = client.info.wid._serialized;
        } else {
            senderId = msg.author || msg.from;
        }

        // Validasi senderId (jaga-jaga error)
        if (!senderId) return;

        // ---------------------------------------------------------
        // LEVEL 1: GATEKEEPER (HANYA ORANG TERDAFTAR)
        // ---------------------------------------------------------

        // Cek config.users
        const namaPengirim = config.users[senderId];

        // Kalau ID tidak terdaftar di config, CUEKIN TOTAL.
        if (!namaPengirim) return;

        // ---------------------------------------------------------
        // LEVEL 2: ADMIN & LOGGING
        // ---------------------------------------------------------

        // Cek Command Admin (!reset, dll)
        if (await adminCommand(client, msg, text, db)) return;

        // Simpan Log Chat (Hanya dari user terdaftar)
        db.query("INSERT INTO full_chat_logs (nama_pengirim, pesan) VALUES (?, ?)", [namaPengirim, rawText], (err) => {
            if (err) console.error('❌ Gagal log chat:', err.message);
        });

        // ---------------------------------------------------------
        // LEVEL 3: ROUTER (COMMAND vs OBROLAN)
        // ---------------------------------------------------------

        if (text.startsWith('!')) {
            // === JALUR COMMAND ===
            console.log(`✅ [${namaPengirim}] Command: ${text}`);

            // 1. System (!ping)
            await systemCommand(client, msg, text, senderId, namaPengirim);
            // 2. Finance (!jajan)
            await financeCommand(client, msg, text, db, namaPengirim);
            // 3. AI Direct (!ai)
            await aiCommand.interact(client, msg, text, db, namaPengirim);
            // 4. Reminder (!ingatin)
            if (text.startsWith('!ingatin') || text.startsWith('!remind')) {
                await reminderCommand(client, msg, text, db, senderId);
            }

        } else {
            // === JALUR OBROLAN / SILENT LEARN ===

            // [FIX PENTING] JANGAN BELAJAR DARI OMONGAN SENDIRI! 🛑
            // Kalau pesan ini dari Bot (fromMe), skip aja.
            if (msg.fromMe) return;

            // Filter konten sistem (jaga-jaga)
            if (
                text.includes('silent learn') ||
                text.includes('system log') ||
                text.includes('error terdeteksi') ||
                text.includes('[[savememory')
            ) {
                return;
            }

            // Jalankan Silent Observer (Auto-Learn) di background
            aiCommand.observe(client, rawText, db, namaPengirim);
        }

    } catch (error) {
        console.log('❌ Error Main Logic:', error);
        // Lapor error tanpa bikin crash loop
        if (!error.message.includes('getContactById')) {
            sendLog(`❌ *ERROR MAIN LOGIC*\n${error.message}`);
        }
    }
});

setInterval(() => {
    db.query('SELECT 1', (err) => {
        if (err) console.error('⚠️ Detak jantung DB gagal:', err.message);
    });
}, 30000);

client.initialize();
app.listen(config.system.port);