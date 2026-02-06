const fs = require('fs');
const path = require('path');
const config = require('../config');

module.exports = async (client, msg, args, senderId, namaPengirim) => {
    const command = args[0];

    // --- PING ---
    if (command === '!ping') {
        const start = Date.now();
        await client.sendMessage(msg.from, "Pong!");
        const latency = Date.now() - start;
        return client.sendMessage(msg.from, `📶 Latency: ${latency}ms`);
    }

    // --- CEK ID ---
    if (command === '!cekid') {
        return msg.reply(`🆔 ID: \`${senderId}\`\n👤 Nama: ${namaPengirim}`);
    }

    // owner
    if (command === '!owner') {
        // 1. Ambil Nomor Owner dari Config
        let ownerId = config.ownerNumber[0]; // Ambil yang pertama

        // Jaga-jaga kalau di config cuma angka doang (misal: "628123")
        // Kita tambahin buntut '@c.us' biar valid
        if (!ownerId.includes('@c.us')) ownerId += '@c.us';

        try {
            // 2. Comot Data Kontak Asli dari WhatsApp
            const contact = await client.getContactById(ownerId);

            // 3. Kirim Kartu Nama
            // Bot bakal ngirim Contact Card beneran, bukan teks.
            await msg.reply(msg.from, contact);

            // (Opsional) Tambahin teks di bawahnya biar sopan
            // await msg.reply("Itu kontak bos saya. Jangan dispam ya! 🤖");

        } catch (e) {
            // Fallback: Kalau gagal ambil kontak, kirim teks biasa aja
            console.error("Gagal kirim kontak:", e);
            msg.reply(`👤 Owner: ${config.creator}\n📞 Wa: https://wa.me/${ownerId.split('@')[0]}`);
        }
        return true;
    }


    // --- MENU OTOMATIS ---
    if (command === '!menu' || command === '!help') {
        let menu = `🤖 *${config.botName} MENU* 🤖\n_Halo ${namaPengirim}!_\n\n`;

        const commandFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.js'));
        const categories = {};

        // 1. CEK SIAPA YANG MINTA MENU?
        // Kalau di Gatekeeper tadi dia dilabeli "Guest", berarti dia orang asing.
        const isGuest = namaPengirim === 'Guest';

        for (const file of commandFiles) {
            try {
                const cmdModule = require(path.join(__dirname, file));
                if (cmdModule.metadata) {
                    const { category, commands } = cmdModule.metadata;
                    if (!categories[category]) categories[category] = [];

                    commands.forEach(c => {
                        // 🔥 FILTER SAKTI DI SINI 🔥
                        // Masukin ke list JIKA:
                        // 1. Commandnya Public (Boleh buat umum)
                        // 2. ATAU Yang minta BUKAN Guest (Berarti Owner/Teman)

                        if (c.isPublic || !isGuest) {
                            categories[category].push(`• *${c.command}*: ${c.desc}`);
                        }
                    });
                }
            } catch (e) { }
        }

        const icons = { 'KEUANGAN': '💰', 'AI': '🧠', 'DOWNLOADER': '📥', 'MEDIA': '🎬', 'SYSTEM': '⚙️', 'LAINNYA': '📂' };

        for (const [cat, cmds] of Object.entries(categories)) {
            // 🔥 HANYA TAMPILKAN KATEGORI KALAU ADA ISINYA
            // Jadi kalau Guest buka menu, kategori "KEUANGAN" bakal ilang total (karena isinya kosong semua buat dia)
            if (cmds.length > 0) {
                const icon = icons[cat] || '📦';
                menu += `${icon} *${cat}*\n${cmds.join('\n')}\n\n`;
            }
        }

        const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        menu += ` _Waktu saat ini:_ 🕒 *${time}*`;

        msg.reply(menu);
        return true;
    }
};

module.exports.metadata = {
    category: "SYSTEM",
    commands: [
        { command: '!owner', desc: 'Kartu Nama Owner', isPublic: true },
        { command: '!menu', desc: 'Daftar Menu', isPublic: true },
        { command: '!ping', desc: 'Cek Sinyal', isPublic: true },
        { command: '!cekid', desc: 'Cek ID User', isPublic: true }
    ]
};