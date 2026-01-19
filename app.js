const express = require('express');
const mysql = require('mysql2');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

// --- IMPORT FILE PESAHAAN KITA ---
const config = require('./config');
const systemCommand = require('./commands/system');
const financeCommand = require('./commands/finance');
const aiCommand = require('./commands/ai');
const reminderCommand = require('./commands/reminder');

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

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));

client.on('ready', async () => {
    console.log(`✅ BOT SIAP! Dashboard: http://localhost:${config.system.port}`);
    // Restore jadwal reminder yang pending pas bot restart
    reminderCommand.restoreReminders(client, db);
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

// --- 5. LOGIKA PESAN (ROUTER) ---
client.on('message_create', async msg => {
    try {
        const rawText = msg.body;
        const text = rawText.toLowerCase().trim();

        // 1. Normalisasi ID
        const contact = await msg.getContact();
        const senderId = contact.number + '@c.us';
        const namaPengirim = config.users[senderId]; // Cek whitelist

        // --- GATEKEEPER ---
        // Kalau bukan Tami/Dini, bot pura-pura mati (return)
        if (!namaPengirim) return;

        // 2. LOGGING CHAT (PENTING BUAT HISTORY)
        // Simpan SEMUA chat (walaupun bukan command)
        db.query("INSERT INTO full_chat_logs (nama_pengirim, pesan) VALUES (?, ?)", [namaPengirim, rawText], (err) => {
            if (err) console.error('❌ Gagal log chat:', err.message);
        });

        // --- 3. AUTO-LEARNING (SILENT OBSERVER) ---
        // Jalankan background process buat analisa chat ini
        // Syarat: Bukan command (karena command udah ada logic sendiri)
        if (!text.startsWith('!')) {
            // Panggil fungsi observe dari aiCommand (tanpa await biar gak bikin lemot)
            aiCommand.observe(rawText, db, namaPengirim);
        }

        // --- 4. EKSEKUSI COMMAND ---
        if (text.startsWith('!')) {
            console.log(`✅ [${namaPengirim}] Command: ${text}`);

            // Router Command
            await systemCommand(client, msg, text, senderId, namaPengirim);
            await financeCommand(client, msg, text, db, namaPengirim);

            // Panggil fungsi interact (bukan observe) buat ngejawab !ai
            await aiCommand.interact(client, msg, text, db, namaPengirim);

            if (text.startsWith('!ingatin') || text.startsWith('!remind')) {
                await reminderCommand(client, msg, text, db, senderId);
            }
        }

    } catch (error) { console.log('❌ Error Main Logic:', error); }
});

// Jantung DB
setInterval(() => {
    db.query('SELECT 1', (err) => {
        if (err) console.error('⚠️ Detak jantung DB gagal:', err.message);
    });
}, 30000);

client.initialize();
app.listen(config.system.port);