const config = require('../config');
const db = require('../lib/database');

// Import Command
const commands = {
    system: require('../commands/system'),
    finance: require('../commands/finance'), // Pastikan file finance.js udah diupdate kayak Tahap 1
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

        // Log Chat (Async - Gak perlu nungguin selesai)
        const isForwarded = msg.isForwarded ? 1 : 0;
        db.query(
            "INSERT INTO full_chat_logs (nama_pengirim, pesan, is_forwarded) VALUES (?, ?, ?)",
            [namaPengirim, rawText, isForwarded]
        ).catch(e => console.error("Log Error:", e.message));

        // --- LEVEL 3: COMMAND ROUTER ---

        // Cek satu-satu command (Urutan Prioritas)
        if (await commands.system(client, msg, text, senderId, namaPengirim)) return;
        if (await commands.finance(client, msg, text)) return; // Finance gak perlu DB lagi (udah internal)
        if (await commands.stats(client, msg, text, db)) return;
        if (await commands.saran(client, msg, text, db)) return;
        if (await commands.tami(client, msg, text, db)) return;

        // Command Utilities
        if (text.startsWith('!event') && await commands.event(client, msg, text, db, senderId)) return;
        if ((text.startsWith('!ingatin') || text.startsWith('!remind')) && await commands.reminder(client, msg, text, db, senderId)) return;
        if (text === '!ayang' && await commands.ayang(client, msg, db, namaPengirim)) return;

        // --- LEVEL 4: AI OBSERVER (AUTO-LEARN) ---
        if (text.startsWith('!')) return; // Jangan belajar dari command

        // Filter: Jangan belajar dari respon bot sendiri
        if (msg.fromMe) {
            const botKeywords = ['✅', '❌', '⚠️', '🤯', '🤖', 'system log', 'memori baru'];
            if (botKeywords.some(keyword => text.includes(keyword))) return;
        }

        // Jalankan AI
        await commands.ai.observe(client, msg, db, namaPengirim);

    } catch (error) {
        console.log('❌ Error Message Handler:', error);
    }
};