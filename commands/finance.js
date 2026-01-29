const Transaction = require('../models/Transaction');
const { formatRupiah } = require('../utils/formatter');

module.exports = async (client, msg, args, senderId) => {
    // args[0] = command (!catat), args[1] = jenis, dst...
    const command = args[0];

    if (command === '!catat') {
        const jenis = args[1];
        const nominal = parseInt(args[2]);
        const ket = args.slice(3).join(' ');

        if (!['pemasukan', 'pengeluaran'].includes(jenis) || isNaN(nominal)) {
            return msg.reply('Format: !catat [pemasukan/pengeluaran] [nominal] [ket]');
        }

        await Transaction.add(senderId, jenis, nominal, ket, 'WhatsApp');
        return msg.reply(`✅ Sukses catat ${jenis}: ${formatRupiah(nominal)}`);
    }

    if (command === '!saldo') {
        const saldo = await Transaction.getBalance();
        return msg.reply(`💰 Saldo: *${formatRupiah(saldo)}*`);
    }
};

module.exports.metadata = {
    category: "KEUANGAN",
    commands: [
        { command: '!catat', desc: 'Catat duit' },
        { command: '!saldo', desc: 'Cek saldo' }
    ]
};