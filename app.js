const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- API KEY GOOGLE AI (GEMINI) ---
const genAI = new GoogleGenerativeAI("AIzaSyD7C7AkOOUKfVAmylvb9UKYXlCjp_JpyCg");
// Pake model yang RPM-nya lumayan (sesuai SS lu tadi: 2.5-flash-lite atau 2.5-flash)
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

const express = require('express');
const mysql = require('mysql2');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const os = require('os'); 

// --- 1. CONFIG USER (WHITELIST) ---
const DAFTAR_USER = {
    '6289608506367@c.us': 'Tami',  // ID Utama
    '6283806618448@c.us': 'Dini'   // ID Dini
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

// --- 3. DATABASE (CONNECTION POOL) ---
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

// --- 4. WEB DASHBOARD ---
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
    const { id, jenis, nominal, keterangan, sumber, tanggal } = req.body;
    const sql = 'UPDATE transaksi SET jenis=?, nominal=?, keterangan=?, sumber=?, tanggal=? WHERE id=?';
    db.query(sql, [jenis, nominal, keterangan, sumber, tanggal, id], (err) => {
        if (err) console.log('Gagal update:', err);
        res.redirect('/');
    });
});

// --- 5. CONFIG BOT (HYBRID PC & HP) ---
const isTermux = process.platform === 'android'; 
let puppeteerConfig = {
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
    ]
};

if (isTermux) {
    console.log('📱 Mode: ANDROID (Termux Detected)');
    puppeteerConfig.executablePath = '/data/data/com.termux/files/usr/bin/chromium-browser';
    puppeteerConfig.args.push(
        '--no-first-run',
        '--no-zygote',
        '--single-process', 
        '--disable-accelerated-2d-canvas',
        '--disable-software-rasterizer'
    );
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
    try { await client.pupPage.evaluate(() => { window.WWebJS.sendSeen = async () => true; }); } catch(e){}

    // Auto-Cleanup Chat Log > 3 Bulan
    const sqlCleanup = "DELETE FROM full_chat_logs WHERE waktu < DATE_SUB(NOW(), INTERVAL 3 MONTH)";
    db.query(sqlCleanup, (err) => { if(!err) console.log('🧹 Cleanup Chat Log Sukses'); });
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Koneksi WA putus!', reason);
    console.log('🔄 Mencoba nyambung ulang...');
    client.destroy().then(() => { client.initialize(); });
});

// --- 6. LOGIC UTAMA (MESSAGE HANDLER) ---
client.on('message_create', async msg => {
    try {
        const text = msg.body.trim(); 
        const textLower = text.toLowerCase(); 
        const contact = await msg.getContact();
        const senderId = contact.number + '@c.us'; // Paksa format ID
        const chatDestination = msg.fromMe ? msg.to : msg.from;
        const namaPengirim = DAFTAR_USER[senderId]; 

        // Security Check
        if (!namaPengirim) return; 

        // [A] CCTV / PENYADAP (Simpan chat natural buat AI belajar)
        if (!text.startsWith('!')) {
            if (text.length > 0) {
                db.query("INSERT INTO full_chat_logs (nama_pengirim, pesan) VALUES (?, ?)", [namaPengirim, text]);
            }
            return; 
        }

        console.log(`✅ [${namaPengirim}] Command: ${text}`);

        // --- COMMAND LIST ---

        // 1. HELP (MENU BANTUAN) 🆘
        if (textLower === '!help' || textLower === '!menu') {
            const menu = `
🤖 *MENU BOT KEUANGAN* 🤖

*💰 KEUANGAN*
• \`!in [jumlah] [ket]\` : Catat Pemasukan
• \`!out [jumlah] [ket]\` : Catat Pengeluaran
• \`!saldo\` : Cek Tabungan
• \`!today\` : Transaksi Hari Ini
• \`!roasting\` : Minta AI Marah-marah soal duit
• \`!analisa\` : Analisa Keuangan Serius

*🧠 PERSONAL ASSISTANT*
• \`!ai [tanya]\` : Tanya Apapun (Pinter)
• \`!tanya [tanya]\` : Sama kayak !ai
• \`!ingat [fakta]\` : Suruh bot inget sesuatu
• \`!lupa\` : Hapus ingatan terakhir

*⚙️ LAINNYA*
• \`!cekid\` : Cek ID WhatsApp
• \`!ayang\` : Fitur Bucin (Buat Dini)
• \`!help\` : Liat Menu Ini
`;
            await client.sendMessage(chatDestination, menu);
        }

        // 2. AI PERSONAL ASSISTANT + DIGITAL TWIN 🧠
        else if (textLower.startsWith('!ai') || textLower.startsWith('!tanya')) {
            const splitText = msg.body.split(' ');
            const pertanyaan = splitText.slice(1).join(' ');

            if (!pertanyaan) return client.sendMessage(chatDestination, "Nanya apa? Contoh: `!ai Menurut lu Dini lagi bete gak?`");

            try {
                await msg.react('🧠');

                // Ambil Data: Memori, Chat Log (Digital Twin), Transaksi
                const qMemori = "SELECT fakta FROM memori";
                const qChatAsli = "SELECT * FROM full_chat_logs ORDER BY id DESC LIMIT 50";
                const qTransaksi = "SELECT * FROM transaksi ORDER BY id DESC LIMIT 5";

                const [rowsMemori, rowsChat, rowsTransaksi] = await Promise.all([
                    db.promise().query(qMemori),
                    db.promise().query(qChatAsli),
                    db.promise().query(qTransaksi)
                ]);

                const historyChat = rowsChat[0].length > 0 ? rowsChat[0].reverse().map(c => `${c.nama_pengirim}: "${c.pesan}"`).join('\n') : "(Belum ada chat)";
                const listMemori = rowsMemori[0].length > 0 ? rowsMemori[0].map(m => `- ${m.fakta}`).join('\n') : "(Kosong)";
                const listTransaksi = rowsTransaksi[0].map(r => `- ${r.tanggal}: ${r.jenis} Rp${r.nominal} (${r.keterangan})`).join('\n');

                const prompt = `
                    Peran: Kamu adalah 'AI Personal Assistant' di grup chat Tami & Dini.
                    
                    [CONTEXT CHAT TERAKHIR]:
                    ${historyChat}

                    [INGATAN TENTANG USER]:
                    ${listMemori}

                    [DATA KEUANGAN]:
                    ${listTransaksi}

                    [PERTANYAAN USER]: "${pertanyaan}"

                    INSTRUKSI:
                    1. Jawab berdasarkan context chat & ingatan.
                    2. Tiru gaya bahasa Tami (santai/gaul) dari chat log.
                    3. Analisa mood/situasi dari chat log jika ditanya.
                `;

                const result = await model.generateContent(prompt);
                await client.sendMessage(chatDestination, result.response.text());
            } catch (error) {
                console.error(error);
                await client.sendMessage(chatDestination, "Otak nge-lag.");
            }
        }

        // 3. MENAMBAH INGATAN
        else if (textLower.startsWith('!ingat')) {
            const fakta = msg.body.split(' ').slice(1).join(' ');
            if (!fakta) return client.sendMessage(chatDestination, "Contoh: `!ingat Dini suka warna ungu`");
            db.query("INSERT INTO memori (fakta) VALUES (?)", [fakta], (err) => {
                if(!err) client.sendMessage(chatDestination, `✅ Oke, diinget: "${fakta}"`);
            });
        }

        // 4. HAPUS INGATAN
        else if (textLower.startsWith('!lupa')) {
             db.query("DELETE FROM memori ORDER BY id DESC LIMIT 1", () => client.sendMessage(chatDestination, "🗑️ Ingatan terakhir dihapus."));
        }

        // 5. TRANSAKSI (!in / !out)
        else if (textLower.startsWith('!in') || textLower.startsWith('!out')) {
            const parts = msg.body.split(' ');
            if (parts.length < 3) return;
            const jenis = textLower.startsWith('!in') ? 'masuk' : 'keluar';
            const nominal = parseInt(parts[1]);
            const ket = parts.slice(2).join(' ');

            if (isNaN(nominal)) return;
            db.query("INSERT INTO transaksi (jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, ?)", [jenis, nominal, ket, namaPengirim], async (err) => {
                if (!err) { try { await msg.react('✅'); } catch (e) {} }
            });
        }

        // 6. SALDO
        else if (textLower.startsWith('!saldo')) {
            const sql = `SELECT (SELECT COALESCE(SUM(nominal),0) FROM transaksi WHERE jenis='masuk') as masuk, (SELECT COALESCE(SUM(nominal),0) FROM transaksi WHERE jenis='keluar') as keluar`;
            db.query(sql, async (err, res) => {
                if (err) return;
                const { masuk, keluar } = res[0];
                client.sendMessage(chatDestination, `💰 *SALDO KITA*\nMasuk: ${formatRupiah(masuk)}\nKeluar: ${formatRupiah(keluar)}\n💵 *SISA: ${formatRupiah(masuk - keluar)}*`);
            });
        }

        // 7. TODAY RECAP
        else if (textLower.startsWith('!today')) {
            db.query("SELECT * FROM transaksi WHERE DATE(tanggal) = CURDATE() ORDER BY id DESC", (err, rows) => {
                if (rows.length === 0) return client.sendMessage(chatDestination, "Hari ini belum jajan.");
                let rep = `📅 *HARI INI*\n` + rows.map(r => `\n${r.jenis === 'masuk' ? '🟢' : '🔴'} [${r.sumber}] ${formatRupiah(r.nominal)} - ${r.keterangan}`).join('');
                client.sendMessage(chatDestination, rep);
            });
        }

        // 8. ROASTING KEUANGAN
        else if (textLower.startsWith('!roasting')) {
            await msg.react('🔥');
            db.query("SELECT * FROM transaksi ORDER BY id DESC LIMIT 20", async (err, rows) => {
                if (rows.length === 0) return client.sendMessage(chatDestination, "Data kosong.");
                const dataTx = rows.map(r => `- ${r.tanggal}: [${r.jenis}] ${r.nominal} (${r.keterangan}) oleh ${r.sumber}`).join('\n');
                const prompt = `Roasting pengeluaran ini dengan gaya bahasa gaul, sarkas, pedas:\n${dataTx}`;
                try {
                    const result = await model.generateContent(prompt);
                    await client.sendMessage(chatDestination, result.response.text());
                } catch(e) { client.sendMessage(chatDestination, "Error AI"); }
            });
        }

        // 9. ANALISA SERIUS
        else if (textLower.startsWith('!analisa')) {
            await msg.react('🤔');
            db.query("SELECT * FROM transaksi ORDER BY id DESC LIMIT 50", async (err, rows) => {
                if (rows.length === 0) return client.sendMessage(chatDestination, "Data kosong.");
                const dataTx = rows.map(r => `- ${r.tanggal}: ${r.jenis} ${r.nominal} (${r.keterangan})`).join('\n');
                const prompt = `Analisa keuangan ini. Beri insight pemasukan vs pengeluaran, pos boros, dan saran actionable. Gaya bahasa santai.\n${dataTx}`;
                try {
                    const result = await model.generateContent(prompt);
                    await client.sendMessage(chatDestination, `📊 *ANALISA KEUANGAN*\n\n${result.response.text()}`);
                } catch(e) { client.sendMessage(chatDestination, "Error AI"); }
            });
        }

        // 10. AYANG
        else if (textLower.startsWith('!ayang')) {
            await msg.react('❤️');
            client.sendMessage(chatDestination, "Sabar ya sayang. ayangmu lagi sibuk kyknya. nanti aku bales kalo udh gk sibuk❤️");
        }
        
        // 11. CEK ID
        else if (textLower === '!cekid') {
            client.sendMessage(chatDestination, `🆔 ID: \`${senderId}\``);
        }

    } catch (error) { console.log('❌ Error Logic:', error); }
});

// --- 7. JANTUNG BUATAN ---
setInterval(() => {
    db.query('SELECT 1', (err) => { if (err) console.error('⚠️ Detak jantung DB gagal'); });
}, 30000);

client.initialize();
app.listen(3000);