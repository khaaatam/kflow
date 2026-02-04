const Transaction = require('../models/Transaction');
const { formatRupiah } = require('../utils/formatter');
const model = require('../lib/ai');

module.exports = async (client, msg, args, senderId, namaPengirim, text) => {
    const command = args[0].toLowerCase();

    // --- 1. FITUR CATAT ---
    if (command === '!catat') {
        let jenis, nominal, ket;
        const rawText = text.replace(args[0], '').trim();

        if (!rawText) return msg.reply("Mana catatannya? Contoh: `!catat abis beli bakso 15rb`");

        // A. FORMAT MANUAL
        if (args[1] && ['pemasukan', 'pengeluaran'].includes(args[1].toLowerCase()) && !isNaN(parseInt(args[2]))) {
            jenis = args[1].toLowerCase();
            nominal = parseInt(args[2]);
            ket = args.slice(3).join(' ') || 'Tanpa Keterangan';
        }
        // B. FORMAT AI
        else {
            await msg.react('🧠');
            try {
                const prompt = `
                Role: Finance Assistant.
                Tugas: Ekstrak data keuangan dari teks: "${rawText}"
                Aturan:
                1. "jenis": "pemasukan" atau "pengeluaran".
                2. "nominal": Integer murni (contoh: "15rb"->15000, "2jt"->2000000).
                3. "keterangan": Ringkasan singkat.
                Output JSON: {"jenis": "...", "nominal": 0, "keterangan": "..."}
                `;

                const result = await model.generateContent(prompt);
                const responseText = result.response.text();

                // Ambil JSON murni (cegah error teks tambahan)
                const jsonStart = responseText.indexOf('{');
                const jsonEnd = responseText.lastIndexOf('}');
                if (jsonStart === -1) throw new Error("No JSON");

                const data = JSON.parse(responseText.substring(jsonStart, jsonEnd + 1));
                jenis = data.jenis;
                nominal = data.nominal;
                ket = data.keterangan;

            } catch (e) {
                console.error("AI Finance Error:", e);
                return msg.reply("❌ Gagal paham. Pake manual aja: `!catat pengeluaran 15000 bakso`");
            }
        }

        // C. VALIDASI
        if (!['pemasukan', 'pengeluaran'].includes(jenis) || isNaN(nominal)) {
            return msg.reply("❌ Nominal/Jenis tidak valid.");
        }

        // D. SIMPAN (Tetap catat SIAPA yang input, tapi saldo nanti nyatu)
        await Transaction.add(senderId, jenis, nominal, ket, 'WhatsApp');

        const icon = jenis === 'pemasukan' ? '📈' : '📉';
        // Infoin saldo akhir sekalian biar enak
        const saldoAkhir = await Transaction.getBalance();

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

    // --- 2. FITUR SALDO (JOINT ACCOUNT) ---
    if (command === '!saldo') {
        // Panggil TANPA senderId -> Hitung Global
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