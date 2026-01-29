const db = require('../lib/database');

class Memory {
    static async add(fakta) {
        // Cek duplikat dulu
        const [rows] = await db.query("SELECT id FROM memori WHERE fakta LIKE ?", [`%${fakta}%`]);
        if (rows.length === 0) {
            return db.query("INSERT INTO memori (fakta) VALUES (?)", [fakta]);
        }
        return false;
    }

    static async getAll(limit = 20) {
        const [rows] = await db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT ?", [limit]);
        return rows;
    }

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