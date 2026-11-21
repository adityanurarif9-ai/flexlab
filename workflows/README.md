# Workflow ComfyUI untuk FlexLab

Folder ini hanya berisi contoh konfigurasi, **bukan model AI**. Tidak ada workflow aktif sebelum kamu memasangnya di `.workflows/`.

`image.example.json` adalah contoh **img2img dasar** dengan node bawaan ComfyUI: checkpoint → foto → resize → VAE encode → sampler → decode → save. Ganti nama checkpoint dengan model yang benar-benar dipasang. Contoh belum dijalankan karena model belum diunduh. Denoise 0,45 merupakan titik awal untuk eksperimen; img2img dasar belum tentu mempertahankan label atau membuat komposisi iklan seperti contoh galeri. Workflow dengan pengondisian referensi produk yang sesuai dapat memberikan hasil berbeda.

Jangan menyalin contoh ke workflow aktif dan menganggap AI sudah terpasang. Coba workflow di ComfyUI dengan foto produkmu terlebih dahulu. Ekspor **API format**, bukan JSON yang berisi `nodes`/`links` editor.

Setelah siap:

```powershell
New-Item -ItemType Directory -Force .workflows
Copy-Item workflows/image.example.json .workflows/image.json
```

Edit `.workflows/image.json` dan ganti checkpoint. Untuk video, gunakan workflow **image-to-video** yang telah berhasil pada GPU ini, ekspor API format ke `.workflows/video.json`, dan pasang placeholder. Tidak disertakan workflow video spekulatif karena model/node dan kebutuhan VRAM berbeda-beda. Output video perlu disimpan sebagai **MP4 atau WebM**; GIF bukan output mode Video. Node penyimpanan harus memasukkan metadata berkas ke `images`, `videos`, atau `gifs` pada history ComfyUI.

| Placeholder | Nilai dari FlexLab |
| --- | --- |
| `{{FLEXLAB_IMAGE}}` | Nama foto yang diupload ke ComfyUI; wajib |
| `{{FLEXLAB_PROMPT}}` | Arahan produk + gaya pilihan + catatan pengguna; wajib |
| `{{FLEXLAB_NEGATIVE}}` | Arahan untuk menghindari distorsi |
| `{{FLEXLAB_SEED}}` | Seed acak numerik |
| `{{FLEXLAB_WIDTH}}`, `{{FLEXLAB_HEIGHT}}` | Rasio pilihan; sisi pendek gambar 512, video 384 |
| `{{FLEXLAB_FPS}}` | 12 |
| `{{FLEXLAB_FRAMES}}` | Durasi × 12 + 1 |
| `{{FLEXLAB_DURATION}}` | 4, 6, atau 8 detik |

Ganti nilai input node dengan string placeholder lengkap, misalnya `"seed": "{{FLEXLAB_SEED}}"`. Server menggantinya menjadi angka saat pengiriman. Sesuaikan jumlah frame/fps dengan syarat model; angka ini bukan jaminan semua model menerima durasi yang sama. Pilihan rasio/durasi baru berpengaruh jika workflow memakai placeholder terkait.

Untuk menguji koneksi, FlexLab memakai `/system_stats` dan `/object_info`. Untuk hasil, memakai `/upload/image`, `/prompt`, `/history/{prompt_id}`, serta `/view`. Foto diupload ke folder input ComfyUI dan hasil disalin ke `.flexlab/generated/`. Hapus foto/hasiI lama secara manual dari ComfyUI jika tidak diperlukan; logout tidak menghapus berkas tersebut. Jangan expose port ComfyUI ke internet.

Referensi: [rute server resmi ComfyUI](https://docs.comfy.org/development/comfyui-server/comms_routes), [panduan penggunaan](https://docs.comfy.org/get_started/first_generation).
