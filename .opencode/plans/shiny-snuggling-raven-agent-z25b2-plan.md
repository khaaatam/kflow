# Fix: Observer simpan fallback error jadi memori

## Context
User lapor: bot down (`Premature close` from 9Router), tapi malah kesimpen memori `"⚠️ 9Router lagi down..."`.
Ini polusi DB + spam notif owner.

**Root cause:**
- `lib/ai.js:119-128` `FALLBACK_RESPONSES` semua prefix `⚠️`
- `lib/ai.js:162-164` & `181-185` return `{ fallback: true }` saat error health/unhealthy/cache miss
- `commands/ai.js:54-60` observer TIDAK cek `result.fallback`, cuma cek `SKIP` → langsung `Memory.add()`

**Affected:**
- `commands/ai.js:60` auto-observer (vulnerable)
- `commands/ai.js:104` manual `!ingat` aman
- Lainnya (finance, ayang, tami) cuma leak ke reply, ga polusi DB

## Plan

### Step 1: Fix observer - cek fallback flag (ROOT CAUSE)
File: `commands/ai.js` L54-L62

```js
const result = await model.generateContent(prompt);
if (result.fallback) {
    logger.debug('[OBSERVER] AI fallback, skip save');
    return;
}
const fact = result.response.text().trim();
if (fact.toUpperCase().includes('SKIP')) return;
```

- Pakai flag yang udah ada di `lib/ai.js:163,184,199`
- Zero change di `lib/ai.js`

### Step 2: Defensive filter emoji + keywords (belt & suspenders)
File sama, sebelum `Memory.add`

```js
if (fact.startsWith('⚠️') || fact.startsWith('⚠') ||
    /9Router|AI lagi (error|gangguan|down)|Otak.*(?:error|istirahat|gangguan|konslet)/i.test(fact)) {
    logger.debug(`[OBSERVER] Filtered fallback-like: ${fact.slice(0, 60)}`);
    return;
}
```

Jaga-jaga kalau:
- `generateContentStrict` kepake future tanpa flag
- cache kepollusi
- fallback string berubah

### Step 3: Cleanup data kotor yang udah kesimpen
Jalankan query di Termux / dashboard / mysql:

```sql
-- cek korban dulu
SELECT id, user, fakta, created_at FROM memori 
WHERE fakta LIKE '%9Router%' OR fakta LIKE '%⚠%' OR fakta LIKE '%Otak digital%';

-- hapus
DELETE FROM memori 
WHERE fakta LIKE '%9Router%' 
   OR fakta LIKE '%⚠%' 
   OR fakta LIKE '%Otak digital lagi istirahat%'
   OR fakta LIKE '%Maaf, AI lagi error%';
```

Atau via `models/Memory.js`:
```js
const rows = await db.query("SELECT * FROM memori WHERE fakta LIKE '%9Router%'");
for (const r of rows) await Memory.delete(r.id, r.user);
```

### Step 4: Verifikasi
- [ ] `npm run lint` pass
- [ ] `npm run check` pass
- [ ] Repro: matikan 9router (`tmux kill-session -t router`), kirim chat biasa → tidak ada INSERT memori baru, tidak ada notif owner
- [ ] Happy path: nyalakan 9router, chat "Dini ultah 5 Mei" → masih kesimpen
- [ ] DB: `SELECT * FROM memori WHERE fakta LIKE '%9Router%'` = 0 rows
- [ ] Owner tidak dapat notif sampah lagi

### Optional / Future
- Pertimbangkan observer pakai `generateContentStrict` biar throw explicit, bukan return fallback (butuh try/catch di observer)
- Turunin log `[MEMORY SAVED]` jadi debug kalau fact mengandung ⚠️
- Tambah `observer` blacklist kata `⚠️`

## Files
- `D:\Tami\Project\k-flow\commands\ai.js` - 6 lines added (guard + filter)
- DB cleanup - runtime query, no migration needed

## Risk
Low - cuma nambah early return guard. No breaking change. Flag `fallback` sudah ada & tested di semua path di `lib/ai.js`.

## Effort
< 5 menit
