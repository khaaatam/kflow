const config = require('../config');
const db = require('../lib/database');

// Import Command
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
    tami: require('../commands/tami')
};

module.exports = async (client, msg) => {
    try {
        const rawText = msg.body;
        const text = rawText.toLowerCase().trim();

        // [FILTER] Skip Status & System Message
        if (msg.from === 'status@broadcast' || msg.type === 'e2e_notification' || msg.type === 'call_log') return;

        // [IDENTIFIKASI] Sender ID
        let senderId = msg.fromMe ? client.info.wid._serialized : (msg.author || msg.from);
        if (!senderId) return;

        // --- LEVEL 1: GATEKEEPER (USER CHECK) ---
        const namaPengirim = config.users[senderId];
        if (!namaPengirim) return; // Ignore unknown users

        // --- LEVEL 2: ADMIN & LOGGING ---
        if (await commands.admin(client, msg, text, db)) return;

        // Log Chat (Async)
        const isForwarded = msg.isForwarded ? 1 : 0;
        db.query(
            "INSERT INTO full_chat_logs (nama_pengirim, pesan, is_forwarded) VALUES (?, ?, ?)",
            [namaPengirim, rawText, isForwarded]
        ).catch(e => console.error("Log Error:", e.message));

        // --- LEVEL 3: COMMAND ROUTER ---

        // Cek satu-satu command (Urutan Prioritas)
        if (await commands.system(client, msg, text, senderId, namaPengirim)) return;
        if (await commands.finance(client, msg, text)) return;
        if (await commands.stats(client, msg, text, db)) return;
        if (await commands.saran(client, msg, text, db)) return;
        if (await commands.tami(client, msg, text, db)) return;
        if (await commands.ai.interact(client, msg, text, db, namaPengirim)) return;

        // Command Utilities
        if (text.startsWith('!event') && await commands.event(client, msg, text, db, senderId)) return;
        if ((text.startsWith('!ingatin') || text.startsWith('!remind')) && await commands.reminder(client, msg, text, db, senderId)) return;
        if (text === '!ayang' && await commands.ayang(client, msg, db, namaPengirim)) return;

        // --- LEVEL 4: AI OBSERVER (AUTO-LEARN) ---

        // Kalau pesan diawali '!', berarti itu command tapi gak dikenali di atas.
        // Langsung return biar gak dianggap "fakta baru" sama observer.
        if (text.startsWith('!')) return;

        // Filter: Jangan belajar dari respon bot sendiri
        if (msg.fromMe) {
            const botKeywords = ['✅', '❌', '⚠️', '🤯', '🤖', 'system log', 'memori baru'];
            if (botKeywords.some(keyword => text.includes(keyword))) return;
        }

        // Jalankan AI Observer (Belajar pasif)
        await commands.ai.observe(client, msg, db, namaPengirim);

    } catch (error) {
        console.log('❌ Error Message Handler:', error);
    }
};