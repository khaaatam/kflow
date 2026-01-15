// GANTI API KEY LU DI SINI
const API_KEY = "AIzaSyD7C7AkOOUKfVAmylvb9UKYXlCjp_JpyCg";

async function cekJatah() {
    console.log("🔍 Sedang bertanya ke Google: 'Gw boleh pake model apa aja?'...\n");
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.log("❌ ERROR DARI GOOGLE:");
            console.log(JSON.stringify(data.error, null, 2));
            console.log("\n👉 Masalahnya ada di AKUN/KEY lu. Bikin Key baru di Project baru!");
        } else {
            console.log("✅ DAFTAR MODEL YANG TERSEDIA BUAT LU:");
            data.models.forEach(m => {
                // Kita cuma cari model yang support 'generateContent'
                if (m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${m.name.replace('models/', '')}`);
                }
            });
            console.log("\n👉 Pilihlah salah satu nama di atas buat ditaruh di app.js!");
        }
    } catch (err) {
        console.log("Error Koneksi:", err.message);
    }
}

cekJatah();