const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Init AI
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

const formatRupiah = (angka) => {
    // Safety check: Kalau bukan angka, paksa jadi 0
    const val = Number(angka) || 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
};

module.exports = async (client, msg, text, db) => {
    const cmd = text.toLowerCase();

    // 1. FILTER: Cek apakah ini command Finance?
    const financeKeywords = ['!catat', '!catet', '!saldo', '!dompet', '!today', '!in', '!out'];
    const isFinanceCmd = financeKeywords.some(key => cmd.startsWith(key));

    if (!isFinanceCmd) return false;

    // 2. AMBIL NAMA PENGIRIM (SAFE MODE)
    let namaPengirim = "Tami";
    try {
        const contact = await msg.getContact();
        namaPengirim = contact.pushname || contact.name || "Tami";
    } catch (err) {
        console.log("⚠️ Gagal fetch contact finance, pake nama default.");
    }

    const chatDestination = msg.fromMe ? msg.to : msg.from;
    const rawText = msg.body;

    // --- FITUR 1: AI SMART RECORDER (!catat) ---
    if (cmd.startsWith('!catat') || cmd.startsWith('!catet')) {
        const curhatan = rawText.replace(/!cat(a|e)t/i, '').trim();

        if (!curhatan) {
            return client.sendMessage(chatDestination, "⚠️ Mau nyatet apa?\nContoh: `!catat beli nasi padang 25rb sama bayar parkir 2000`");
        }

        await msg.react('💸');

        const prompt = `
        Role: Asisten Keuangan Pribadi.
        Tugas: Ekstrak informasi keuangan dari teks user menjadi JSON.
        [TEKS USER]: "${curhatan}"
        [ATURAN]:
        1. Ubah "20k" jadi 20000, "5jt" jadi 5000000.
        2. Tentukan "jenis": "masuk" (gaji/nemu) ATAU "keluar" (beli/bayar).
        [OUTPUT JSON ONLY]: 
        [{"jenis": "keluar", "nominal": 20000, "keterangan": "Bensin"}]
        JANGAN ADA TEKS LAIN SELAIN JSON ARRAY DI ATAS.
        `;

        try {
            const result = await model.generateContent(prompt);
            let rawResponse = result.response.text();

            // JSON EXTRACTOR
            const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
            if (!jsonMatch) throw new Error("AI tidak mengembalikan format JSON yang valid");

            const transactions = JSON.parse(jsonMatch[0]);

            let laporan = `✅ *TRANSAKSI BERHASIL DICATAT*\nUser: ${namaPengirim}\n\n`;

            for (const t of transactions) {
                let jenisFix = t.jenis.toLowerCase();
                if (jenisFix !== 'masuk' && jenisFix !== 'keluar') jenisFix = 'keluar';

                await new Promise((resolve) => {
                    const sql = "INSERT INTO transaksi (jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, ?)";
                    db.query(sql, [jenisFix, t.nominal, t.keterangan, namaPengirim], (err) => resolve());
                });

                const icon = jenisFix === 'masuk' ? 'nm' : 'nr';
                laporan += `${icon} *${t.keterangan}*: ${formatRupiah(t.nominal)}\n`;
            }

            laporan += `\n_Data sinkron dengan Dashboard!_`;
            await client.sendMessage(chatDestination, laporan);

        } catch (error) {
            console.error("AI Finance Error:", error);
            await client.sendMessage(chatDestination, "❌ Gagal mencerna. Coba pake angka jelas.");
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
            client.sendMessage(chatDestination, "Nominal harus angka! Contoh: `!out 5000 parkir`");
            return true;
        }

        const sql = "INSERT INTO transaksi (jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, ?)";
        db.query(sql, [jenis, nominal, ket, namaPengirim], async (err) => {
            if (!err) {
                try { await msg.react('✅'); } catch (e) { }
                client.sendMessage(chatDestination, `✅ Tercatat: ${jenis.toUpperCase()} ${formatRupiah(nominal)} (${ket})`);
            } else {
                client.sendMessage(chatDestination, '❌ Database error.');
            }
        });
        return true;
    }

    // --- FITUR 3: CEK SALDO (!saldo / !dompet) ---
    if (cmd.startsWith('!saldo') || cmd.startsWith('!dompet')) {
        const sql = `SELECT 
            (SELECT COALESCE(SUM(nominal),0) FROM transaksi WHERE jenis='masuk') as masuk, 
            (SELECT COALESCE(SUM(nominal),0) FROM transaksi WHERE jenis='keluar') as keluar`;

        db.query(sql, async (err, result) => {
            if (err) return client.sendMessage(chatDestination, '❌ Gagal tarik saldo.');

            const { masuk, keluar } = result[0];
            const saldo = masuk - keluar;

            let status = saldo < 100000 ? "⚠️ *KRITIS!* Hemat bang." : "✅ *AMAN.*";
            const reply = `💰 *DOMPET KEUANGAN*\n-------------------\n📈 Masuk: ${formatRupiah(masuk)}\n📉 Keluar: ${formatRupiah(keluar)}\n💵 *SALDO: ${formatRupiah(saldo)}*\n\n${status}`;

            client.sendMessage(chatDestination, reply);
        });
        return true;
    }

    // --- FITUR 4: REKAP HARI INI (!today) ---
    if (cmd.startsWith('!today')) {
        const sql = "SELECT * FROM transaksi WHERE DATE(tanggal) = CURDATE() ORDER BY id DESC";

        db.query(sql, async (err, rows) => {
            if (err) return client.sendMessage(chatDestination, '❌ Gagal tarik data.');
            if (rows.length === 0) return client.sendMessage(chatDestination, "📅 Belum ada transaksi hari ini.");

            let rep = `📅 *REKAP HARI INI*\n`;
            let totalKeluar = 0;

            rows.forEach(r => {
                const icon = r.jenis === 'masuk' ? '🟢' : '🔴';

                // FIX NAN: Paksa nominal jadi Number sebelum dipake
                const nom = Number(r.nominal);

                // 👇👇 INI YANG TADI ILANG, SEKARANG UDAH ADA 👇👇
                // Nampilin nama pelaku transaksi [sumber]
                rep += `\n${icon} [${r.sumber}] ${formatRupiah(nom)} - ${r.keterangan}`;

                // FIX NAN: Penjumlahan aman
                if (r.jenis === 'keluar') totalKeluar += nom;
            });

            rep += `\n\n📉 *Total Keluar:* ${formatRupiah(totalKeluar)}`;
            client.sendMessage(chatDestination, rep);
        });
        return true;
    }

    return false;
};

// METADATA MENU
module.exports.metadata = {
    category: "KEUANGAN",
    commands: [
        { command: '!catat', desc: 'Catat otomatis AI' },
        { command: '!in', desc: 'Catat pemasukan manual' },
        { command: '!out', desc: 'Catat pengeluaran manual' },
        { command: '!saldo', desc: 'Cek sisa saldo & rekap' },
        { command: '!today', desc: 'Cek pengeluaran hari ini' }
    ]
};