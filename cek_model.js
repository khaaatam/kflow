const { GoogleGenerativeAI } = require("@google/generative-ai");

// MASUKIN API KEY LU DISINI (YANG DARI GOOGLE AI STUDIO)
const genAI = new GoogleGenerativeAI("AIzaSyCAxtpRMP5F6ZZMaYq547vKVls2PUTQ_z4");

async function listModels() {
  try {
    console.log("🔍 Sedang mengecek daftar model...");
    const response = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
    // Kita tembak dummy request dulu atau cek list-nya lewat method khusus
    // Note: Library Node.js gak punya method listModels langsung yg simpel, 
    // jadi kita tes satu-satu model yang umum.

    const modelsToTry = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro",
        "gemini-1.0-pro",
        "gemini-pro"
    ];

    for (const modelName of modelsToTry) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            // Kita coba generate satu kata "Halo" buat ngetes modelnya idup apa nggak
            const result = await model.generateContent("Tes");
            console.log(`✅ Model DITEMUKAN & AKTIF: ${modelName}`);
        } catch (error) {
            if (error.message.includes("404")) {
                console.log(`❌ Model TIDAK DITEMUKAN: ${modelName}`);
            } else {
                console.log(`⚠️ Model ${modelName} Error Lain: ${error.message}`);
            }
        }
    }
  } catch (error) {
    console.error("Error Fatal:", error);
  }
}

listModels();
