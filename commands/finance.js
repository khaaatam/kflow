const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Init AI
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// Helper: Format Rupiah biar enak dibaca
const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
};

module.exports = async (client, msg, text, db) => {
    // 1. DETEKSI NAMA PENGIRIM (OTOMATIS DI SINI)
    // Jadi app.js gak perlu ribet kirim parameter nama
    const contact = await msg.getContact();
    const namaPengirim = contact.pushname || contact.name || "Hamba Allah";
    
    const chatDestination = msg.fromMe ? msg.to : msg.from;
    const rawText = msg.body;
    const cmd = text.toLowerCase(); // biar gampang ngecek command

    // --- FITUR 1: AI SMART RECORDER (!catat) ---
    if (cmd.startsWith('!catat')) {
        const curhatan = rawText.replace(/!catat/i, '').trim();
        
        // Validasi kalau user cuma ketik !catat doang
        if (!curhatan) {
            return client.sendMessage(chatDestination, "⚠️ Mau nyatet apa?\nContoh: `!catat beli nasi padang 25rb sama bayar parkir 2000`");
        }

        await msg.react('💸'); // Kasih reaksi biar tau bot lagi mikir

        // Prompt buat AI
        const prompt = `
        Role: Asisten Keuangan Pribadi.
        Tugas: Ekstrak informasi keuangan dari teks user menjadi JSON.
        
        [STRUKTUR DATABASE]:
        - jenis: "masuk" (pemasukan/gaji) ATAU "keluar" (belanja/bayar).
        - nominal: integer (hanya angka).
        - keterangan: string (nama barang/aktivitas).

        [TEKS USER]:
        "${curhatan}"

        [ATURAN]:
        1. Ubah "20k" jadi 20000, "5jt" jadi 5000000, "goceng" jadi 5000.
        2. Pecah menjadi beberapa transaksi jika ada kata hubung (dan, sama, terus).
        3. Tentukan "jenis" secara otomatis berdasarkan konteks (beli/bayar/jajan = keluar, dapet/gaji/nemu = masuk).
        
        [OUTPUT JSON ONLY]:
        [
          { "jenis": "keluar", "nominal": 25000, "keterangan": "Nasi Padang" },
          { "jenis": "masuk", "nominal": 50000, "keterangan": "Nemu duit" }
        ]
        Hanya output JSON valid. Tanpa markdown.
        `;

        try {
            const result = await model.generateContent(prompt);
            const responseText = result.response.text().replace(/```json|```/g, '').trim(); // Bersihin format JSON
            const transactions = JSON.parse(responseText);

            let laporan = `✅ *TRANSAKSI BERHASIL DICATAT*\nUser: ${namaPengirim}\n\n`;

            // Loop buat masukin semua transaksi ke Database
            for (const t of transactions) {
                // Pastikan jenisnya cuma 'masuk' atau 'keluar' (sesuai ENUM db)
                let jenisFix = t.jenis.toLowerCase();
                if (jenisFix !== 'masuk' && jenisFix !== 'keluar') jenisFix = 'keluar'; 
                
                await new Promise((resolve) => {
                    const sql = "INSERT INTO transaksi (jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, ?)";
                    db.query(sql, [jenisFix, t.nominal, t.keterangan, namaPengirim], (err) => {
                        if (err) console.error("DB Error:", err);
                        resolve();
                    });
                });

                const icon = jenisFix === 'masuk' ? 'nm' : 'nr';
                laporan += `${icon} *${t.keterangan}*: ${formatRupiah(t.nominal)}\n`;
            }

            laporan += `\n_Data udah sinkron sama Web Dashboard!_`;
            await client.sendMessage(chatDestination, laporan);

        } catch (error) {
            console.error("AI Finance Error:", error);
            await client.sendMessage(chatDestination, "❌ Gagal mencerna nominal. Coba pake angka yang jelas, misal: '20rb' atau '20000'.");
        }
        return true; // Return true biar app.js tau command ini udah jalan
    }

    // --- FITUR 2: MANUAL (!in / !out) ---
    if (cmd.startsWith('!in') || cmd.startsWith('!out')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) return false; // Kalau format salah, skip

        const jenis = cmd.startsWith('!in') ? 'masuk' : 'keluar';
        const nominal = parseInt(parts[1]); // Ambil angka di kata kedua
        const ket = parts.slice(2).join(' '); // Sisanya jadi keterangan

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
                client.sendMessage(chatDestination, '❌ Gagal catet. Database error.');
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
            if (err) return client.sendMessage(chatDestination, '❌ Gagal tarik data saldo.');

            const { masuk, keluar } = result[0];
            const saldo = masuk - keluar;

            // Bumbu komentar AI
            let status = "";
            if (saldo < 50000) status = "⚠️ *KRITIS BOS!* Makan promag dulu.";
            else if (saldo < 200000) status = "⚠️ *Hati-hati*, saldo menipis.";
            else if (saldo > 5000000) status = "🤑 *SULTAN!* Gas modif Vario.";
            else status = "✅ *AMAN.* Masih bisa nafas.";

            const reply = `💰 *DOMPET KEUANGAN*\n-------------------\n📈 Total Masuk: ${formatRupiah(masuk)}\n📉 Total Keluar: ${formatRupiah(keluar)}\n💵 *SALDO SAAT INI: ${formatRupiah(saldo)}*\n\n${status}`;

            client.sendMessage(chatDestination, reply);
        });
        return true;
    }

    // --- FITUR 4: REKAP HARI INI (!today) ---
    if (cmd.startsWith('!today')) {
        const sql = "SELECT * FROM transaksi WHERE DATE(tanggal) = CURDATE() ORDER BY id DESC";

        db.query(sql, async (err, rows) => {
            if (err) return client.sendMessage(chatDestination, '❌ Gagal tarik data harian.');
            if (rows.length === 0) return client.sendMessage(chatDestination, "📅 Belum ada transaksi hari ini.");

            let rep = `📅 *REKAP TRANSAKSI HARI INI*\n`;
            let totalKeluar = 0;
            let totalMasuk = 0;

            rows.forEach(r => {
                const icon = r.jenis === 'masuk' ? '🟢' : '🔴';
                rep += `\n${icon} ${formatRupiah(r.nominal)} - ${r.keterangan}`;
                
                if (r.jenis === 'keluar') totalKeluar += r.nominal;
                if (r.jenis === 'masuk') totalMasuk += r.nominal;
            });

            rep += `\n\n📉 *Total Keluar:* ${formatRupiah(totalKeluar)}`;
            rep += `\n📈 *Total Masuk:* ${formatRupiah(totalMasuk)}`;
            
            client.sendMessage(chatDestination, rep);
        });
        return true;
    }

    return false; // Bukan command finance
};

module.exports.metadata = {
    category: "KEUANGAN",
    commands: [
        { command: '!catat [teks]', desc: 'Catat duit pake bahasa manusia (AI)' },
        { command: '!saldo', desc: 'Cek sisa uang' },
        { command: '!today', desc: 'Lihat pengeluaran hari ini' },
        { command: '!in / !out', desc: 'Catat manual (Format: !in 5000 ket)' }
    ]
};