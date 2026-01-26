const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');
const db = require('../lib/database'); // 👈 IMPORT DATABASE DARI SINI
const { formatRupiah } = require('../utils/formatter'); // 👈 IMPORT FORMATTER

// Init AI
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// 👇 Perhatikan: Parameter 'db' udah KITA HAPUS karena udah import di atas
module.exports = async (client, msg, text) => {
    const cmd = text.toLowerCase();

    // 1. FILTER: Cek apakah ini command Finance?
    const financeKeywords = ['!catat', '!catet', '!saldo', '!dompet', '!today', '!in', '!out'];
    const isFinanceCmd = financeKeywords.some(key => cmd.startsWith(key));

    if (!isFinanceCmd) return false;

    // 2. AMBIL NAMA PENGIRIM
    let namaPengirim = "Tami";
    try {
        const contact = await msg.getContact();
        namaPengirim = contact.pushname || contact.name || "Tami";
    } catch (err) {
        console.log("⚠️ Gagal fetch contact finance.");
    }

    const chatDestination = msg.fromMe ? msg.to : msg.from;
    const rawText = msg.body;

    // --- FITUR 1: AI SMART RECORDER (!catat) ---
    if (cmd.startsWith('!catat') || cmd.startsWith('!catet')) {
        const curhatan = rawText.replace(/!cat(a|e)t/i, '').trim();
        if (!curhatan) return client.sendMessage(chatDestination, "⚠️ Contoh: `!catat beli nasi 15rb`");

        await msg.react('💸');

        const prompt = `
        Role: Asisten Keuangan. Extract info ke JSON.
        User: "${curhatan}"
        Rules: Ubah "20k"->20000. Jenis: "masuk"/"keluar".
        Output JSON: [{"jenis": "keluar", "nominal": 20000, "keterangan": "Bensin"}]
        `;

        try {
            const result = await model.generateContent(prompt);
            const jsonMatch = result.response.text().match(/\[[\s\S]*\]/);
            if (!jsonMatch) throw new Error("Invalid JSON");
            const transactions = JSON.parse(jsonMatch[0]);

            let laporan = `✅ *TRANSAKSI BERHASIL DICATAT*\nUser: ${namaPengirim}\n\n`;

            for (const t of transactions) {
                let jenisFix = ['masuk', 'keluar'].includes(t.jenis.toLowerCase()) ? t.jenis.toLowerCase() : 'keluar';

                // 👇 Pake db.execute / db.query langsung (karena udah promise)
                await db.query(
                    "INSERT INTO transaksi (jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, ?)",
                    [jenisFix, t.nominal, t.keterangan, namaPengirim]
                );

                const icon = jenisFix === 'masuk' ? '🟢' : '🔴';
                laporan += `${icon} *${t.keterangan}*: ${formatRupiah(t.nominal)}\n`;
            }
            await client.sendMessage(chatDestination, laporan + `\n_Sinkron Dashboard_`);

        } catch (error) {
            console.error("AI Finance Error:", error);
            await client.sendMessage(chatDestination, "❌ Gagal mencerna.");
        }
        return true;
    }

    // --- FITUR 2: MANUAL (!in / !out) ---
    if (cmd.startsWith('!in') || cmd.startsWith('!out')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) return false;

        const jenis = cmd.startsWith('!in') ? 'masuk' : 'keluar';
        const nominal = parseInt(parts[1]);
        const ket = parts.slice(2).join(' ');

        if (isNaN(nominal)) {
            client.sendMessage(chatDestination, "Nominal harus angka!");
            return true;
        }

        try {
            await db.query(
                "INSERT INTO transaksi (jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, ?)",
                [jenis, nominal, ket, namaPengirim]
            );
            await msg.react('✅');
            const icon = jenis === 'masuk' ? '🟢' : '🔴';
            client.sendMessage(chatDestination, `✅ Tercatat: ${icon} ${formatRupiah(nominal)} (${ket})`);
        } catch (e) {
            client.sendMessage(chatDestination, '❌ Database error.');
        }
        return true;
    }

    // --- FITUR 3: CEK SALDO (!saldo) ---
    if (cmd.startsWith('!saldo') || cmd.startsWith('!dompet')) {
        const [rows] = await db.query(`SELECT 
            (SELECT COALESCE(SUM(nominal),0) FROM transaksi WHERE jenis='masuk') as masuk, 
            (SELECT COALESCE(SUM(nominal),0) FROM transaksi WHERE jenis='keluar') as keluar`);

        const { masuk, keluar } = rows[0];
        const saldo = masuk - keluar;
        let status = saldo < 100000 ? "⚠️ *KRITIS!*" : "✅ *AMAN.*";

        client.sendMessage(chatDestination, `💰 *DOMPET*\n📈 Masuk: ${formatRupiah(masuk)}\n📉 Keluar: ${formatRupiah(keluar)}\n💵 *SALDO: ${formatRupiah(saldo)}*\n${status}`);
        return true;
    }

    // --- FITUR 4: REKAP HARI INI (!today) ---
    if (cmd.startsWith('!today')) {
        const [rows] = await db.query("SELECT * FROM transaksi WHERE DATE(tanggal) = CURDATE() ORDER BY id DESC");

        if (rows.length === 0) return client.sendMessage(chatDestination, "📅 Belum ada transaksi hari ini.");

        let rep = `📅 *REKAP HARI INI*\n`;
        let totalKeluar = 0;

        rows.forEach(r => {
            const icon = r.jenis === 'masuk' ? '🟢' : '🔴';
            const nom = Number(r.nominal);
            rep += `\n${icon} [${r.sumber}] ${formatRupiah(nom)} - ${r.keterangan}`;
            if (r.jenis === 'keluar') totalKeluar += nom;
        });

        rep += `\n\n📉 *Total Keluar:* ${formatRupiah(totalKeluar)}`;
        client.sendMessage(chatDestination, rep);
        return true;
    }

    return false;
};

module.exports.metadata = {
    category: "KEUANGAN",
    commands: [
        { command: '!catat', desc: 'Catat otomatis AI' },
        { command: '!in/!out', desc: 'Catat manual' },
        { command: '!saldo', desc: 'Cek saldo' },
        { command: '!today', desc: 'Rekap hari ini' }
    ]
};