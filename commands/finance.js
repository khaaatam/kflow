const { MessageMedia } = require('whatsapp-web.js');
const Transaction = require('../models/Transaction');
const { formatRupiah } = require('../utils/formatter');
const model = require('../lib/ai');
const logger = require('../lib/logger');
const react = require('../lib/react');

module.exports = async (client, msg, args, senderId, namaPengirim, text) => {
    const command = args[0].toLowerCase();

    // ============================================================
    // 📝 1. FITUR CATAT (DUAL MODE: MANUAL & AI)
    // ============================================================
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
            await react(msg, '🧠'); 
            try {
                const prompt = `
                Role: Finance Assistant.
                Tugas: Analisa teks transaksi: "${rawText}"
                Aturan Wajib:
                1. "jenis": HANYA BOLEH "pemasukan" ATAU "pengeluaran".
                2. "nominal": Ubah ke ANGKA INTEGER.
                3. "keterangan": Ringkasan transaksi (Kapital awal).
                Output JSON Murni: {"jenis": "...", "nominal": 0, "keterangan": "..."}`;

                const result = await model.generateContent(prompt);
                const responseText = result.response.text();
                
                const jsonStart = responseText.indexOf('{');
                const jsonEnd = responseText.lastIndexOf('}');
                if (jsonStart === -1) throw new Error("No JSON");
                
                const data = JSON.parse(responseText.substring(jsonStart, jsonEnd + 1));
                
                // MAPPING JENIS
                let rawJenis = data.jenis ? data.jenis.toLowerCase() : '';
                if (['beli', 'bayar', 'jajan', 'belanja', 'keluar', 'expense'].some(x => rawJenis.includes(x))) jenis = 'pengeluaran';
                else if (['dapet', 'terima', 'gaji', 'masuk', 'income'].some(x => rawJenis.includes(x))) jenis = 'pemasukan';
                else jenis = ['pemasukan', 'pengeluaran'].includes(rawJenis) ? rawJenis : 'pengeluaran';

                // CLEAN NOMINAL
                nominal = typeof data.nominal === 'string' ? parseInt(data.nominal.replace(/[^0-9]/g, '')) : data.nominal;
                ket = data.keterangan;

            } catch (e) {
                logger.error("AI Error:", e);
                return msg.reply("❌ AI Pusing. Pake manual aja: `!catat pengeluaran 15000 bakso`");
            }
        }

        if (!['pemasukan', 'pengeluaran'].includes(jenis) || isNaN(nominal)) {
            return msg.reply("❌ Gagal deteksi nominal/jenis.");
        }

        try {
            await Transaction.add(senderId, jenis, nominal, ket, 'WhatsApp');
        } catch (dbError) {
            logger.error("DB Insert Error:", dbError);
            return msg.reply("❌ Error Database: " + dbError.message);
        }

        const icon = jenis === 'pemasukan' ? '📈' : '📉';
        const saldoAkhir = await Transaction.getBalance();

await react(msg, '✅');
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
    // 📊 3. FITUR LAPORAN (FIX TIMEZONE) 🕒
    // ============================================================
    if (command === '!laporan' || command === '!rekap') {
        let startDate, endDate, labelPeriode;
        const arg1 = args[1] ? args[1].toLowerCase() : '7';

        const months = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
        const currentYear = new Date().getFullYear();

        // 👇 FUNGSI PENTING: KONVERSI TANGGAL LOKAL (BUKAN UTC)
        // Biar query database '2026-02-05' cocok sama jam komputer lu
        const toLocalSQL = (d) => {
            const pad = (n) => n.toString().padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        };

        // A. MODE BULANAN
        if (months.includes(arg1)) {
            const monthIndex = months.indexOf(arg1);
            startDate = new Date(currentYear, monthIndex, 1);
            endDate = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59);
            labelPeriode = `Bulan ${arg1.toUpperCase()} ${currentYear}`;
        }
        // B. MODE RANGE (dd/mm/yyyy - dd/mm/yyyy)
        else if (text.includes('-') && text.match(/\d/)) {
            const parts = text.replace(command, '').trim().split('-').map(s => s.trim());
            if (parts.length === 2) {
                try {
                    const parseDate = (s) => { const [d,m,y] = s.split('/'); return new Date(`${y}-${m}-${d}`); };
                    startDate = parseDate(parts[0]);
                    endDate = parseDate(parts[1]);
                    endDate.setHours(23, 59, 59);
                    labelPeriode = `Periode ${parts[0]} s/d ${parts[1]}`;
                } catch { return msg.reply("❌ Format salah. Contoh: `!laporan 01/01/2026 - 10/01/2026`"); }
            }
        }
        // C. MODE HARIAN (Default)
        else {
            const days = parseInt(arg1) || 7;
            endDate = new Date(); // Sekarang (Jam Lokal)
            startDate = new Date();
            startDate.setDate(endDate.getDate() - days);
            labelPeriode = `${days} Hari Terakhir`;
        }

        await react(msg, '📊');

        // Pake fungsi konversi lokal yang baru
        const sqlStart = toLocalSQL(startDate);
        const sqlEnd = toLocalSQL(endDate);

        logger.debug(`Debug Query: ${sqlStart} s/d ${sqlEnd}`);

        const stats = await Transaction.getStatsCustom(sqlStart, sqlEnd);
        const history = await Transaction.getListCustom(sqlStart, sqlEnd);
        
        const masuk = stats.total_masuk || 0;
        const keluar = stats.total_keluar || 0;
        const selisih = masuk - keluar;

        // FORMAT LIST
        const recentList = history.slice(0, 15).map(t => {
            const icon = t.jenis === 'pemasukan' ? '🟢' : '🔴';
            // Pakai t.tanggal karena kita udah sepakat pake kolom itu
            const date = new Date(t.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
            return `${icon} ${t.keterangan} (*${formatRupiah(t.nominal)}*) - _[${date}]_`;
        }).join('\n');

        let msgReply = `📊 *LAPORAN KEUANGAN*\n`;
        msgReply += `📅 _${labelPeriode}_\n`;
        msgReply += `----------------------------------\n`;
        msgReply += `📈 Masuk: ${formatRupiah(masuk)}\n`;
        msgReply += `📉 Keluar: ${formatRupiah(keluar)}\n`;
        msgReply += `💵 *Flow: ${formatRupiah(selisih)}* ${selisih >= 0 ? '🤑' : '🔻'}\n`;
        msgReply += `----------------------------------\n`;
        msgReply += `📝 *Rincian Transaksi:*\n${recentList || '_Tidak ada data di rentang waktu ini._'}\n`;

        await react(msg, '✅');
        return msg.reply(msgReply);
    }

    // ============================================================
    // 📈 4. FITUR GRAFIK
    // ============================================================
    if (command === '!grafik') {
        await react(msg, '🎨');
        const stats = await Transaction.getStats(); 
        const masuk = stats.total_masuk || 0;
        const keluar = stats.total_keluar || 0;
        const saldo = masuk - keluar;

        if (masuk === 0 && keluar === 0) return msg.reply("❌ Belum ada data.");

        const chartConfig = {
            type: 'doughnut',
            data: {
                labels: ['Pemasukan', 'Pengeluaran'],
                datasets: [{ data: [masuk, keluar], backgroundColor: ['#2ecc71', '#e74c3c'], borderWidth: 0 }]
            },
            options: {
                plugins: {
                    doughnutlabel: {
                        labels: [{ text: formatRupiah(saldo), font: { size: 20, weight: 'bold' } }, { text: 'Sisa Saldo', font: { size: 10 } }]
                    },
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Statistik Keuangan' }
                }
            }
        };

        const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=500&h=500`;
        try {
            const media = await MessageMedia.fromUrl(url, { unsafeMime: true });
            await client.sendMessage(msg.from, media, { caption: `📊 *Visualisasi Keuangan*\n\n📈 Masuk: ${formatRupiah(masuk)}\n📉 Keluar: ${formatRupiah(keluar)}\n💵 Saldo: ${formatRupiah(saldo)}` });
            await react(msg, '✅');
        } catch { await msg.reply("❌ Gagal bikin grafik."); }
    }
};

module.exports.metadata = {
    category: "KEUANGAN",
    commands: [
        { command: '!catat', desc: 'Catat duit (AI/Manual)' },
        { command: '!saldo', desc: 'Cek saldo bersama' },
        { command: '!laporan', desc: 'Laporan (Hari/Bulan)' },
        { command: '!grafik', desc: 'Grafik Visual' }
    ]
};