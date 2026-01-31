const db = require('./lib/database');

(async () => {
    console.log("🚀 MEMULAI PROSES PEMBUATAN TABEL...");
    console.log("---------------------------------------");

    try {
        // Panggil fungsi init dari lib/database.js
        await db.init();

        console.log("---------------------------------------");
        console.log("✅ SUKSES! Semua tabel sudah dibuat.");
        console.log("➡️  Silakan restart bot: 'pm2 restart k-flow'");
        process.exit(0);
    } catch (err) {
        console.error("❌ GAGAL BANG:", err);
        process.exit(1);
    }
})();