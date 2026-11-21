# FlexLab — Photo Motion Studio

Upload foto produk, pilih gerakannya, lalu unduh gambar atau video. Identitas logo FLEXLab dengan palet biru dan grafit, tema terang/gelap, editor responsif, dan galeri 200 prompt sebagai inspirasi. Pilihan tema tersimpan di browser dan konsisten antara studio dan galeri.

## Menjalankan

Gunakan Node.js 18 atau lebih baru. Tidak perlu menginstal dependensi.

```sh
npm start
```

Di PowerShell, gunakan `npm.cmd start` jika `npm.ps1` dibatasi. Buka http://127.0.0.1:4317. Hentikan server dengan Ctrl+C. Setelah memperbarui source, mulai ulang server agar daftar berkas baru terbaca.

## Fitur studio

- Upload atau drag-and-drop JPG, PNG, dan WebP hingga 20 MB / 50 megapiksel.
- Sembilan pilihan gerakan foto: push, pull, pan, float, orbit ringan, dynamic hook, tilt, breathing, dan still.
- Efek partikel, kabut, sapuan cahaya, butiran melayang, dan film grain.
- Penempatan foto utuh / penuhi frame, latar blur / gradien / warna, serta kecerahan, kontras, dan saturasi.
- Judul produk, teks pendamping, dan warna teks.
- Musik lokal hingga 30 MB, pengulangan audio, dan volume ekspor.
- Rasio 4:5, 9:16, 1:1, dan 16:9; resolusi 720p atau 1080p pada sisi pendek.
- Durasi 4, 6, 8, atau 12 detik, dengan 24 atau 30 fps.
- Pratinjau, jeda, scrub timeline, ulang, simpan/muat pengaturan, dan reset.
- Empat resep gaya; galeri memiliki tombol **Pakai di Studio** untuk memetakan preset ke gerakan/efek foto yang paling mendekati.

## Hasil dan batasan

**Gambar:** PNG dari posisi timeline saat ini, dengan teks dan efek yang terlihat, pada resolusi yang dipilih.

**Video:** rekaman canvas menggunakan MediaRecorder. MP4 dipilih jika didukung encoder browser, dengan WebM sebagai alternatif. Format yang tersedia ditampilkan sebelum render. Bila encoder pertama gagal atau menghasilkan rekaman kosong, studio mencoba satu format alternatif yang didukung browser. Proses render dapat berlangsung dua kali durasi video bila percobaan ulang diperlukan. Durasi hasil dapat sedikit berbeda sesuai encoder browser. Rekaman kosong, terlalu pendek, atau tidak dapat diputar tidak ditawarkan sebagai unduhan yang selesai. Musik disertakan hanya saat ekspor video. Browser tanpa captureStream atau encoder yang didukung tetap bisa mengekspor PNG.

Render video berjalan selama durasi video. Tetap buka tab sampai selesai. Render dibatalkan bila tab disembunyikan, untuk menghindari rekaman yang tersendat. Pengguna juga bisa membatalkan render lewat tombol. Jika perangkat lambat, pilih 720p.

Ini adalah **animasi foto di browser, bukan video AI generatif**. Foto digerakkan sebagai satu layer dengan efek di atasnya; bentuk produk tidak dibuat ulang, dan orbit ringan tidak menciptakan sisi produk yang tidak terlihat. Tidak semua efek konseptual di 200 prompt galeri dapat direproduksi secara harfiah oleh editor lokal.

Foto dan audio tetap di browser, tanpa dikirim ke server. Tidak memerlukan API key atau biaya AI. Pengaturan disimpan di localStorage; foto dan musik tidak ikut disimpan. Font antarmuka dimuat dari Google Fonts dengan font sistem sebagai fallback.

## Galeri referensi

`gallery.html` memuat 200 preset dalam 20 kategori dengan contoh gambar AI, pencarian, filter, favorit, salin prompt, pembesaran gambar, dan tautan ke studio. Gambar galeri dibuat sebelumnya dengan imagegen. Studio tidak memanggil layanan AI saat digunakan.

Preset bersumber dari [200 Cheat Codes Google Flow — Product Photo to Video](https://docs.google.com/document/d/1W6mzywRB_HtO_sjhVi9zdpk2ch2iZQymkqTeKEOUses/edit). Kode singkat tersebut bukan perintah resmi bawaan Google Flow.

## Pengujian

```sh
npm run check
npm test
```

Pengujian otomatis memeriksa dimensi output, batas gerakan, intensitas nol, pengaturan tersimpan, pemilihan format video, pemetaan preset, dan penolakan rekaman satu frame atau terlalu pendek. Pengujian browser juga dilakukan untuk upload, unduhan PNG dan MP4, musik, Full HD, pembatalan, simpan/muat pengaturan, serta layout HP dan desktop.

## Struktur

- `index.html`, `style.css`, `app.js`: studio dan interaksi.
- `engine.mjs`: komposisi canvas, gerakan, efek, dan validasi pengaturan.
- `brand.css`, `brand.js`: identitas biru/grafit dan pilihan tema terang/gelap.
- `assets/`: logo PNG asli dari pemilik proyek serta tampilan simbol dan favicon berbasis logo tersebut.
- `gallery.html`, `gallery.css`, `gallery.js`: galeri referensi.
- `data.json`, `images.json`, `images/`: 200 prompt dan gambar contoh.
- `serve.mjs`: server lokal yang hanya menyajikan berkas website.
- `tests/engine.test.mjs`: pengujian logika animasi dan ekspor.

Semua berkas frontend dapat dihosting statis dari root repositori. Gunakan HTTP/HTTPS, bukan membuka index.html melalui file://.
