const Transaction = require('../models/Transaction');
const { formatRupiah } = require('../utils/formatter');
const model = require('../lib/ai'); // 👈 Kita pinjem otak AI bentar

module.exports = async (client, msg, args, senderId, namaPengirim, text) => {
    const command = args[0];

    // --- 1. FITUR CATAT (DUAL MODE: MANUAL & AI) ---
    if (command === '!catat') {
        let jenis, nominal, ket;
        const rawText = text.replace(command, '').trim();

        if (!rawText) return msg.reply("Mana catatannya? Contoh: `!catat abis beli bakso 15rb`");

        // A. CEK FORMAT MANUAL (Kaku tapi Cepat)
        // Pola: !catat [pemasukan/pengeluaran] [angka] [ket]
        if (['pemasukan', 'pengeluaran'].includes(args[1]) && !isNaN(parseInt(args[2]))) {
            jenis = args[1];
            nominal = parseInt(args[2]);
            ket = args.slice(3).join(' ') || 'Tanpa Keterangan';
        }

        // B. CEK FORMAT KALIMAT (Pake AI)
        // Pola: !catat abis beli bensin ceban
        else {
            await msg.react('🧠'); // Kasih tanda lagi mikir

            try {
                const prompt = `
                Tugas: Ekstrak data keuangan dari teks: "${rawText}"
                
                Aturan Ekstraksi:
                1. "jenis": Tentukan "pemasukan" (uang masuk/gaji/nemu) atau "pengeluaran" (belanja/bayar/hilang).
                2. "nominal": Ubah ke angka integer (contoh: "15rb"->15000, "2jt"->2000000, "ceban"->10000, "goceng"->5000).
                3. "keterangan": Ringkasan transaksi (kapital awal).

                Output WAJIB JSON (Tanpa Markdown):
                {"jenis": "...", "nominal": 0, "keterangan": "..."}
                `;

                const result = await model.generateContent(prompt);
                const cleanJson = result.response.text().replace(/```json|```/g, '').trim();
                const data = JSON.parse(cleanJson);

                jenis = data.jenis;
                nominal = data.nominal;
                ket = data.keterangan;

            } catch (e) {
                console.error("AI Finance Error:", e);
                return msg.reply("❌ Gagal paham kalimat lu. Coba manual: `!catat pengeluaran 50000 bakso`");
            }
        }

        // C. VALIDASI AKHIR
        if (!['pemasukan', 'pengeluaran'].includes(jenis) || isNaN(nominal)) {
            return msg.reply("❌ Gagal deteksi nominal/jenis transaksi.");
        }

        // D. SIMPAN KE DB
        await Transaction.add(senderId, jenis, nominal, ket, 'WhatsApp');

        // E. REPLY KEREN
        const icon = jenis === 'pemasukan' ? '📈' : '📉';
        return msg.reply(`✅ *TRANSAKSI BERHASIL*\n${icon} Jenis: ${jenis.toUpperCase()}\n💰 Nominal: ${formatRupiah(nominal)}\n📝 Ket: ${ket}`);
    }

    // --- 2. FITUR SALDO ---
    if (command === '!saldo') {
        const saldo = await Transaction.getBalance();
        return msg.reply(`💰 Saldo Saat Ini: *${formatRupiah(saldo)}*`);
    }
};

module.exports.metadata = {
    category: "KEUANGAN",
    commands: [
        { command: '!catat', desc: 'Catat duit (Bisa kalimat bebas!)' },
        { command: '!saldo', desc: 'Cek sisa saldo' }
    ]
};