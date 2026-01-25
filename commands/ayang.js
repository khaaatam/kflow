const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    // 1. TENTUKAN TARGET
    let namaTarget = "";
    if (namaPengirim.toLowerCase().includes("tami")) {
        namaTarget = "Dini";
    } else if (namaPengirim.toLowerCase().includes("dini")) {
        namaTarget = "Tami";
    } else {
        return client.sendMessage(chatDestination, "Ciyee jomblo ya? Lu gak punya ayang di database gw. 🤪");
    }

    // 2. TARIK HISTORY CHAT
    const targetHistory = await new Promise((resolve) => {
        const query = "SELECT pesan, waktu, is_forwarded FROM full_chat_logs WHERE nama_pengirim LIKE ? ORDER BY id DESC LIMIT 15";
        db.query(query, [`%${namaTarget}%`], (err, rows) => {
            if (err || !rows || rows.length === 0) resolve(null);
            else {
                const formattedLogs = rows.map(r => {
                    const label = r.is_forwarded ? "[PESAN TERUSAN/FORWARDED] " : "";
                    return `[${r.waktu}] ${label}${r.pesan}`;
                }).reverse().join("\n");
                resolve(formattedLogs);
            }
        });
    });

    if (!targetHistory) {
        return client.sendMessage(chatDestination, `Waduh, ${namaTarget} belum ada chat sama sekali. Mungkin lagi sibuk banget.`);
    }

    // AMBIL JAM SEKARANG
    const now = new Date();
    const jamSekarang = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // 3. PROMPT "RELATIONSHIP ANALYST" (NO BULLSHIT EDITION) 🤐✅
    const prompt = `
    Role: Bestie/Teman Curhat yang asik dan to-the-point.
    Tugas: Kasih tau ${namaPengirim} soal kondisi ${namaTarget} sekarang.

    DATA:
    - Jam Sekarang: ${jamSekarang}
    - Chat Terakhir: ${targetHistory}
    - Konteks: ${namaTarget} kerja 3 SHIFT (Jam kerja acak).

    ATURAN JAWAB (WAJIB DIPATUHI):
    1. 🤫 **JANGAN JELASKAN PROSES ANALISAMU.** - JANGAN tulis "Mari kita analisa", "Pertama lihat jam", "Kedua lihat chat". NO!
       - JANGAN ulangi instruksi gw.
       - LANGSUNG ke kesimpulan santai.

    2. 🧠 **LOGIKA (Hanya untukmu mikir, JANGAN DIUCAPKAN):**
       - Kalau chat ada label [FORWARDED] -> Itu chat orang lain, bukan kata hati dia.
       - Kalau dia DIAM LAMA -> Asumsikan lagi SHIFT KERJA atau TEPAR (Tidur). Jangan bikin panik.
       - Kalau chatnya singkat/marah -> Lagi capek/badmood.

    3. 🗣️ **CONTOH OUTPUT YANG BENAR (Pilih satu style):**
       - "Aman Bang, Dini kayaknya lagi mode kerja nih. Makanya slow respon. Tungguin aja."
       - "Itu dia nge-forward chat orang yang bikin dia kesel. Dia lagi curhat doang kok, bukan marah ke lu."
       - "Udah tidur kali Bang, abis shift capek dia. Jangan diganggu dulu."
       - "Lagi on fire nih dia, chatnya banyak banget. Gas ladenin Bang."

    OUTPUT:
    Satu paragraf pendek, santai, dan menenangkan. Gak usah formal.
    `;

    try {
        await msg.react('🔍');
        const result = await model.generateContent(prompt);
        const response = result.response.text();
        await client.sendMessage(chatDestination, response);
    } catch (error) {
        console.error("Ayang Error:", error);
        await client.sendMessage(chatDestination, "Gagal konek ke satelit cinta. Coba lagi nanti Bang.");
    }
};

module.exports.metadata = {
    category: "LAINNYA",
    commands: [
        { command: '!ayang', desc: 'Cek kondisi ayang' }
    ]
};