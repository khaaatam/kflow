const config = require('../config');
const db = require('../lib/database');

const commands = {
    system: require('../commands/system'),
    finance: require('../commands/finance'),
    ai: require('../commands/ai'),
    reminder: require('../commands/reminder'),
    admin: require('../commands/admin'),
    ayang: require('../commands/ayang'),
    event: require('../commands/event'),
    stats: require('../commands/stats'),
    saran: require('../commands/saran'),
    tami: require('../commands/tami'),
    sticker: require('../commands/sticker'),
    downloader: require('../commands/downloader'),
    pixel: require('../commands/pixel')
};

module.exports = async (client, msg) => {
    try {
        const rawText = msg.body;
        const text = rawText.toLowerCase().trim();

        if (msg.from === 'status@broadcast' || msg.type === 'e2e_notification' || msg.type === 'call_log') return;

        // [IDENTIFIKASI] Sender ID
        let senderId = msg.fromMe ? client.info.wid._serialized : (msg.author || msg.from);

        // 👇 CLEANED: Gak perlu nyepam log setiap ada chat 👇
        // console.log(`📡 PESAN MASUK DARI: ${senderId}`); 

        if (!senderId) return;

        // --- LEVEL 1: GATEKEEPER ---
        const namaPengirim = config.users[senderId];
        if (!namaPengirim) {
            // console.log("⛔ DITOLAK: Nomor tidak terdaftar"); // CLEANED
            return;
        }

        // --- LEVEL 2: ADMIN & LOGGING ---
        if (await commands.admin(client, msg, text, db)) return;

        const isForwarded = msg.isForwarded ? 1 : 0;
        db.query(
            "INSERT INTO full_chat_logs (nama_pengirim, pesan, is_forwarded) VALUES (?, ?, ?)",
            [namaPengirim, rawText, isForwarded]
        ).catch(e => console.error("Log Error:", e.message));

        // --- LEVEL 3: COMMAND ROUTER ---
        if (await commands.system(client, msg, text, senderId, namaPengirim)) return;
        if (await commands.finance(client, msg, text)) return;
        if (await commands.stats(client, msg, text, db)) return;
        if (await commands.saran(client, msg, text, db)) return;
        if (await commands.tami(client, msg, text, db)) return;
        if (await commands.ai.interact(client, msg, text, db, namaPengirim)) return;
        if (await commands.downloader(client, msg, text)) return;
        if (await commands.pixel(client, msg, text)) return;

        if ((text === '!s' || text === '!sticker') && await commands.sticker(client, msg, text)) return;
        if (text.startsWith('!event') && await commands.event(client, msg, text, db, senderId)) return;
        if ((text.startsWith('!ingatin') || text.startsWith('!remind')) && await commands.reminder(client, msg, text, db, senderId)) return;
        if (text === '!ayang' && await commands.ayang(client, msg, db, namaPengirim)) return;


        // --- LEVEL 4: AI OBSERVER ---
        if (text.startsWith('!')) return;
        if (msg.fromMe) {
            const botKeywords = ['✅', '❌', '⚠️', '🤯', '🤖', 'system log', 'memori baru'];
            if (botKeywords.some(keyword => text.includes(keyword))) return;
        }

        await commands.ai.observe(client, msg, db, namaPengirim);

    } catch (error) {
        console.log('❌ Error Message Handler:', error);
    }
};