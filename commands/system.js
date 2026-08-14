const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../lib/logger');
const { getStats } = require('../lib/sendWrapper');

module.exports = async (client, msg, args, senderId, namaPengirim) => {
    const command = args[0];

    // --- PING ---
    if (command === '!ping') {
        const start = Date.now();
        await msg.reply('Pong!');
        const latency = Date.now() - start;
        const stats = getStats();

        const uptimeMin = Math.floor(process.uptime() / 60);
        const uptimeHr = Math.floor(uptimeMin / 60);
        const mem = process.memoryUsage();
        const rssMB = (mem.rss / 1024 / 1024).toFixed(0);
        const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(0);

        let waStatus;
        try {
            const state = await client.pupPage.evaluate(() => {
                try { return window.Store?.State?.default?.state || 'unknown'; } catch { return 'unknown'; } // eslint-disable-line no-undef
            });
            waStatus = state === 'CONNECTED' ? '✅ Connected' : `⚠️ ${state}`;
        } catch { waStatus = '❓ error'; }

        const lines = [
            `📶 *PING REPORT*`,
            ``,
            `⏱️ *Send:* ${latency}ms`,
            stats.avgRealPing > 0 ? `📡 *Real RTT:* ${stats.avgRealPing}ms (avg)` : null,
            stats.lastLatency !== null ? `📊 *Avg Send:* ${stats.avgLatency}ms` : null,
            stats.pendingCount > 0 ? `📤 *Pending:* ${stats.pendingCount} send(s)` : null,
            ``,
            `🔗 WA: ${waStatus}`,
            `⏱️ Uptime: ${uptimeHr}j ${uptimeMin % 60}m`,
            `💾 RAM: ${rssMB}MB (heap: ${heapMB}MB)`
        ].filter(Boolean);

        return msg.reply(lines.join('\n'));
    }

    // --- CEK ID ---
    if (command === '!cekid') {
        const targetNumber = args[1];

        if (targetNumber) {
            try {
                let cleanNumber = targetNumber.replace(/[\s\-+]/g, '');
                if (cleanNumber.startsWith('0')) cleanNumber = '62' + cleanNumber.slice(1);

                const whatsappId = cleanNumber + '@c.us';
                const contact = await client.getContactById(whatsappId);

                if (contact) {
                    const isRegistered = contact.isRegistered !== false;
                    return msg.reply(
                        `📞 Nomor: ${cleanNumber}\n` +
                        `🆔 ID: \`${contact.id._serialized}\`\n` +
                        `📛 Nama: ${contact.pushname || '-'}\n` +
                        `${isRegistered ? '✅' : '❌'} ${isRegistered ? 'Terdaftar di WhatsApp' : 'Tidak terdaftar'}`
                    );
                } else {
                    return msg.reply(`❌ Nomor ${cleanNumber} tidak ditemukan.`);
                }
            } catch (e) {
                logger.error('CekID Error:', e.message || e);
                return msg.reply('❌ Gagal cek ID. Pastikan nomor valid.');
            }
        }

        return msg.reply(`🆔 ID: \`${senderId}\`\n👤 Nama: ${namaPengirim}`);
    }

    // --- OWNER ---
    if (command === '!owner') {
        let ownerId = config.ownerNumber[0];
        if (!ownerId.includes('@c.us')) ownerId += '@c.us';

        try {
            const contact = await client.getContactById(ownerId);
            await msg.reply(contact);
        } catch (e) {
            logger.error('Gagal kirim kontak:', e);
            await msg.reply(`👤 Owner: ${config.creator[0] || config.creator}\n📞 Wa: https://wa.me/${ownerId.split('@')[0]}`);
        }
        return true;
    }

    // --- MENU ---
    if (command === '!menu' || command === '!help' || command === '!bot') {
        const isGuest = namaPengirim === 'Guest';
        const commandFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.js'));
        const categories = {};
        const filterCat = args[1]?.toUpperCase();

        const icons = {
            'KEUANGAN': '💰', 'AI': '🧠', 'DOWNLOADER': '📥',
            'MEDIA': '🎬', 'SYSTEM': '⚙️', 'LAINNYA': '📂', 'GROUP': '👥',
            'EVENT': '📅'
        };

        let totalCommands = 0;

        for (const file of commandFiles) {
            try {
                const cmdModule = require(path.join(__dirname, file));
                if (cmdModule.metadata) {
                    const { category, commands } = cmdModule.metadata;
                    if (!categories[category]) categories[category] = [];

                    commands.forEach(c => {
                        if (c.isPublic || !isGuest) {
                            categories[category].push(c);
                            totalCommands++;
                        }
                    });
                }
            } catch { /* skip unreadable */ }
        }

        let menu = `🤖 *${config.botName}*\n`;
        menu += `Halo ${namaPengirim}!\n`;
        menu += `─────────────────\n\n`;

        if (filterCat && categories[filterCat]) {
            const icon = icons[filterCat] || '📦';
            menu += `${icon} *${filterCat}*\n`;
            categories[filterCat].forEach(c => {
                menu += `• *${c.command}* — ${c.desc}\n`;
            });
            menu += `\nGunakan \`!menu\` untuk melihat semua kategori.`;
        } else {
            for (const [cat, cmds] of Object.entries(categories)) {
                if (cmds.length > 0) {
                    const icon = icons[cat] || '📦';
                    menu += `${icon} *${cat}*\n`;
                    cmds.forEach(c => {
                        menu += `• *${c.command}* — ${c.desc}\n`;
                    });
                    menu += '\n';
                }
            }
        }

        const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        menu += `_${totalCommands} command tersedia_\n`;
        menu += `🕒 ${time}`;

        await msg.reply(menu);
        return true;
    }
};

module.exports.metadata = {
    category: 'SYSTEM',
    commands: [
        { command: '!owner', desc: 'Kartu Nama Owner', isPublic: true },
        { command: '!menu', desc: 'Daftar Menu (opsi: !menu <kategori>)', isPublic: true },
        { command: '!ping', desc: 'Cek Sinyal', isPublic: true },
        { command: '!cekid', desc: 'Cek ID (sendiri/nomor)', isPublic: true }
    ]
};
