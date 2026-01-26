const express = require('express');
const router = express.Router();
const db = require('../lib/database'); // Pake database pusat

// HOME - Tampil Dashboard
router.get('/', async (req, res) => {
    try {
        // Kita pake Promise (await), jadi gak perlu callback hell
        const [history] = await db.query("SELECT * FROM transaksi ORDER BY id DESC LIMIT 50");
        const [statsOrang] = await db.query("SELECT sumber, SUM(nominal) as total FROM transaksi WHERE jenis='keluar' GROUP BY sumber");
        const [statsJenis] = await db.query("SELECT jenis, SUM(nominal) as total FROM transaksi GROUP BY jenis");

        res.render('index', { 
            data: history, 
            statsOrang: statsOrang, 
            statsJenis: statsJenis 
        });
    } catch (err) {
        console.error("Web Error:", err);
        res.send("Gagal muat data dashboard.");
    }
});

// API - Tambah Data (Dari Web)
router.post('/tambah', async (req, res) => {
    try {
        const { jenis, nominal, keterangan } = req.body;
        await db.query(
            "INSERT INTO transaksi (jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, 'WEB')",
            [jenis, nominal, keterangan]
        );
        res.redirect('/');
    } catch (e) { res.send("Gagal tambah data"); }
});

// API - Hapus Data
router.get('/hapus/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM transaksi WHERE id = ?', [req.params.id]);
        res.redirect('/');
    } catch (e) { res.send("Gagal hapus data"); }
});

// API - Update Data
router.post('/update', async (req, res) => {
    try {
        const { id, jenis, nominal, keterangan, sumber, tanggal } = req.body;
        await db.query(
            'UPDATE transaksi SET jenis=?, nominal=?, keterangan=?, sumber=?, tanggal=? WHERE id=?',
            [jenis, nominal, keterangan, sumber, tanggal, id]
        );
        res.redirect('/');
    } catch (e) { res.send("Gagal update data"); }
});

module.exports = router;