const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Inisialisasi Gemini
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, text, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    // --- FITUR 1: !INGAT MANUAL (TETEP ADA BUAT JAGA-JAGA) ---
    if (text.startsWith('!ingat')) {
        const faktaBaru = msg.body.replace(/!ingat/i, '').trim();
        if (!faktaBaru) return client.sendMessage(chatDestination, "apa yang harus gw inget?");

        db.query("INSERT INTO memori (fakta) VALUES (?)", [faktaBaru], (err) => {
            if (err) return client.sendMessage(chatDestination, "gagal simpen: " + err.message);
            client.sendMessage(chatDestination, "Oke, udah gw simpen manual ya.");
        });
        return;
    }

    // --- FITUR 2: !AI (PLUS AUTO-LEARNING) ---
    if (text.startsWith('!ai') || text.startsWith('!analisa')) {
        const promptUser = msg.body.replace(/!ai|!analisa/i, '').trim();
        if (!promptUser) return client.sendMessage(chatDestination, "Mau diskusi apa?");

        await msg.react('🤖');

        // Step 1: Tarik Data (Memori & History)
        const getMemori = new Promise((resolve) => {
            db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 10", (err, rows) => resolve(err ? [] : rows));
        });

        // Kita tarik 30 chat terakhir biar dia tau konteks panjang
        const getChatLogs = new Promise((resolve) => {
            db.query("SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 30", (err, rows) => {
                if (err || !rows) return resolve([]);
                resolve(rows.reverse());
            });
        });

        const [memoriData, chatData] = await Promise.all([getMemori, getChatLogs]);

        const textMemori = memoriData.map(m => `- ${m.fakta}`).join("\n");
        const textHistory = chatData.map(c => `${c.nama_pengirim}: ${c.pesan}`).join("\n");

        // --- PROMPT RAHASIA (AUTO-LEARNING) ---
        const finalPrompt = `
        Role: Partner Diskusi Cerdas & Teman Dekat (K-Bot).
        User: ${namaPengirim}.
        
        [INGATAN LAMA]
        ${textMemori}

        [HISTORY CHAT]
        ${textHistory}
        
        [PERTANYAAN USER]
        ${namaPengirim}: ${promptUser}

        --- INSTRUKSI GANDA ---
        1. **JAWAB PERTANYAAN:** - Jawab santai, solutif, cerdas, pake 'gw/lu'.
           - HINDARI FORMAT BOLD/ITALIC (jangan pake bintang *).
           - Fokus bantu user.

        2. **AUTO-LEARNING (TUGAS RAHASIA):**
           - Analisa kalimat user di atas. Apakah ada **FAKTA BARU** tentang user yang SANGAT PENTING untuk diingat selamanya? (Contoh: "Gw alergi kacang", "Gw mau nikah bulan depan", "Motor gw Vario").
           - Kalau HANYA pertanyaan biasa (contoh: "Resep nasgor apa?", "Apa kabar?"), JANGAN simpan apa-apa.
           - Jika ada fakta penting, tulis di baris paling bawah dengan format:
             [[SAVEMEMORY: isi fakta ringkas]]
        
        Contoh Output yang diharapkan:
        "Wah seru tuh! Semoga lancar ya acaranya, jangan lupa undang gw."
        [[SAVEMEMORY: Tami ada acara penting bulan depan]]
        `;

        try {
            const result = await model.generateContent(finalPrompt);
            const response = await result.response;
            let fullText = response.text();

            // --- LOGIKA BONGKAR MUATAN (PARSING) ---
            let replyText = fullText;

            // Cek apakah AI nemu fakta baru (ada tanda [[SAVEMEMORY:...]])
            if (fullText.includes('[[SAVEMEMORY:')) {
                const parts = fullText.split('[[SAVEMEMORY:');
                replyText = parts[0].trim(); // Ini jawaban buat User
                let newMemory = parts[1].replace(']]', '').trim(); // Ini fakta buat Database

                // Simpan ke Database secara diam-diam (Background Process)
                if (newMemory) {
                    console.log(`🧠 [AUTO-LEARN] Menemukan fakta baru: ${newMemory}`);
                    db.query("INSERT INTO memori (fakta) VALUES (?)", [newMemory], (err) => {
                        if (!err) {
                            // Opsional: Kasih reaksi mata '👀' biar lu tau dia lagi 'mencatat'
                            msg.react('👀');
                        }
                    });
                }
            }

            // Bersihin format markdown biar rapi di WA
            replyText = replyText.replace(/\*/g, '');

            await client.sendMessage(chatDestination, replyText);

        } catch (error) {
            console.error("ai error:", error);
            await client.sendMessage(chatDestination, "Waduh, otak gw nge-hang dikit.");
        }
    }
};