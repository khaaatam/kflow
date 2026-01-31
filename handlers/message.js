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

module.exports = async (client, msg) => {
    try {
        // Filter System Messages
        if (msg.isStatus || msg.type === 'e2e_notification' || msg.type === 'call_log') return;

        const body = msg.body || "";
        const senderId = msg.author || msg.from;
        const isGroup = msg.from.includes('@g.us');

        let namaPengirim = "User";
        if (msg.fromMe) {
            namaPengirim = "Tami"; 
        } else {
            try {
                const contact = await msg.getContact();
                namaPengirim = contact.pushname || contact.name || "User";
            } catch (e) { }
        }

        // 🔥 FIX SENDER ID SELF-CHAT
        const cleanId = String(senderId).replace('@c.us', '').replace('@g.us', '');

        // LOGGING DATABASE
        try {
            await db.query(
                "INSERT INTO full_chat_logs (nama_pengirim, pesan, is_forwarded) VALUES (?, ?, ?)",
                [namaPengirim, body, msg.isForwarded ? 1 : 0]
            );
        } catch (err) { }

        // ============================================================
        // A. HANDLE COMMANDS (!command)
        // ============================================================
        if (body.startsWith('!') || body.startsWith('/')) {
            const args = body.trim().split(/ +/);
            const commandName = args[0].toLowerCase(); // Lowercase buat command biasa

            // Cek command biasa
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
        // B. AUTO DOWNLOADER (LINK DETECTOR) - 🔥 FIX VITAL DISINI
        // ============================================================
        // 👇 PERUBAHAN 1: KITA HAPUS '!msg.fromMe'
        // Biar lu bisa test kirim link ke diri sendiri dan bot tetep respon!
        if (body.match(/(https?:\/\/[^\s]+)/g)) {
            
            // 👇 PERUBAHAN 2: ANTI-LOOP PROTECTION
            // Kalau bot ngirim video, biasanya captionnya "Facebook Video" atau "TikTok"
            // Kita skip biar bot gak mendeteksi captionnya sendiri sebagai link baru
            if (msg.fromMe && (body.includes('Facebook Video') || body.includes('TikTok') || body.includes('Download Sukses'))) return;

            if (isGroup) return; 

            const textLower = body.toLowerCase();
            
            // Cek Domain
            if (textLower.includes('tiktok.com') || 
                textLower.includes('facebook.com') || 
                textLower.includes('fb.watch') ||   // Support FB Watch
                textLower.includes('fb.com') ||     // Support FB Short
                textLower.includes('instagram.com')) {
                
                // 👇 PERUBAHAN 3: CARI COMMAND DENGAN DUA CARA
                // Cek '(auto detect)' (kecil) ATAU '(Auto Detect)' (Besar)
                // Ini biar gak error "Handler not found"
                const autoHandler = commands.get('(auto detect)') || commands.get('(Auto Detect)');

                if (autoHandler) {
                    console.log(`🔗 Link Detected: ${body.substring(0, 30)}... Executing Downloader.`);
                    // Panggil Handler Downloader
                    await autoHandler(client, msg, [], senderId, namaPengirim, body);
                    return;
                } else {
                    console.log("⚠️ Auto Detect Triggered, tapi command '(Auto Detect)' gak ketemu di Map!");
                    // Debug: List semua command biar ketahuan salah tulis dimana
                    console.log("Daftar Command Aktif:", [...commands.keys()]);
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