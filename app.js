const express = require('express');
const mysql = require('mysql2');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const qrcode = require('qrcode-terminal');
const path = require('path');
const os = require('os');

// --- 1. CONFIG USER (WHITELIST NORMALISASI) ---
const DAFTAR_USER = {
    '6289608506367@c.us': 'Tami',
    '6283806618448@c.us': 'Dini'
};

// --- 2. CONFIG SYSTEM ---
process.on('uncaughtException', (err) => console.log('⚠️ Error (Abaikan):', err.message));
process.on('unhandledRejection', (reason) => console.log('⚠️ Promise Rej (Abaikan):', reason));

const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(angka);
};

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

// --- 3. CONFIG AI (GEMINI) ---
// 👇 MASUKIN API KEY LU DISINI 👇
const genAI = new GoogleGenerativeAI("AIzaSyD7C7AkOOUKfVAmylvb9UKYXlCjp_JpyCg");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// --- 4. DATABASE (CONNECTION POOL) ---
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kflow_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// --- 5. WEB DASHBOARD ---
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
                res.render('index', {
                    data: resHistory,
                    statsOrang: resOrang,
                    statsJenis: resJenis
                });
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

// --- REVISI LOGIC UPDATE ---
app.post('/update', (req, res) => {
    const { id, jenis, nominal, keterangan, sumber, tanggal } = req.body;

    // FIX: Masukin 'sumber' dan 'tanggal' ke query SQL
    const sql = "UPDATE transaksi SET jenis=?, nominal=?, keterangan=?, sumber=?, tanggal=? WHERE id=?";

    // Pastikan urutan values sama dengan tanda tanya (?) di atas
    db.query(sql, [jenis, nominal, keterangan, sumber, tanggal, id], (err) => {
        if (err) {
            console.error("❌ Gagal Update:", err.message);
            return res.send("Gagal Update: " + err.message);
        }
        console.log(`✏️ Data ID ${id} berhasil diupdate jadi: ${jenis}, ${nominal}, ${sumber}`);
        res.redirect('/');
    });
});

// --- 6. CONFIG BOT (HYBRID) ---
const isTermux = process.platform === 'android';
let puppeteerConfig = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
};

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
    console.log('✅ BOT SIAP! Dashboard: http://localhost:3000');
    try { await client.pupPage.evaluate(() => { window.WWebJS.sendSeen = async () => true; }); } catch (e) { }
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Koneksi WA putus!', reason);
    client.destroy().then(() => { client.initialize(); });
});

client.on('message_create', async msg => {
    try {
        const rawText = msg.body;
        const text = rawText.toLowerCase().trim();

        // --- 1. LOGIKA NORMALISASI ID (GOLDEN LOGIC) ---
        // Ambil kontak asli, paksa ambil nomornya, tambah @c.us
        const contact = await msg.getContact();
        const senderId = contact.number + '@c.us';

        // Tentukan tujuan balesan
        const chatDestination = msg.fromMe ? msg.to : msg.from;

        // Cek Whitelist (Pake senderId yang udah dinormalisasi)
        const namaPengirim = DAFTAR_USER[senderId];

        // --- CEK APAKAH LOGIC JALAN ---
        // Kalau lu ketik !cekid, dia wajib kasih liat ID hasil normalisasi
        if (text === '!cekid') {
            return client.sendMessage(chatDestination, `🆔 ID Terdeteksi: \`${senderId}\`\n👤 User: ${namaPengirim || 'Gak Dikenal'}`);
        }

        // Gatekeeper: Kalau gak dikenal, stop disini.
        if (!namaPengirim) return;

        // AUTO LOGGER
        const sqlLog = "INSERT INTO full_chat_logs (nama_pengirim, pesan) VALUES (?, ?)";
        db.query(sqlLog, [namaPengirim, rawText], (err) => {
            if (err) console.error('❌ Gagal log chat:', err.message);
        });

        if (!text.startsWith('!')) return;
        console.log(`✅ [${namaPengirim}] Command: ${text}`);

        if (text === '!help' || text === '!menu') {
            const menu = `🤖 *MENU BOT KEUANGAN & AI* 🤖\n\n💰 *KEUANGAN*\n- *!in [jumlah] [ket]* : Masuk\n- *!out [jumlah] [ket]* : Keluar\n- *!saldo* : Cek Sisa\n- *!today* : Rekap Hari Ini\n\n🧠 *AI*\n- *!ai [tanya]* : Tanya Gemini\n- *!ingat [fakta]* : Ajarin AI\n\n❤️ *LAINNYA*\n- *!ayang* : Mode Bucin\n- *!cekid* : Cek ID`;
            return client.sendMessage(chatDestination, menu);
        }

        // --- COMMAND KEUANGAN ---
        if (text.startsWith('!in') || text.startsWith('!out')) {
            const parts = rawText.split(' ');
            if (parts.length < 3) return;
            const jenis = text.startsWith('!in') ? 'masuk' : 'keluar';
            const nominal = parseInt(parts[1]);
            const ket = parts.slice(2).join(' ');
            if (isNaN(nominal)) return;

            const sql = "INSERT INTO transaksi (jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, ?)";
            db.query(sql, [jenis, nominal, ket, namaPengirim], async (err) => {
                if (!err) { try { await msg.react('✅'); } catch (e) { } }
            });
        }
        else if (text.startsWith('!saldo')) {
            const sql = `SELECT (SELECT COALESCE(SUM(nominal),0) FROM transaksi WHERE jenis='masuk') as masuk, (SELECT COALESCE(SUM(nominal),0) FROM transaksi WHERE jenis='keluar') as keluar`;
            db.query(sql, async (err, result) => {
                if (err) return;
                const { masuk, keluar } = result[0];
                const reply = `💰 *SALDO*: ${formatRupiah(masuk - keluar)}\n(Masuk: ${formatRupiah(masuk)} | Keluar: ${formatRupiah(keluar)})`;
                try { await client.sendMessage(chatDestination, reply); } catch (e) { msg.react('💰'); }
            });
        }
        else if (text.startsWith('!today')) {
            const sql = "SELECT * FROM transaksi WHERE DATE(tanggal) = CURDATE() ORDER BY id DESC";
            db.query(sql, async (err, rows) => {
                if (rows.length === 0) return client.sendMessage(chatDestination, "Belum ada transaksi hari ini.");
                let rep = `📅 *REKAP HARI INI*\n`;
                rows.forEach(r => { rep += `\n${r.jenis === 'masuk' ? '🟢' : '🔴'} [${r.sumber}] ${formatRupiah(r.nominal)} - ${r.keterangan}`; });
                try { await client.sendMessage(chatDestination, rep); } catch (e) { }
            });
        }
        else if (text.startsWith('!ayang')) {
            try { await msg.react('❤️'); } catch (e) { }
            try { await client.sendMessage(chatDestination, "Sabar yaa sayang. ayangmu lagi sibuk kyknya. nanti aku bales kalo udh gk sibuk❤️"); } catch (e) { }
        }

        // --- COMMAND AI ---
        else if (text.startsWith('!ai') || text.startsWith('!analisa')) {
            const promptUser = rawText.replace(/!ai|!analisa/i, '').trim();
            if (!promptUser) return client.sendMessage(chatDestination, "Mau nanya apa sayang?");

            await msg.react('🤖');
            db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 5", async (err, rows) => {
                let contextMemori = "";
                if (!err && rows.length > 0) {
                    contextMemori = "Ingatan tentang user:\n" + rows.map(r => "- " + r.fakta).join("\n");
                }
                const finalPrompt = `Kamu adalah asisten Tami dan Dini. Gaya: Gaul & Santai.\n${contextMemori}\nPertanyaan ${namaPengirim}: ${promptUser}`;
                try {
                    const result = await model.generateContent(finalPrompt);
                    const response = await result.response;
                    await client.sendMessage(chatDestination, response.text());
                } catch (error) {
                    console.error("AI Error:", error.message);
                    await client.sendMessage(chatDestination, "Otakku error, coba lagi nanti.");
                }
            });
        }

        // --- REVISI COMMAND !INGAT (Cerewet Mode) ---
        else if (text.startsWith('!ingat')) {
            const faktaBaru = rawText.replace(/!ingat/i, '').trim();

            // 1. Cek kalo user cuma ngetik !ingat doang
            if (!faktaBaru) {
                return client.sendMessage(chatDestination, "Kasih tau dong apa yang harus aku inget? Contoh: `!ingat Tami suka nasgor`");
            }

            db.query("INSERT INTO memori (fakta) VALUES (?)", [faktaBaru], async (err) => {
                // 2. Cek kalo ada error Database (Misal tabel belum dibuat)
                if (err) {
                    console.error("❌ Gagal simpan memori:", err.message);
                    return client.sendMessage(chatDestination, "Gagal nyimpen ingatan bos. Error: " + err.message);
                }
                // 3. Sukses
                await client.sendMessage(chatDestination, "Oke, tersimpan di memori!");
            });
        }

    } catch (error) { console.log('❌ Error Logic:', error); }
});

setInterval(() => {
    db.query('SELECT 1', (err) => {
        if (err) console.error('⚠️ Detak jantung DB gagal:', err.message);
    });
}, 30000);

client.initialize();
app.listen(3000);