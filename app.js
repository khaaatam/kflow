const express = require('express');
const mysql = require('mysql2');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Balikin AI nya
const qrcode = require('qrcode-terminal');
const path = require('path');
const os = require('os');

// --- 1. CONFIG USER (WHITELIST) ---
const DAFTAR_USER = {
    '193836185837720:92@lid': 'Tami', 
    '193836185837720@lid': 'Tami',
    '6289608506367:92@c.us': 'Tami',  
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
// GANTI API KEY LU DI BAWAH INI 👇
const genAI = new GoogleGenerativeAI("ISI_API_KEY_LU_DISINI");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Pake yg gratis

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

app.post('/update', (req, res) => {
    const { id, jenis, nominal, keterangan } = req.body;
    db.query('UPDATE transaksi SET jenis=?, nominal=?, keterangan=? WHERE id=?',
        [jenis, nominal, keterangan, id], () => res.redirect('/'));
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
        const senderId = msg.author || msg.from;
        const chatDestination = msg.fromMe ? msg.to : msg.from;
        const namaPengirim = DAFTAR_USER[senderId];

        if (text === '!cekid') {
            return client.sendMessage(chatDestination, `🆔 ID Pengirim: \`${senderId}\`\n📍 ID Room: \`${chatDestination}\``);
        }

        if (!namaPengirim) return;

        // AUTO LOGGER (Rekam semua chat)
        const sqlLog = "INSERT INTO full_chat_logs (nama_pengirim, pesan) VALUES (?, ?)";
        db.query(sqlLog, [namaPengirim, rawText], (err) => {
            if (err) console.error('❌ Gagal log chat:', err.message);
        });

        if (!text.startsWith('!')) return;
        console.log(`✅ [${namaPengirim}] Command: ${text}`);

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
                const reply = `💰 *TABUNGAN BERSAMA*\n-------------------\n📈 Masuk: ${formatRupiah(masuk)}\n📉 Keluar: ${formatRupiah(keluar)}\n💵 *SALDO: ${formatRupiah(masuk - keluar)}*`;
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

        // --- COMMAND AI (GEMINI) ---
        else if (text.startsWith('!ai') || text.startsWith('!analisa')) {
            const promptUser = rawText.replace(/!ai|!analisa/i, '').trim();
            if (!promptUser) return client.sendMessage(chatDestination, "Mau nanya apa sayang?");
            
            await msg.react('🤖');

            // 1. Ambil "Ingatan" dari Database Memori
            db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 5", async (err, rows) => {
                let contextMemori = "";
                if (!err && rows.length > 0) {
                    contextMemori = "Ingatan tentang user:\n" + rows.map(r => "- " + r.fakta).join("\n");
                }

                // 2. Gabungin Prompt User + Memori
                const finalPrompt = `
                Kamu adalah asisten pribadi untuk pasangan Tami dan Dini.
                Gaya bicara: Santai, gaul, dan sedikit humoris.
                ${contextMemori}
                
                Pertanyaan User (${namaPengirim}): ${promptUser}
                `;

                try {
                    const result = await model.generateContent(finalPrompt);
                    const response = await result.response;
                    await client.sendMessage(chatDestination, response.text());
                } catch (error) {
                    console.error("AI Error:", error.message);
                    await client.sendMessage(chatDestination, "Aduh, otakku lagi error nih. Coba lagi nanti ya.");
                }
            });
        }
        
        // --- COMMAND MEMORI (Buat ngajarin AI) ---
        else if (text.startsWith('!ingat')) {
            const faktaBaru = rawText.replace(/!ingat/i, '').trim();
            if (!faktaBaru) return;
            
            db.query("INSERT INTO memori (fakta) VALUES (?)", [faktaBaru], async (err) => {
                if (!err) {
                    await client.sendMessage(chatDestination, "Oke, aku simpen di otak ya!");
                }
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