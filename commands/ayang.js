const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    // 1. TENTUKAN SIAPA "AYANG"-NYA (TARGET)
    // Logic: Kalau Tami yg nanya -> Target Dini. Kalau Dini yg nanya -> Target Tami.
    let namaTarget = "";

    // Sesuaikan string ini dengan nama yang tercatat di config.users lu
    if (namaPengirim.toLowerCase().includes("tami")) {
        namaTarget = "Dini";
    } else if (namaPengirim.toLowerCase().includes("dini")) {
        namaTarget = "Tami"; // Atau "Bang Tami"
    } else {
        // Kalau orang lain iseng pake command ini
        return client.sendMessage(chatDestination, "Ciyee jomblo ya? Lu gak punya ayang di database gw. 🤪");
    }

    // 2. TARIK HISTORY CHAT SI TARGET (Bukan Pengirim)
    // Kita mau tau kondisi TARGET berdasarkan jejak digital terakhirnya.
    const targetHistory = await new Promise((resolve) => {
        // Ambil 15 chat terakhir dari TARGET
        const query = "SELECT pesan, waktu FROM full_chat_logs WHERE nama_pengirim LIKE ? ORDER BY id DESC LIMIT 15";
        db.query(query, [`%${namaTarget}%`], (err, rows) => {
            if (err || !rows || rows.length === 0) resolve(null);
            else resolve(rows.map(r => `[${r.waktu}] ${r.pesan}`).reverse().join("\n"));
        });
    });

    // Handle kalau Target gak pernah chat (atau log kosong)
    if (!targetHistory) {
        return client.sendMessage(chatDestination, `Waduh, ${namaTarget} kayaknya belum muncul sama sekali hari ini. Masih bobo kali? 😴`);
    }

    // 3. PROMPT "RELATIONSHIP ANALYST"
    const prompt = `
    Role: Asisten Hubungan Pribadi (Relationship Assistant).
    Tugas: Menganalisa aktivitas/mood seseorang (${namaTarget}) untuk dilaporkan kepada pasangannya (${namaPengirim}).

    DATA ANALISA:
    - Pengirim Command (!ayang): ${namaPengirim}
    - Target yang dicari: ${namaTarget}
    - Chat History Terakhir ${namaTarget}:
    ${targetHistory}

    INSTRUKSI JAWABAN:
    Baca chat history ${namaTarget} di atas, lalu simpulkan kondisinya sekarang untuk dijawab ke ${namaPengirim}.
    
    Skenario & Contoh Respon:
    1. Jika chat ${namaTarget} isinya marah-marah/ngeluh/capslock -> "Kyknya ${namaTarget} lagi badmood/ngambek deh. Coba bujuk gih, bawain makanan kesukaannya."
    2. Jika chat isinya coding/kerja/deadline -> "Waduh, ${namaTarget} lagi sibuk banget tuh sama kerjaannya/codingannya. Jangan diganggu dulu ya, nanti dia kabarin."
    3. Jika chat isinya ketawa/becanda -> "${namaTarget} lagi hepi tuh kelihatannya, abis ketawa-ketiwi di grup."
    4. Jika chat terakhir sudah LAMA (cek jamnya) -> "Terakhir dia chat sih tadi, kayaknya sekarang lagi istirahat atau ketiduran."

    GAYA BICARA:
    - Santai, akrab, seperti teman curhat.
    - Jangan terlalu kaku.
    - Langsung to the point ke kondisi target.
    `;

    try {
        await msg.react('🔍'); // Reaksi lagi nyari info

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        await client.sendMessage(chatDestination, response);

    } catch (error) {
        console.error("Ayang Error:", error);
        await client.sendMessage(chatDestination, "Duh, sinyal batin gw putus. Gagal ngepoin dia. 🥺");
    }
};

// TAMBAHAN METADATA MENU
module.exports.metadata = {
    category: "LAINNYA",
    commands: [
        { command: '!ayang', desc: 'Ayangku kemana ya kira-kira' }
    ]
};