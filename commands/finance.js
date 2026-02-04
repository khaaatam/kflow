const Transaction = require('../models/Transaction');
const { formatRupiah } = require('../utils/formatter');
const model = require('../lib/ai');

module.exports = async (client, msg, args, senderId, namaPengirim, text) => {
    const command = args[0].toLowerCase();

    // --- 1. FITUR CATAT (DUAL MODE) ---
    if (command === '!catat') {
        let jenis, nominal, ket;
        const rawText = text.replace(args[0], '').trim();

        if (!rawText) return msg.reply("Mana catatannya? Contoh: `!catat abis beli bakso 15rb`");

        // A. FORMAT MANUAL (Cek pola baku)
        // Contoh: !catat pengeluaran 15000 bakso
        if (args[1] && ['pemasukan', 'pengeluaran'].includes(args[1].toLowerCase()) && !isNaN(parseInt(args[2]))) {
            jenis = args[1].toLowerCase();
            nominal = parseInt(args[2]);
            ket = args.slice(3).join(' ') || 'Tanpa Keterangan';
        }

        // B. FORMAT AI (Cek pola kalimat bebas)
        // Contoh: !catat tadi abis beli bensin 20k
        else {
            await msg.react('🧠'); // Kasih reaksi biar tau lagi mikir
            try {
                const prompt = `
                Role: Finance Assistant.
                Tugas: Ekstrak data keuangan dari teks: "${rawText}"
                Aturan:
                1. "jenis": "pemasukan" atau "pengeluaran".
                2. "nominal": Integer murni (contoh: "15rb"->15000, "2jt"->2000000).
                3. "keterangan": Ringkasan singkat kapital awal.
                Output JSON: {"jenis": "...", "nominal": 0, "keterangan": "..."}
                `;

                const result = await model.generateContent(prompt);
                const responseText = result.response.text();

                // Teknik Bedah JSON (Ambil cuma yang di dalam kurung kurawal)
                const jsonStart = responseText.indexOf('{');
                const jsonEnd = responseText.lastIndexOf('}');
                if (jsonStart === -1) throw new Error("No JSON found");

                const cleanJson = responseText.substring(jsonStart, jsonEnd + 1);
                const data = JSON.parse(cleanJson);

                // 🔥 PERBAIKAN PENTING DI SINI 🔥
                // Paksa jadi lowercase biar cocok sama ENUM database ('pemasukan', 'pengeluaran')
                jenis = data.jenis ? data.jenis.toLowerCase() : ''; 
                nominal = data.nominal;
                ket = data.keterangan;

            } catch (e) {
                console.error("AI Finance Error:", e);
                return msg.reply("❌ Gagal paham. Pake manual aja: `!catat pengeluaran 15000 bakso`");
            }
        }

        // C. VALIDASI AKHIR
        if (!['pemasukan', 'pengeluaran'].includes(jenis) || isNaN(nominal)) {
            return msg.reply("❌ Gagal deteksi. Pastikan nominal jelas (contoh: 15rb, 20k, 50000).");
        }

        // D. SIMPAN KE DB
        try {
            // Kita kirim senderId biar tercatat "Siapa yang jajan", 
            // tapi nanti saldo dihitung gabungan (Joint Account).
            await Transaction.add(senderId, jenis, nominal, ket, 'WhatsApp');
        } catch (dbError) {
            console.error("DB Insert Error:", dbError);
            return msg.reply("❌ Error Database: Gagal menyimpan transaksi.");
        }

        // E. REPLY SUKSES
        const icon = jenis === 'pemasukan' ? '📈' : '📉';
        const saldoAkhir = await Transaction.getBalance(); // Saldo Bersama

        return msg.reply(
            `✅ *TRANSAKSI BERHASIL*\n` +
            `${icon} Jenis: ${jenis.toUpperCase()}\n` +
            `💰 Nominal: ${formatRupiah(nominal)}\n` +
            `📝 Ket: ${ket}\n` +
            `👤 Oleh: ${namaPengirim}\n` +
            `-------------------------\n` +
            `💵 *Saldo Bersama: ${formatRupiah(saldoAkhir)}*`
        );
    }

    // --- 2. FITUR SALDO ---
    if (command === '!saldo') {
        const saldo = await Transaction.getBalance();
        return msg.reply(`💰 *Saldo Rekening Bersama*\nJumlah: *${formatRupiah(saldo)}*`);
    }
};

module.exports.metadata = {
    category: "KEUANGAN",
    commands: [
        { command: '!catat', desc: 'Catat duit (AI/Manual)' },
        { command: '!saldo', desc: 'Cek saldo bersama' }
    ]
};