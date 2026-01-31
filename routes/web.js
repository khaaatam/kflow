const express = require('express');
const router = express.Router();
const db = require('../lib/database'); // Import Database

// ROUTE UTAMA (DASHBOARD)
router.get('/', async (req, res) => {
    try {
        // 1. AMBIL DATA EVENT DARI DATABASE
        // Kita ambil semua event, diurutkan dari tanggal yang paling dekat
        const [rows] = await db.query("SELECT * FROM events ORDER BY tanggal ASC");

        // 2. RENDER HALAMAN DENGAN DATA
        // Disini kita kirim 'rows' sebagai variabel 'data' ke file index.ejs
        res.render('index', {
            data: rows,
            title: 'K-Flow Dashboard'
        });

    } catch (e) {
        console.error("❌ Error Web Dashboard:", e);
        // Kalau error, kirim data kosong biar gak crash (White Screen)
        res.render('index', {
            data: [],
            error: "Gagal mengambil data dari database."
        });
    }
});

// ROUTE BUAT NAMBAH EVENT (DARI FORM WEB)
router.post('/add', async (req, res) => {
    const { nama_event, tanggal } = req.body;
    try {
        await db.query("INSERT INTO events (nama_event, tanggal, dibuat_oleh) VALUES (?, ?, ?)",
            [nama_event, tanggal, 'Web Dashboard']
        );
        res.redirect('/'); // Balik ke halaman utama
    } catch (e) {
        console.error(e);
        res.send("Gagal menyimpan event.");
    }
});

// ROUTE BUAT HAPUS EVENT
router.get('/delete/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM events WHERE id = ?", [req.params.id]);
        res.redirect('/');
    } catch (e) {
        console.error(e);
        res.send("Gagal menghapus event.");
    }
});

module.exports = router;