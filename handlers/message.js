const fs = require('fs');
const path = require('path');
const { observe } = require('../commands/ai');
const config = require('../config');
const db = require('../lib/database');

// PRE-LOAD COMMANDS
const commands = new Map();
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));

console.log('🔄 Loading Commands...');
for (const file of commandFiles) {
    try {
        const module = require(`../commands/${file}`);
        if (module.metadata && module.metadata.commands) {
            module.metadata.commands.forEach(cmd => {
                const handler = module.interact || module;
                // Simpan command apa adanya (Case Sensitive)
                commands.set(cmd.command, handler);
            });
        }
    } catch (e) { console.error(`Skip ${file}: ${e.message}`); }
}
console.log(`✅ ${commands.size} Commands Loaded!`);

const cooldowns = new Map();

module.exports = async (client, msg) => {
    try {
        if (msg.isStatus || msg.type === 'e2e_notification' || msg.type === 'call_log') return;

        const body = msg.body || "";
        const senderId = msg.author || msg.from;
        const isGroup = msg.from.includes('@g.us');

        // --- IDENTITY CHECK ---
        let namaPengirim = "User";
        if (msg.fromMe) {
            namaPengirim = "Tami";
        } else {
            try {
                const contact = await msg.getContact();
                namaPengirim = contact.pushname || contact.name || "User";
            } catch (e) { }
        }

        // SPY LOG (Biar lu tau siapa yang chat)
        console.log(`\n🕵️ [SPY] Chat dari: ${namaPengirim} | ID: ${senderId}`);

        // FIX SELF-CHAT ID
        const cleanId = String(senderId).replace('@c.us', '').replace('@g.us', '');

        // AUTO-LOGGING
        try {
            await db.query(
                "INSERT INTO full_chat_logs (nama_pengirim, pesan, is_forwarded) VALUES (?, ?, ?)",
                [namaPengirim, body, msg.isForwarded ? 1 : 0]
            );
        } catch (err) { }

        // ============================================================
        // A. HANDLE NORMAL COMMANDS (!command)
        // ============================================================
        if (body.startsWith('!') || body.startsWith('/')) {
            const args = body.trim().split(/ +/);
            const commandName = args[0].toLowerCase();

            if (commands.has(commandName)) {
                if (cooldowns.has(senderId)) {
                    if (Date.now() < cooldowns.get(senderId) + 1500) return;
                }

                const handler = commands.get(commandName);
                try {
                    await handler(client, msg, args, senderId, namaPengirim, body);
                } catch (e) { console.error(`Command Error: ${e.message}`); }

                cooldowns.set(senderId, Date.now());
                setTimeout(() => cooldowns.delete(senderId), 1500);
                return;
            }
        }

        // ============================================================
        // B. AUTO DOWNLOADER (LINK DETECTOR) - 🔥 FIX DISINI 🔥
        // ============================================================
        if (body.match(/(https?:\/\/[^\s]+)/g) && !msg.fromMe) {
            if (isGroup) return;

            const textLower = body.toLowerCase();

            // 1. Cek Domain (Lengkap: FB, TikTok, IG)
            if (textLower.includes('tiktok.com') ||
                textLower.includes('facebook.com') ||
                textLower.includes('fb.watch') ||   // Support FB Watch
                textLower.includes('fb.com') ||     // Support FB Short
                textLower.includes('instagram.com')) {

                // 2. CARI COMMAND (DUAL KEY LOOKUP)
                // Cek '(auto detect)' ATAU '(Auto Detect)' biar ga salah panggil
                const autoHandler = commands.get('(auto detect)') || commands.get('(Auto Detect)');

                if (autoHandler) {
                    console.log(`🔗 Link Detected: ${body.substring(0, 30)}... executing Auto Detect.`);
                    await autoHandler(client, msg, [], senderId, namaPengirim, body);
                    return;
                } else {
                    console.log("⚠️ Auto Detect Triggered, tapi command '(auto detect)' gak ketemu di Map!");
                }
            }
        }

        if (msg.fromMe) return;

        // ============================================================
        // C. AI OBSERVER
        // ============================================================
        if (!body.startsWith('!') && !isGroup) {
            observe(client, msg, namaPengirim).catch(() => { });
        }

    } catch (error) {
        console.error("Handler Fatal Error:", error);
    }
};