const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    // 1. TENTUKAN SIAPA "AYANG"-NYA (TARGET)
    let namaTarget = "";
    if (namaPengirim.toLowerCase().includes("tami")) {
        namaTarget = "Dini";
    } else if (namaPengirim.toLowerCase().includes("dini")) {
        namaTarget = "Tami";
    } else {
        return client.sendMessage(chatDestination, "Ciyee jomblo ya? Lu gak punya ayang di database gw. 🤪");
    }

    // 2. TARIK HISTORY CHAT (PLUS STATUS FORWARD)
    const targetHistory = await new Promise((resolve) => {
        // [UPGRADE] Kita tarik kolom is_forwarded juga
        const query = "SELECT pesan, waktu, is_forwarded FROM full_chat_logs WHERE nama_pengirim LIKE ? ORDER BY id DESC LIMIT 15";
        db.query(query, [`%${namaTarget}%`], (err, rows) => {
            if (err || !rows || rows.length === 0) resolve(null);
            else {
                // [UPGRADE] Kasih label [FORWARDED] biar AI tau
                const formattedLogs = rows.map(r => {
                    const label = r.is_forwarded ? "[PESAN TERUSAN/FORWARDED] " : "";
                    return `[${r.waktu}] ${label}${r.pesan}`;
                }).reverse().join("\n");
                resolve(formattedLogs);
            }
        });
    });

    if (!targetHistory) {
        return client.sendMessage(chatDestination, `Waduh, ${namaTarget} kayaknya belum muncul sama sekali hari ini. Masih bobo kali? 😴`);
    }

    // 3. PROMPT "RELATIONSHIP ANALYST" (GABUNGAN LAMA & BARU) 🧠🔥
    const prompt = `
    Role: Asisten Hubungan Pribadi (Relationship Assistant).
    Tugas: Menganalisa mood pasangannya (${namaTarget}) berdasarkan chat log untuk dilaporkan ke ${namaPengirim}.

    DATA:
    - User: ${namaPengirim}
    - Target: ${namaTarget}
    - History Chat Terakhir:
    ${targetHistory}

    ATURAN ANALISA (WAJIB DIPATUHI):
    1. 🛑 **CEK LABEL [FORWARDED]:**
       - Jika chat ada label "[PESAN TERUSAN/FORWARDED]", artinya ${namaTarget} SEDANG MENUNJUKKAN chat orang lain.
       - JANGAN anggap itu kata-kata ${namaTarget} sendiri.
       - Contoh: Jika dia forward chat orang marah-marah, berarti dia lagi cerita ada yang marah ke dia (bukan dia yang marah ke kamu).

    2. 🔍 **ANALISA MOOD (SKENARIO):**
       - Jika ${namaTarget} banyak nge-forward chat orang lain -> "Dia lagi pusing/keganggu sama orang lain tuh kayaknya."
       - Jika chat ASLI dia (tanpa forward) isinya marah/capslock -> "Waduh, dia lagi badmood/ngambek. Coba bujuk, bawain makanan kesukaannya."
       - Jika chat isinya coding/kerja/deadline -> "Dia lagi mode serius kerja/ngoding. Jangan diganggu dulu biar kelar."
       - Jika chat isinya ketawa/becanda -> "Aman, mood dia lagi bagus kok."

    OUTPUT:
    Berikan kesimpulan santai dan saran ke ${namaPengirim}.
    `;

    try {
        await msg.react('🔍');
        const result = await model.generateContent(prompt);
        const response = result.response.text();
        await client.sendMessage(chatDestination, response);
    } catch (error) {
        console.error("Ayang Error:", error);
        await client.sendMessage(chatDestination, "Duh, sinyal batin gw putus. Gagal ngepoin dia. 🥺");
    }
};

module.exports.metadata = {
    category: "LAINNYA",
    commands: [
        { command: '!ayang', desc: 'Ayangku kemana ya kira-kira' }
    ]
};