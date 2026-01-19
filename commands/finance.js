// helper buat format duit rp
const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(angka);
};

module.exports = async (client, msg, text, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;
    const rawText = msg.body; // kita butuh text asli buat ambil case sensitive keterangan

    // --- FITUR 1: CATAT MASUK/KELUAR (!IN / !OUT) ---
    if (text.startsWith('!in') || text.startsWith('!out')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) return; // format salah, diem aja

        const jenis = text.startsWith('!in') ? 'masuk' : 'keluar';
        const nominal = parseInt(parts[1]);
        const ket = parts.slice(2).join(' ');

        if (isNaN(nominal)) return; // nominal bukan angka, diem aja

        const sql = "INSERT INTO transaksi (jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, ?)";
        db.query(sql, [jenis, nominal, ket, namaPengirim], async (err) => {
            if (!err) {
                try { await msg.react('✅'); } catch (e) { }
            } else {
                console.error('gagal input transaksi:', err);
                client.sendMessage(chatDestination, 'gagal catet bos. database error.');
            }
        });
        return;
    }

    // --- FITUR 2: CEK SALDO (!SALDO) ---
    if (text.startsWith('!saldo')) {
        const sql = `SELECT 
            (SELECT COALESCE(SUM(nominal),0) FROM transaksi WHERE jenis='masuk') as masuk, 
            (SELECT COALESCE(SUM(nominal),0) FROM transaksi WHERE jenis='keluar') as keluar`;

        db.query(sql, async (err, result) => {
            if (err) return client.sendMessage(chatDestination, 'gagal tarik data saldo.');

            const { masuk, keluar } = result[0];
            const saldo = masuk - keluar;

            const reply = `💰 *TABUNGAN BERSAMA*\n-------------------\n📈 masuk: ${formatRupiah(masuk)}\n📉 keluar: ${formatRupiah(keluar)}\n💵 *SALDO: ${formatRupiah(saldo)}*`;

            try { await client.sendMessage(chatDestination, reply); } catch (e) { msg.react('💰'); }
        });
        return;
    }

    // --- FITUR 3: REKAP HARI INI (!TODAY) ---
    if (text.startsWith('!today')) {
        const sql = "SELECT * FROM transaksi WHERE DATE(tanggal) = CURDATE() ORDER BY id DESC";

        db.query(sql, async (err, rows) => {
            if (err) return client.sendMessage(chatDestination, 'gagal tarik data harian.');
            if (rows.length === 0) return client.sendMessage(chatDestination, "belum ada transaksi hari ini.");

            let rep = `📅 *REKAP HARI INI*\n`;
            rows.forEach(r => {
                const icon = r.jenis === 'masuk' ? '🟢' : '🔴';
                rep += `\n${icon} [${r.sumber}] ${formatRupiah(r.nominal)} - ${r.keterangan}`;
            });

            try { await client.sendMessage(chatDestination, rep); } catch (e) { }
        });
        return;
    }
};