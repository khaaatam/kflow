const { MessageMedia } = require('whatsapp-web.js');
const Transaction = require('../models/Transaction');
const { formatRupiah } = require('../utils/formatter');
const model = require('../lib/ai');

module.exports = async (client, msg, args, senderId, namaPengirim, text) => {
    const command = args[0].toLowerCase();

    // ============================================================
    // 📝 1. FITUR CATAT (DUAL MODE: MANUAL & AI)
    // ============================================================
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
            await msg.react('🧠');
            try {
                // Prompt AI yang lebih ketat ("Pawang")
                const prompt = `
                Role: Finance Assistant.
                Tugas: Analisa teks transaksi: "${rawText}"
                
                Aturan Wajib:
                1. "jenis": HANYA BOLEH "pemasukan" ATAU "pengeluaran". (Jangan "pembelian", "expense", dll).
                2. "nominal": Ubah ke ANGKA INTEGER. (Contoh: "10k"->10000, "2.5jt"->2500000). Hapus "Rp" atau titik.
                3. "keterangan": Ringkasan transaksi (Kapital awal).

                Output JSON Murni:
                {"jenis": "...", "nominal": 0, "keterangan": "..."}
                `;

                const result = await model.generateContent(prompt);
                const responseText = result.response.text();

                // Debugging
                console.log(`🧠 AI Response: ${responseText}`);

                const jsonStart = responseText.indexOf('{');
                const jsonEnd = responseText.lastIndexOf('}');
                if (jsonStart === -1) throw new Error("No JSON");

                const data = JSON.parse(responseText.substring(jsonStart, jsonEnd + 1));

                // 🛡️ PAWANG JENIS (MAPPING MANUAL ANTI-ERROR)
                let rawJenis = data.jenis ? data.jenis.toLowerCase() : '';

                if (['beli', 'bayar', 'jajan', 'belanja', 'keluar', 'expense', 'cost'].some(x => rawJenis.includes(x))) {
                    jenis = 'pengeluaran';
                } else if (['dapet', 'terima', 'gaji', 'masuk', 'income', 'nemu'].some(x => rawJenis.includes(x))) {
                    jenis = 'pemasukan';
                } else {
                    jenis = ['pemasukan', 'pengeluaran'].includes(rawJenis) ? rawJenis : 'pengeluaran';
                }

                // 🛡️ PEMBERSIH NOMINAL
                if (typeof data.nominal === 'string') {
                    nominal = parseInt(data.nominal.replace(/[^0-9]/g, ''));
                } else {
                    nominal = data.nominal;
                }

                ket = data.keterangan;

            } catch (e) {
                console.error("AI Error:", e);
                return msg.reply("❌ AI Pusing. Pake manual aja: `!catat pengeluaran 15000 bakso`");
            }
        }

        // C. VALIDASI AKHIR
        if (!['pemasukan', 'pengeluaran'].includes(jenis) || isNaN(nominal)) {
            return msg.reply("❌ Gagal deteksi. Pastikan nominal jelas (contoh: 15rb, 20k, 50000).");
        }

        // D. SIMPAN KE DB
        try {
            await Transaction.add(senderId, jenis, nominal, ket, 'WhatsApp');
        } catch (dbError) {
            console.error("DB Insert Error:", dbError);
            return msg.reply("❌ Error Database: Gagal menyimpan transaksi.");
        }

        // E. REPLY SUKSES
        const icon = jenis === 'pemasukan' ? '📈' : '📉';
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

    // ============================================================
    // 💰 2. FITUR SALDO
    // ============================================================
    if (command === '!saldo') {
        const saldo = await Transaction.getBalance();
        return msg.reply(`💰 *Saldo Rekening Bersama*\nJumlah: *${formatRupiah(saldo)}*`);
    }

    // ============================================================
    // 📊 3. FITUR LAPORAN (CUSTOM RANGE) - NEW!
    // ============================================================
    if (command === '!laporan' || command === '!rekap') {
        let startDate, endDate, labelPeriode;
        const arg1 = args[1] ? args[1].toLowerCase() : '7'; // Default 7 hari

        const months = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
        const currentYear = new Date().getFullYear();

        // MODE A: BULANAN (Contoh: !laporan januari)
        if (months.includes(arg1)) {
            const monthIndex = months.indexOf(arg1);
            startDate = new Date(currentYear, monthIndex, 1);
            endDate = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59);
            labelPeriode = `Bulan ${arg1.toUpperCase()} ${currentYear}`;
        }

        // MODE B: RANGE TANGGAL (Contoh: !laporan 01/01/2025 - 10/01/2025)
        else if (text.includes('-') && text.match(/\d/)) {
            const rangeText = text.replace(command, '').trim();
            const parts = rangeText.split('-').map(s => s.trim());

            if (parts.length === 2) {
                const parseDate = (str) => {
                    const [d, m, y] = str.split('/');
                    return new Date(`${y}-${m}-${d}`);
                };
                try {
                    startDate = parseDate(parts[0]);
                    endDate = parseDate(parts[1]);
                    endDate.setHours(23, 59, 59);
                    labelPeriode = `Periode ${parts[0]} s/d ${parts[1]}`;
                } catch (e) {
                    return msg.reply("❌ Format tanggal salah. Gunakan: `DD/MM/YYYY - DD/MM/YYYY`");
                }
            } else {
                return msg.reply("❌ Format range salah. Gunakan pemisah strip (-).");
            }
        }

        // MODE C: HARIAN (Contoh: !laporan 7)
        else {
            const days = parseInt(arg1) || 7;
            endDate = new Date();
            startDate = new Date();
            startDate.setDate(endDate.getDate() - days);
            labelPeriode = `${days} Hari Terakhir`;
        }

        // Format ke SQL (YYYY-MM-DD HH:mm:ss)
        const toSQL = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
        const sqlStart = toSQL(startDate);
        const sqlEnd = toSQL(endDate);

        await msg.react('📊');

        // AMBIL DATA DARI MODEL
        const stats = await Transaction.getStatsCustom(sqlStart, sqlEnd);
        const history = await Transaction.getListCustom(sqlStart, sqlEnd);

        const masuk = stats.total_masuk || 0;
        const keluar = stats.total_keluar || 0;
        const selisih = masuk - keluar;

        // FORMAT LIST TRANSAKSI
        const recentList = history.slice(0, 15).map(t => {
            const icon = t.jenis === 'pemasukan' ? '🟢' : '🔴';
            const date = new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
            return `${icon} ${t.keterangan} (*${formatRupiah(t.nominal)}*) - _[${date}]_`;
        }).join('\n');

        let msgReply = `📊 *LAPORAN KEUANGAN*\n`;
        msgReply += `📅 _${labelPeriode}_\n`;
        msgReply += `----------------------------------\n`;
        msgReply += `📈 Masuk: ${formatRupiah(masuk)}\n`;
        msgReply += `📉 Keluar: ${formatRupiah(keluar)}\n`;
        msgReply += `💵 *Flow: ${formatRupiah(selisih)}* ${selisih >= 0 ? '🤑' : '🔻'}\n`;
        msgReply += `----------------------------------\n`;
        msgReply += `📝 *Rincian Transaksi:*\n${recentList || '_Tidak ada data._'}\n`;

        return msg.reply(msgReply);
    }

    // ============================================================
    // 📈 4. FITUR GRAFIK (PIE CHART)
    // ============================================================
    if (command === '!grafik') {
        await msg.react('🎨');

        const stats = await Transaction.getStats(); // Ambil total seumur hidup
        const masuk = stats.total_masuk || 0;
        const keluar = stats.total_keluar || 0;
        const saldo = masuk - keluar;

        if (masuk === 0 && keluar === 0) return msg.reply("❌ Belum ada data transaksi.");

        const chartConfig = {
            type: 'doughnut',
            data: {
                labels: ['Pemasukan', 'Pengeluaran'],
                datasets: [{
                    data: [masuk, keluar],
                    backgroundColor: ['rgb(46, 204, 113)', 'rgb(231, 76, 60)'],
                    borderWidth: 0
                }]
            },
            options: {
                plugins: {
                    doughnutlabel: {
                        labels: [
                            { text: formatRupiah(saldo), font: { size: 20, weight: 'bold' } },
                            { text: 'Sisa Saldo', font: { size: 10 } }
                        ]
                    },
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Statistik Keuangan Kita' }
                }
            }
        };

        const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=500&h=500`;

        try {
            const media = await MessageMedia.fromUrl(url, { unsafeMime: true });
            await client.sendMessage(msg.from, media, { caption: `📊 *Visualisasi Keuangan*\n\n📈 Masuk: ${formatRupiah(masuk)}\n📉 Keluar: ${formatRupiah(keluar)}\n💵 Saldo: ${formatRupiah(saldo)}` });
        } catch (e) {
            console.error(e);
            msg.reply("❌ Gagal bikin grafik.");
        }
    }
};

module.exports.metadata = {
    category: "KEUANGAN",
    commands: [
        { command: '!catat', desc: 'Catat duit (AI/Manual)' },
        { command: '!saldo', desc: 'Cek saldo bersama' },
        { command: '!laporan', desc: 'Laporan (Hari/Bulan/Range)' },
        { command: '!grafik', desc: 'Lihat grafik keuangan' }
    ]
};