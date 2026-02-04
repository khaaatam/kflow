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
                commands.set(cmd.command, handler);
            });
        }
    } catch (e) { console.error(`Skip ${file}: ${e.message}`); }
}
console.log(`✅ ${commands.size} Commands Loaded!`);

const cooldowns = new Map();

// FUNGSI UTAMA HANDLER
const messageHandler = async (client, msg) => {
    try {
        if (msg.isStatus || msg.type === 'e2e_notification' || msg.type === 'call_log') return;

        const body = msg.body || "";
        const senderId = msg.author || msg.from;
        const isGroup = msg.from.includes('@g.us');


        // ============================================================
        // 🛑 1. THE GATEKEEPER (SMART FILTER - PUBLIC FRIENDLY)
        // ============================================================

        let namaPengirim = config.users[senderId];

        // A. COMMAND PUBLIK (Boleh dipake siapa aja)
        const publicCommands = ['!cekid', '!ping', '!owner', '!menu', '!retro'];
        const isPublicCommand = publicCommands.some(cmd => body.toLowerCase().startsWith(cmd));

        // B. LINK DOWNLOADER (TikTok/FB/IG boleh dipake siapa aja)
        const isLink = body.match(/(https?:\/\/[^\s]+)/g);
        const isDownloaderLink = isLink && (
            body.toLowerCase().includes('tiktok.com') ||
            body.toLowerCase().includes('facebook.com') ||
            body.toLowerCase().includes('instagram.com')
        );

        // 🔥 LOGIKA NASIB USER 🔥
        // Kalau User GAK Dikenal...
        if (!namaPengirim) {
            // ...DAN dia BUKAN mau pake fitur bot (Bukan Command Publik & Bukan Link Download)
            if (!isPublicCommand && !isDownloaderLink) {
                return; // ⛔ USIR! (Gak dicatet, gak masuk DB)
            }
            // Kalau mau pake fitur, kasih nama "Guest"
            namaPengirim = "Guest";
        }

        // ============================================================
        // 🧹 2. CLEANER LOG (FILTER SAMPAH BOT)
        // ============================================================
        const cleanBody = body.trim();

        // Pake Regex Sakti: "Apakah diawali Emoji?" ATAU Kata Kunci Debug
        const isBotResponse = msg.fromMe && (
            /^\p{Extended_Pictographic}/u.test(cleanBody) ||
            cleanBody.includes('[DEBUG]') ||
            cleanBody.includes('SYSTEM ONLINE') ||
            cleanBody.includes('Ingatan Baru')
        );

        if (isBotResponse) return; // Stop log sampah

        console.log(`💬 [${namaPengirim}]: ${body}`);

        // ============================================================
        // 💾 3. DATABASE LOGGING
        // ============================================================
        try {
            await db.query(
                "INSERT INTO full_chat_logs (nama_pengirim, pesan, is_forwarded) VALUES (?, ?, ?)",
                [namaPengirim, body, msg.isForwarded ? 1 : 0]
            );
        } catch (err) { }

        // ============================================================
        // 🎮 4. HANDLE COMMANDS (!command)
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
                } catch (e) { console.error(`Cmd Error: ${e.message}`); }
                cooldowns.set(senderId, Date.now());
                setTimeout(() => cooldowns.delete(senderId), 1500);
                return;
            }
        }

        // ============================================================
        // 📥 5. AUTO DOWNLOADER (LINK DETECTOR)
        // ============================================================
        if (body.match(/(https?:\/\/[^\s]+)/g)) {

            // 🔥 UPDATE ANTI-LOOP V2 🔥
            // Kita HAPUS blokir 'fromMe' (biar lu bisa download).
            // Kita GANTI dengan blokir 'hasMedia'.
            // Karena "Looping" itu terjadi pas Bot ngirim Video Hasil Download (yang ada caption link).
            if (msg.hasMedia) return;

            if (isGroup) return;

            const textLower = body.toLowerCase();
            if (textLower.includes('tiktok.com') || textLower.includes('facebook.com') || textLower.includes('instagram.com')) {
                const autoHandler = commands.get('(auto detect)') || commands.get('(Auto Detect)');
                if (autoHandler) {
                    console.log(`🔗 Link Detected. Executing Downloader.`);
                    await autoHandler(client, msg, [], senderId, namaPengirim, body);
                    return;
                }
            }
        }

        // ============================================================
        // 🧠 6. AI OBSERVER (MATA-MATA)
        // ============================================================
        // Observer cuma jalan buat USER ASLI (Bukan Guest)
        // Biar database ingatan lu gak penuh sama curhatan orang asing
        if (!body.startsWith('!') && !isGroup && namaPengirim !== 'Guest') {
            observe(client, msg, namaPengirim).catch((e) => {
                console.error("Observer Fail:", e.message);
            });
        }

    } catch (error) {
        console.error("Handler Fatal Error:", error);
    }
};

module.exports = messageHandler;
module.exports.commands = commands;