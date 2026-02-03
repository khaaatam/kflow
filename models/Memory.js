const db = require('../lib/database');

class Memory {
    // 👇 1. UPDATE: Tambahin parameter 'user'
    static async add(user, fakta) {
        // 👇 2. LOGIC CEK DUPLIKAT DIPERBAIKI
        // Cek apakah USER INI sudah punya fakta yang sama? (Biar Tami & Dini bisa punya fakta sama tapi beda row)
        const [rows] = await db.query(
            "SELECT id FROM memori WHERE user = ? AND fakta LIKE ?", 
            [user, `%${fakta}%`]
        );

        if (rows.length === 0) {
            // 👇 3. INSERT DENGAN USER
            return db.query("INSERT INTO memori (user, fakta) VALUES (?, ?)", [user, fakta]);
        }
        return false;
    }

    // Ambil semua memori (Global)
    static async getAll(limit = 20) {
        const [rows] = await db.query("SELECT * FROM memori ORDER BY id DESC LIMIT ?", [limit]);
        return rows;
    }

    // 👇 4. FITUR BARU: Ambil memori KHUSUS user tertentu (Buat dipake AI nanti)
    static async getByUser(user, limit = 10) {
        const [rows] = await db.query(
            "SELECT fakta FROM memori WHERE user = ? ORDER BY id DESC LIMIT ?", 
            [user, limit]
        );
        return rows;
    }

    // --- PERSONA SYSTEM (TETAP SAMA) ---
    static async getPersona() {
        const [rows] = await db.query("SELECT instruction FROM system_instruction WHERE is_active = 1 ORDER BY id DESC LIMIT 1");
        return rows.length > 0 ? rows[0].instruction : "Kamu adalah asisten AI.";
    }

    static async setPersona(instruction) {
        await db.query("UPDATE system_instruction SET is_active = 0");
        return db.query("INSERT INTO system_instruction (instruction) VALUES (?)", [instruction]);
    }
}

module.exports = Memory;