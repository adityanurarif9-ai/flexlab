# FlexLab

Studio iklan produk dengan tampilan dua sisi: foto dan gaya di kiri, hasil gambar/video di kanan. Logo biru FlexLab, 200 inspirasi gaya, akun username/password dengan verifikasi tautan email, riwayat per akun, dan konektor **ComfyUI lokal**.

## Status versi ini

- Backend akun, database SQLite, verifikasi email, login/logout, dan reset password sudah berjalan.
- Upload foto, pilihan gaya, rasio, arahan tambahan, riwayat, antrean dan unduhan hasil tersambung ke backend.
- Konektor ComfyUI gambar dan video tersedia. **ComfyUI, model, dan workflow aktif belum dipasang. Tidak ada unduhan model otomatis.**
- Pembuatan hasil dinonaktifkan sampai mesin dan workflow siap. Gambar galeri hanya inspirasi, tidak pernah digunakan sebagai hasil upload pengguna.
- SMTP harus diisi agar email benar-benar dikirim. Kotak email lokal hanya untuk pengembangan, bukan verifikasi email sungguhan.
- Dijalankan di `127.0.0.1`, bukan layanan publik. GitHub Pages tidak dapat menjalankan backend akun atau ComfyUI.

## Jalankan dari VS Code

Gunakan **Node.js 24.15 atau lebih baru**. Buka folder `D:\flexlab` di VS Code, pilih **Terminal → New Terminal**, lalu:

```powershell
npm ci --legacy-peer-deps
npm start
```

Buka alamat yang tercetak, biasanya `http://127.0.0.1:4317`. Jangan menjalankan dengan Live Server, `file://`, atau server statis lama karena akun memerlukan backend ini.

Pustaka dipin di `package-lock.json`. `--legacy-peer-deps` menghindari konflik peer opsional Prisma yang tidak digunakan; backend ini memakai SQLite bawaan Node, bukan Prisma.

## Coba akun tanpa mengirim email

```powershell
npm run dev:email
```

Daftar dari halaman akun, buka **Buka email uji lokal**, klik tautan verifikasi, kemudian login dengan username dan password yang kamu buat. Pesan uji tersimpan di memori sampai server ditutup. **Tidak ada email yang dikirim ke alamat asli.** Gunakan data uji, jangan gunakan mode ini untuk pengguna lain. Mode ini ditolak jika `NODE_ENV=production`.

Untuk email sungguhan, salin `.env.example` menjadi `.env`, isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, dan `SMTP_FROM` sesuai penyedia emailmu, lalu jalankan **`npm start`**. Gunakan password aplikasi jika penyedia mewajibkan. Jangan masukkan rahasia ke kode atau Git. Belum ada penyedia SMTP yang dikonfigurasi atau diuji mengirim email sungguhan di PC ini.

## AI lokal tanpa biaya API

Tidak ada pemanggilan API generatif berbayar. Biaya perangkat, listrik, koneksi, serta ketentuan lisensi model tetap mengikuti perangkat dan model yang dipakai. RTX 3050 Laptop 6 GB perlu workflow hemat VRAM; video dapat sangat lambat atau kehabisan memori. Dukungan tombol Video tidak menjamin semua model video muat di GPU ini.

1. Ketika sudah siap, pasang [ComfyUI dari sumber resmi](https://docs.comfy.org/installation/system_requirements). Unduhan ini **belum dilakukan** oleh proyek.
2. Pilih model berlisensi sesuai kebutuhan dan kemampuan GPU. Model gambar/video harus dipasang tersendiri; model video umumnya lebih berat. Tidak ada model besar dibundel dalam repo.
3. Pastikan workflow image-to-image atau image-to-video berhasil di ComfyUI terlebih dahulu.
4. Ekspor workflow **API format**. Baca [panduan workflow](workflows/README.md), lalu pasang placeholder FlexLab.
5. Simpan workflow aktif di `.workflows/image.json` dan/atau `.workflows/video.json`.
6. Jalankan ComfyUI pada `http://127.0.0.1:8188`, jalankan FlexLab, masuk, lalu pilih **Siapkan AI lokal → Periksa koneksi**.

Workflow yang siap hanya diperiksa format dan ketersediaan nodenya. Validitas model dan kecukupan VRAM ditentukan saat ComfyUI menjalankan workflow. Hasil mengikuti model, prompt, dan pengaturan workflow. Detail logo/label bisa berubah; hasil tidak dijamin sama dengan Google Flow atau contoh galeri.

## Penyimpanan dan keamanan lokal

`.flexlab/` menyimpan database akun, kunci autentikasi, sesi, dan hasil. `.workflows/` menyimpan workflow aktif. Kedua folder serta `.env` diabaikan Git. Cadangkan `.flexlab/` secara privat; jangan hapus `auth-secret` saat akun sudah digunakan. Password di-hash oleh Better Auth, sesi memakai cookie HTTP-only, dan email harus diverifikasi sebelum masuk. Hasil dan riwayat dibatasi berdasarkan pemilik akun. Endpoint ComfyUI hanya menerima alamat localhost.

Ini konfigurasi satu PC, bukan deployment internet. Membuka server ke jaringan memerlukan HTTPS, konfigurasi origin, layanan email, perlindungan jaringan ComfyUI, pencadangan, serta peninjauan deployment tersendiri. Jangan mengubah bind loopback untuk membagikan aplikasi begitu saja. Mode email uji mengekspos tautan akun uji kepada pengguna PC ini.

`app.js`, `engine.mjs`, dan `style.css` lama masih disimpan sebagai referensi versi animasi foto, tetapi halaman utama baru tidak memuatnya. Server tidak menyajikan berkas backend, database, rahasia, atau workflow aktif.

## Pemeriksaan

```powershell
npm run check
npm test
```

Tes backend memakai SQLite sementara, email tangkapan untuk pengujian, dan mesin ComfyUI palsu **khusus tes**, untuk memeriksa verifikasi email, login/password salah, reset token satu kali, logout, isolasi hasil antarakun, penolakan lintas situs, pembatasan berkas privat, validasi workflow, serta kondisi AI offline. Tes bukan bukti kualitas generasi AI; model lokal belum dijalankan. Tes engine browser lama tetap tersedia sebagai regresi.
