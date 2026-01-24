module.exports = async (client, msg, text, senderId, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    // --- FITUR 1: CEK ID (!CEKID) ---
    // ini wajib jalan walaupun user gak dikenal, buat debugging
    if (text === '!cekid') {
        return client.sendMessage(chatDestination, `🆔 ID Terdeteksi: \`${senderId}\`\n👤 User: ${namaPengirim || 'Gak Dikenal'}`);
    }

    // gatekeeper: kalo user gak dikenal, fitur di bawah ini gak jalan
    if (!namaPengirim) return;

    // --- FITUR 2: MENU (!HELP) ---
    if (text === '!help' || text === '!menu') {
        const menu = `🤖 *MENU BOT KEUANGAN & AI* 🤖\n\n💰 *KEUANGAN*\n- *!in [jumlah] [ket]* : Masuk\n- *!out [jumlah] [ket]* : Keluar\n- *!saldo* : Cek Sisa\n- *!today* : Rekap Hari Ini\n\n🧠 *AI*\n- *!ai [tanya]* : Tanya Gemini\n- *!ingat [fakta]* : Ajarin AI\n\n❤️ *LAINNYA*\n- *!ayang* : Mode Bucin\n- *!cekid* : Cek ID`;
        return client.sendMessage(chatDestination, menu);
    }
};