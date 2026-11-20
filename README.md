# FlexLab

Galeri 200 prompt kreatif produk dalam 20 kategori. Prompt ditampilkan di kiri dan gambar contoh di kanan, dengan pencarian, filter kategori, favorit lokal, tombol salin, dan pembesaran gambar. Tampilan menyesuaikan layar HP.

## Menjalankan lokal

Gunakan Node.js 18 atau lebih baru. Tidak ada dependensi yang perlu diinstal.

```sh
npm start
```

Buka http://127.0.0.1:4317. Gunakan server HTTP; membuka index.html langsung melalui file:// tidak mendukung pemuatan data JSON.

## Pemeriksaan

```sh
npm run check
```

## Berkas

- `index.html`, `style.css`, `app.js`: tampilan dan interaksi.
- `data.json`: 200 kode, deskripsi asli, produk contoh, dan prompt lengkap yang dipakai.
- `images.json` dan `images/`: pasangan 200 gambar JPEG yang sudah dikompresi.
- `serve.mjs`: server lokal tanpa dependensi.

Situs ini berupa berkas statis dan dapat dihosting dengan direktori publik pada root repositori. Server lokal hanya menyajikan berkas website dan gambar, tanpa menyajikan berkas Git atau konfigurasi.

## Sumber dan contoh visual

Materi preset bersumber dari [200 Cheat Codes Google Flow — Product Photo to Video](https://docs.google.com/document/d/1W6mzywRB_HtO_sjhVi9zdpk2ch2iZQymkqTeKEOUses/edit).

Gambar dibuat menggunakan imagegen berdasarkan arah visual tiap preset dan campuran produk contoh. Gambar ini adalah ilustrasi statis AI, bukan keluaran video Google Flow. Kode singkat pada sumber bukan perintah resmi bawaan Google Flow.

Favorit disimpan di localStorage browser. Situs tidak memanggil layanan AI saat digunakan dan tidak membutuhkan API key.
