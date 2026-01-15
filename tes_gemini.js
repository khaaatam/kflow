const { GoogleGenerativeAI } = require("@google/generative-ai");

// MASUKIN API KEY BARU LU DISINI
const genAI = new GoogleGenerativeAI("AIzaSyD7C7AkOOUKfVAmylvb9UKYXlCjp_JpyCg");

async function tesOtak() {
    console.log("🤖 Sedang mencoba menghubungi Google Gemini...");

    // Kita coba 3 nama model yang paling umum.
    // Google kadang ganti-ganti nama, jadi kita tes mana yang nyangkut.
    const daftarModel = [
        "gemini-1.5-flash",       // Paling cepet & murah
        "gemini-1.5-pro",         // Paling pinter
        "gemini-pro"              // Versi klasik (paling stabil)
    ];

    for (const namaModel of daftarModel) {
        try {
            console.log(`\n👉 Mencoba model: ${namaModel}...`);
            const model = genAI.getGenerativeModel({ model: namaModel });
            const result = await model.generateContent("Jawab singkat: Siapa presiden Indonesia pertama?");
            const response = await result.response;
            const text = response.text();

            console.log(`✅ SUKSES! Model '${namaModel}' berfungsi.`);
            console.log(`📝 Jawaban: ${text}`);

            // Kalau sukses satu, kita stop aja gak usah tes sisanya
            return;
        } catch (error) {
            console.log(`❌ GAGAL (${namaModel}): ${error.message}`);
        }
    }

    console.log("\n💀 Kesimpulan: Semua model gagal. Masalah ada di API Key atau Akun Google Cloud.");
}

tesOtak();