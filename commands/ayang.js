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

    // 3. PROMPT "RELATIONSHIP ANALYST" (SHIFT WORKER EDITION) 🏭🌙
    const prompt = `
    Role: Asisten Hubungan Pribadi yang Paham Situasi.
    Tugas: Menganalisa kondisi pasangan (${namaTarget}) ke ${namaPengirim}.

    DATA PENTING:
    - User: ${namaPengirim}
    - Target: ${namaTarget}
    - Jam Saat Ini: ${jamSekarang} (WIB)
    - **KONTEKS PEKERJAAN TARGET:** ${namaTarget} bekerja **3 SHIFT (Pagi/Siang/Malam)**. Jam kerjanya TIDAK MENENTU.
    - History Chat Terakhir:
    ${targetHistory}

    ATURAN ANALISA (LOGIKA SHIFT):

    1. 🛑 **CEK FORWARD DULU:**
       - Label "[PESAN TERUSAN/FORWARDED]" = Dia nunjukin chat orang lain. Jangan salah paham.

    2. 🏭 **ANALISA WAKTU vs SHIFT:**
       - Cek jam chat terakhir vs jam sekarang.
       - Jika dia **DIAM LAMA** (Slow Respon):
         - **JANGAN LANGSUNG BILANG TIDUR** (Kecuali udah subuh banget).
         - Asumsikan dia lagi **DINAS/SHIFT KERJA** (Gak bisa pegang HP).
         - Atau lagi **ISTIRAHAT TOTAL** (Balas dendam tidur habis shift).
       - **Kalimat Saran:** "Mengingat dia kerja shift, kayaknya sekarang lagi jam sibuknya dia Bang, atau malah lagi tepar tidur. Tungguin aja."

    3. 🔍 **ANALISA MOOD:**
       - Marah/Capslock -> Badmood.
       - Singkat -> Capek/Sibuk.
       - Manja/Panjang -> Lagi kangen/Mood bagus.

    OUTPUT:
    Berikan kesimpulan santai yang bikin ${namaPengirim} tenang. Jangan bikin overthinking soal dia ngilang.
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
        { command: '!ayang', desc: 'Cek kondisi ayang (Support Shift Worker)' }
    ]
};