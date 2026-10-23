# ZUI Studiku: panduan pasang

| File | Fungsi |
|---|---|
| `index.html` | Halaman depan (fitur, harga, FAQ) |
| `app.html` | Aplikasinya. Aplikasi Android juga membuka halaman ini |
| `legal.html` | Syarat Layanan (`#syarat`), Kebijakan Privasi (`#privasi`), Pengembalian Dana (`#refund`), Kontak & Alamat (`#kontak`) |
| `privacy.html` | Mengarah ke `legal.html#privasi` (alamat lama untuk Play Store) |
| `firestore.rules`, `firestore.indexes.json` | Aturan dan indeks Cloud Firestore |
| `firebase.json`, `.firebaserc` | Untuk `firebase deploy --only firestore` ke project `sudiku-zui` |

## 1. Firebase
Project: **sudiku-zui** (organisasi info-zuisystem-org), terpisah dari aplikasi Zui lain. Config web sudah terpasang di `FBC` pada `app.html` (boleh publik, keamanan dijaga oleh `firestore.rules`).
1. **Authentication > Sign-in method:** aktifkan **Email/Password** dan **Google**.
2. **Authentication > Settings > Authorized domains:** tambahkan `studikita.zuisystem.com` dan `admin.zuisystem.com`.
3. **Firestore Database:** buat database (mode production), lalu terbitkan aturan dan indeks dengan `npm i -g firebase-tools`, `firebase login`, dan `firebase deploy --only firestore` dari folder ini. Cara manual: tempel isi `firestore.rules` di **Firestore Database > Rules** lalu **Publish**, dan buat indeks **collection group** `anggota`, field `uid`, Ascending (atau klik tautan di pesan error pertama di console browser).
4. Pendaftaran email wajib verifikasi: aplikasi mengirim email verifikasi dan baru mengizinkan masuk setelah tautannya diklik. Akun Google langsung bisa masuk.
5. (Opsional) **Authentication > Templates:** ganti nama pengirim dan bahasa email verifikasi serta reset kata sandi menjadi Bahasa Indonesia.

## 2. Paket dan Zui Admin
Studiku memakai pola **standar** Zui Admin, sama dengan ZUI KONTRAKTOR, ZUI JURNAL, dan ZUI TO-DO. Satu pengguna = satu "perusahaan" (ID = UID).

| Zui Admin | Studiku | Isi |
|---|---|---|
| Starter | Pelajar | Catatan tanpa batas, PDF, statistik fokus, warna tema |
| Pro | Keluarga | Fitur Pelajar + grup keluarga sampai 3 anak (anak ikut Premium) |
| Bisnis | Sekolah dan bimbel | Kelas dengan tugas dan jadwal bersama. Tidak bisa dipesan dari aplikasi; aktifkan manual di Zui Admin (Pelanggan > Perpanjang, pilih Bisnis) setelah ada kesepakatan |
| Gratis selamanya | semua fitur | Dicentang manual di Zui Admin |

- **Percobaan:** 14 hari Premium (fitur Pelajar) sejak akun dibuat, paling awal 23 Okt 2026. Setelah itu akun turun ke **Gratis** (maksimal 30 catatan), tidak hanya-baca. Di Zui Admin, akun Gratis tampil sebagai "kedaluwarsa"; itu hanya label.
- **Tenggang:** paket berbayar masih berlaku 3 hari setelah tanggal berakhir, sama dengan Zui Admin.
- **Berlangganan:** Pengaturan > Premium > Berlangganan. Pengguna memilih Pelajar atau Keluarga dan 1/6/12 bulan, membayar lewat QRIS, lalu mengirim nomor referensi. Permintaan masuk ke **Antrean** Zui Admin; **Aktifkan** langsung mengubah paket di aplikasi. Di aplikasi Android dari Play Store tombol Berlangganan disembunyikan.
- **Chat admin:** dari lembar Premium atau Berlangganan, termasuk foto bukti bayar. Masuk ke **Pesan** Zui Admin.
- **Harga** awal ada di `PRICE` pada `app.html`. Setelah harga disimpan di **Harga > ZUI STUDIKU** di Zui Admin, aplikasi memakai harga dari sana (`zconfig/pay`). Tabel di `legal.html` dan kartu harga di `index.html` perlu disamakan manual.
- Batas 30 catatan untuk paket Gratis hanya diatur di tampilan aplikasi. Fitur grup dijaga oleh `firestore.rules`.

### Menyambungkan ke Zui Admin
Belum dipasang. Tambahkan blok ini ke daftar `apps` di `config.js` repo Zui Admin, lalu unggah ulang Zui Admin. Blok aplikasi lain tidak perlu diubah.
```js
    {
      id: "stu",
      nama: "ZUI STUDIKU",
      jenis: "standar",
      warna: "#7A5CFF",
      url: "https://studikita.zuisystem.com",
      // samakan dengan TRIAL, GRACE, LAUNCH di app.html dan planActive di firestore.rules ZUI STUDIKU
      percobaanHari: 14,
      tenggangHari: 3,
      mulaiPercobaan: "2026-10-23",
      // starter = Pelajar, pro = Keluarga, business = Sekolah dan bimbel. Harus sama dengan PRICE di app.html
      hargaAwal:    { starter: { 1: 19000, 6: 95000, 12: 149000 }, pro: { 1: 39000, 6: 195000, 12: 390000 }, business: { 1: 150000, 6: 750000, 12: 1500000 } },
      hargaAwalMYR: { starter: { 1: 5, 6: 25, 12: 40 }, pro: { 1: 10, 6: 50, 12: 100 }, business: { 1: 40, 6: 200, 12: 400 } },
      firebase: {
        apiKey: "AIzaSyCWEaQJeihJ8o4_72uYtEWWXaj-MlRQsi0",
        authDomain: "sudiku-zui.firebaseapp.com",
        projectId: "sudiku-zui",
        storageBucket: "sudiku-zui.firebasestorage.app",
        messagingSenderId: "127632344691",
        appId: "1:127632344691:web:2e706f39acd1660c260c06"
      }
    },
```
Lalu di Firebase Console project sudiku-zui: pastikan `admin.zuisystem.com` ada di Authorized domains dan Google aktif. (Opsional) safelist Client ID project **zuisystem** di Google sign-in sudiku-zui supaya Zui Admin tidak perlu menekan **Sambungkan**. Akun admin ditentukan `superAdmin()` di `firestore.rules` (`admin.zuisystem@gmail.com`). Studiku hanya memakai Rupiah; harga Ringgit di atas hanya pengisi tabel Zui Admin.

## 3. Struktur data Firestore
| Lokasi | Isi | Siapa yang bisa |
|---|---|---|
| `companies/{uid}` | `{name, owner, created_at, plan, until, free}` | baca: pemilik, anggota grupnya, admin; `plan`/`until`/`free` hanya admin |
| `companies/{uid}/members/{uid}` | `{role: 'owner', email, name}` | pemilik dan admin |
| `subreqs/{id}` | permintaan bayar `{cid, coName, plan, months, amount, cur, ref, by, byEmail, status, at}` | buat: pemilik (status `wait`); ubah: admin |
| `zconfig/pay` | harga, QRIS, catatan pembayaran, WhatsApp | baca: pengguna masuk; tulis: admin |
| `support/{uid}`, `support/{uid}/msgs` | chat dengan admin | pemilik dan admin |
| `users/{uid}` | `{data: S, updatedAt}`, seluruh data aplikasi | pemilik |
| `pantau/{uid}` | `{nick, jadwal, kegiatan, rencana, sesi, mnt}`, tanpa catatan | pemilik dan orang tua di grup keluarga |
| `codes/{KODE}` | `{gid}` | dibuka satu per satu, tidak bisa didaftar |
| `groups/{uidPemilik}` | `{name, kind, ownerId, code, count, createdAt}` | pemilik dan anggota |
| `groups/{gid}/anggota/{uid}` | `{uid, code, joinedAt}` | anggota itu sendiri dan pemilik grup |
| `groups/{gid}/items/{id}` | tugas dan jadwal kelas | tulis: guru pemilik; baca: anggota |

- **Grup keluarga:** orang tua dengan paket Keluarga membuat grup di tab Grup dan membagikan kode (maksimal 3 anak). Orang tua hanya melihat jadwal, kegiatan, rencana, dan statistik fokus anak, bukan catatan pelajarannya.
- **Kelas sekolah:** guru dengan paket Sekolah membuat kelas, membagikan kode, lalu menambah tugas atau jadwal. Guru tidak bisa melihat data pribadi siswa.
- **Hapus akun** (Pengaturan > Hapus akun) menghapus data belajar, grup, dan akun. Permintaan bayar dan chat tetap tersimpan untuk pembukuan. Firebase meminta masuk ulang bila sesi sudah lama.
- Satu dokumen Firestore maksimal 1 MB. Bila catatan pengguna sangat banyak, pindahkan catatan ke subkoleksi `users/{uid}/catatan` dan tambahkan aturannya.

## 4. GitHub Pages dan domain
1. **Settings > Pages:** Source = *Deploy from a branch*, branch `main`, folder `/ (root)`.
2. Custom domain `studikita.zuisystem.com` (file `CNAME`). Di DNS buat record CNAME `studikita` ke `zui-system.github.io`.
3. Centang **Enforce HTTPS** setelah sertifikat aktif.

## 5. Play Store
1. Unggah semua file ke GitHub (termasuk `.nojekyll` dan folder `.well-known` bila ada).
2. Buka pwabuilder.com, masukkan alamat situs, pilih paket Android, isi package name (misal `com.zuisystem.studiku`), lalu unduh file `.aab` dan kunci penandatanganannya. Simpan kunci itu baik-baik.
3. Di Play Console aktifkan Play App Signing, lalu salin *SHA-256 fingerprint* ke `.well-known/assetlinks.json` (dan package name yang sama), unggah ulang ke GitHub. Tanpa ini aplikasi tampil dengan bilah alamat browser.
4. Buat aplikasi di Play Console, unggah `.aab` ke jalur Closed testing, isi: kebijakan privasi (`https://studikita.zuisystem.com/legal.html#privasi`), Data safety, content rating, target audiens, ikon 512 px, feature graphic 1024x500, dan minimal 2 screenshot.
5. Setelah tayang, isi `PLAY_URL` di bagian bawah `index.html` agar tombol unduh muncul.

## 6. Dokumen legal
- Bila harga, fitur, atau cara bayar berubah, samakan `legal.html` (Syarat bagian 5, tabel di Pengembalian Dana bagian 2) dan `index.html`, lalu perbarui tanggal berlakunya.
- Aturan persetujuan orang tua untuk pengguna di bawah umur ada di Syarat bagian 3 dan Privasi bagian 7.
