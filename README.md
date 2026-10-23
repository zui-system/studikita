# ZUI Studiku: panduan pasang

| File | Fungsi |
|---|---|
| `index.html` | Halaman depan (fitur, harga, FAQ) |
| `app.html` | Aplikasinya. Aplikasi Android juga membuka halaman ini |
| `legal.html` | Syarat Layanan (`#syarat`), Kebijakan Privasi (`#privasi`), Pengembalian Dana (`#refund`), Kontak & Alamat (`#kontak`) |
| `privacy.html` | Mengarah ke `legal.html#privasi` (alamat lama untuk Play Store) |
| `sw.js` | Service worker kecil untuk notifikasi pengingat (tidak menyimpan cache) |
| `firestore.rules`, `firestore.indexes.json` | Aturan dan indeks Cloud Firestore |
| `firebase.json`, `.firebaserc` | Untuk `firebase deploy --only firestore` ke project `sudiku-zui`, plus port emulator untuk uji |
| `tests/` | Uji aturan Firestore dan uji alur di browser dengan Firebase Emulator (lihat bagian 7) |

## 1. Firebase
Project: **sudiku-zui** (organisasi info-zuisystem-org), terpisah dari aplikasi Zui lain. Config web sudah terpasang di `FBC` pada `app.html` (boleh publik, keamanan dijaga oleh `firestore.rules`).
1. **Authentication > Sign-in method:** aktifkan **Email/Password** dan **Google**.
2. **Authentication > Settings > Authorized domains:** tambahkan `studikita.zuisystem.com` dan `admin.zuisystem.com`.
3. **Firestore Database:** buat database (mode production), lalu terbitkan aturan dan indeks dengan `npm i -g firebase-tools`, `firebase login`, dan `firebase deploy --only firestore` dari folder ini. Cara manual: tempel isi `firestore.rules` di **Firestore Database > Rules** lalu **Publish**, dan buat indeks **collection group** field `uid` (Ascending) untuk `anggota`, `selesai`, `nilai`, `pengajar`, dan `guru` (atau klik tautan di pesan error pertama di console browser).
4. Pendaftaran email wajib verifikasi: aplikasi mengirim email verifikasi dan baru mengizinkan masuk setelah tautannya diklik. Akun Google langsung bisa masuk.
5. **Supabase sudah tidak dipakai.** Versi lama Studiku memakai Supabase (project `nparspjrfkrwgxujdyzy`). Kode sekarang tidak memuat atau menghubungi Supabase sama sekali. Saat dibuka, aplikasi menghapus sisa sesi Supabase (`sb-*`) dari browser. Pengguna lama yang masih tercatat "akun aktif" tetapi belum punya sesi Firebase dibawa ke layar masuk; data di perangkatnya ikut tersimpan ke akun Firebase yang baru bila akun itu belum punya data online. Project Supabase lama bisa di-pause atau dihapus dari dashboard Supabase setelah datanya tidak diperlukan.
6. (Opsional) **Authentication > Templates:** ganti nama pengirim dan bahasa email verifikasi serta reset kata sandi menjadi Bahasa Indonesia.

## 2. Paket dan Zui Admin
Studiku memakai pola **standar** Zui Admin, sama dengan ZUI KONTRAKTOR, ZUI JURNAL, dan ZUI TO-DO. Satu pengguna = satu "perusahaan" (ID = UID).

| Zui Admin | Studiku | Isi |
|---|---|---|
| Starter | Pelajar | Catatan tanpa batas, PDF, statistik fokus, warna tema |
| Pro | Keluarga | Fitur Pelajar + grup keluarga sampai 3 anak (anak ikut Premium) |
| Bisnis | Sekolah dan bimbel | Untuk akun berperan sekolah: kelas, kode guru, guru dan mapel per kelas, tugas, nilai, dasbor. Guru ikut paket sekolahnya (tidak berlangganan sendiri). Bisa dipesan dari menu Berlangganan (harga dasar 30 siswa, `PRICE.business`) atau diaktifkan manual di Zui Admin (Pelanggan > Perpanjang, pilih Bisnis) untuk kesepakatan khusus |
| Gratis selamanya | semua fitur | Dicentang manual di Zui Admin |

- **Percobaan:** 14 hari **semua fitur** (termasuk membuat grup keluarga dan kelas sekolah; `planActive` di `firestore.rules`) sejak akun dibuat, paling awal 23 Okt 2026. Setelah itu akun turun ke **Gratis** (maksimal 30 catatan), tidak hanya-baca. Di Zui Admin, akun Gratis tampil sebagai "kedaluwarsa"; itu hanya label.
- **Tenggang:** paket berbayar masih berlaku 3 hari setelah tanggal berakhir, sama dengan Zui Admin.
- **Berlangganan:** Pengaturan > Premium > Berlangganan. Pilihan paket mengikuti peran: murid = Pelajar (`starter`), orang tua = Keluarga (`pro`), sekolah = Sekolah dan bimbel (`business`); guru tidak berlangganan dan 1/6/12 bulan, membayar lewat QRIS, lalu mengirim nomor referensi. Permintaan masuk ke **Antrean** Zui Admin; **Aktifkan** langsung mengubah paket di aplikasi. Di aplikasi Android dari Play Store tombol Berlangganan disembunyikan (aturan Google Play Billing); tandanya hanya berlaku selama sesi itu, jadi Chrome biasa di HP yang sama tetap bisa berlangganan.
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
| `pantau/{uid}` | `{nick, jadwal, kegiatan, rencana, sesi, mnt, sek}`, tanpa catatan | pemilik dan orang tua di grup keluarga |
| `codes/{KODE}` | `{gid}` | dibuka satu per satu, tidak bisa didaftar |
| `groups/{gid}` | `{name, kind, ownerId, code, count, createdAt, closed?}` | pemilik (`ownerId`) dan anggota. Grup keluarga dan kelas lama: `gid` = uid pemilik. Kelas baru: id acak 20 karakter |
| `groups/{gid}/anggota/{uid}` | `{uid, code, joinedAt, nick}` (`nick` tidak ada di anggota lama) | anggota itu sendiri dan pemilik grup; `nick` bisa diubah anggota |
| `groups/{gid}/items/{id}` | tugas dan jadwal kelas | tulis: guru pemilik; baca: anggota |
| `profil/{uid}` | `{peran, nama, hp, alamat, ...}` data pendaftaran sesuai peran; `peran` tidak bisa diganti sendiri | pemilik |
| `schools/{uidSekolah}` | `{name, jenjang, alamat, ownerId, codeGuru, createdAt}` | sekolah itu dan gurunya |
| `schools/{sid}/guru/{uid}` | `{uid, nama, code, joinedAt}` guru yang bergabung dengan kode guru | guru itu dan sekolah |
| `kodeguru/{KODE}` | `{sid}` | dibuka satu per satu |
| `groups/{gid}/wali/{uidOrtu}` | `{anak, nick, at}` orang tua murid di kelas ini, ditulis aplikasi anak | baca: orang tua itu, sekolah, guru kelas |
| `groups/{gid}/chat/{uidOrtu_uidGuru}` dan `/msgs/{id}` | ringkasan `{ortu, guru, anak, last, dari, at}` dan pesan `{dari, t, uid, at}` | orang tua dan guru itu |
| `schools/{sid}/info/{id}` | `{judul, isi, dari, at}` pengumuman | tulis: sekolah; baca: pengguna yang masuk |
| `schools/{sid}/program/{id}` | `{nama, pj, status, progres, catatan, at}` | tulis: sekolah; baca: sekolah dan gurunya |
| `schools/{sid}/pesan/{uidGuru}` dan `/msgs/{id}` | ringkasan `{last, dari, at}` dan pesan `{dari, t, uid, at}` | sekolah dan guru itu |
| `groups/{gid}/pengajar/{uid}` | `{uid, nama, mapel: [...], at}` guru dan mapel di kelas sekolah | tulis: sekolah; baca: guru itu, sekolah, siswa kelas |
| `groups/{gid}/items/{id}/nilai/{uid}` | `{uid, nilai, by, at}` nilai 0 sampai 100 | tulis: guru pemberi tugas; baca: siswa itu, guru itu, sekolah |
| `groups/{gid}/items/{id}/selesai/{uid}` | `{uid, nick, at}`, tanda tugas kelas selesai | buat/hapus: siswa itu sendiri (harus anggota, hanya untuk tugas); baca: siswa itu dan guru pemilik |

- **Pendaftaran:** wajib, hanya email dan kata sandi (tanpa Google, tanpa mode tanpa akun). Langkah: pilih peran (murid, orang tua, guru, sekolah) > data lengkap sesuai peran (`RF` di `app.html`) > email, kata sandi, ulangi kata sandi (bisa dilihat) > verifikasi email. Data pendaftaran disimpan di perangkat (`sk_rg`) sampai email terverifikasi, lalu ditulis ke `profil/{uid}`. Pengguna lama yang belum punya profil wajib melengkapi data saat masuk. Pengguna lama yang dulu masuk dengan Google memakai **Lupa kata sandi** dengan email yang sama untuk membuat kata sandi.
- **Menu per peran** (`RTABS`): murid = Beranda, Jadwal, Tugas dan kegiatan, Nilai, Catatan, Rencana, Fokus, Kelasku, Pengumuman, Kalkulator, Translate; orang tua = Pantau anak, Pesan guru, Pengumuman, Keluarga; guru = Beranda, Kelas dan mapel, Beri tugas, Penilaian, Pengumuman, Pesan sekolah, Pesan orang tua, Sekolah; sekolah = Dasbor, Kelas, Guru, Pengumuman, Pesan guru, Program.
- **Pantau anak (orang tua):** kelas, semua tugas kelas dengan status (Belum, Selesai, Terlambat, Nilai), tugas yang belum dikerjakan, dan rata-rata nilai per mapel. Data dibaca langsung dari kelas, tanda selesai, dan nilai yang ditulis guru, jadi anak tidak bisa mengubahnya. Supaya orang tua bisa membuka kelas anaknya, aplikasi anak mencatat orang tuanya di tiap kelas (`groups/{gid}/wali/{uidOrtu}`) setelah anak bergabung ke kelas dan ke grup keluarga.
- **Pesan orang tua dan guru** (`groups/{gid}/chat/{uidOrtu_uidGuru}/msgs`): orang tua memilih guru yang mengajar anaknya; guru melihat daftar orang tua murid di kelas yang ia ajar (pesan baru ditandai •). Hanya keduanya yang bisa membaca. Sekolah tidak bisa membaca, kecuali saat kelas ditutup untuk dihapus (pembersihan).
- **Pengumuman** (`schools/{sid}/info`): dibuat sekolah untuk semua. Guru membacanya di Pengumuman dan Beranda, murid dari sekolah kelas yang diikuti, orang tua dari sekolah anaknya (`pantau/{uidAnak}.sek`, ditulis aplikasi anak). Bisa dibaca pengguna mana pun yang masuk dan tahu id sekolahnya, jadi jangan berisi data pribadi.
- **Pesan pribadi sekolah dan guru** (`schools/{sid}/pesan/{uidGuru}/msgs`): hanya sekolah dan guru itu. Guru yang keluar atau dikeluarkan tidak bisa membukanya lagi. Pesan baru dari guru ditandai • di daftar guru.
- **Program sekolah** (`schools/{sid}/program`): nama, penanggung jawab, status (Direncanakan, Berjalan, Selesai), progres 0 sampai 100, dan catatan. Ringkasannya tampil di Dasbor; guru sekolah itu bisa membacanya.
- **Sekolah:** saat daftar, akun sekolah langsung mendapat `schools/{uid}` dan **kode guru** (`kodeguru/{kode}`). Menu Kelas: buat kelas (kode untuk siswa), lalu tugaskan guru dan mapel per kelas (`groups/{gid}/pengajar/{uid}`). Menu Guru: kode guru, pesan undangan (salin atau WhatsApp), keluarkan guru. Dasbor: angka per kelas dan per guru, tanpa nama atau nilai siswa.
- **Guru:** bergabung dengan kode guru (saat daftar atau di menu Sekolah), melihat kelas dan mapel yang ditugaskan, memberi tugas ke beberapa kelas sekaligus, melihat siapa yang sudah selesai, dan memberi nilai 0 sampai 100 (`items/{id}/nilai/{uid}`). Kelas lama buatan guru sendiri tetap bisa dibuka dari menu Sekolah.
- **Murid:** bergabung ke kelas dengan kode (saat daftar atau di Kelasku), melihat tugas dari semua guru dan mapel, mencentang tugas selesai, dan melihat nilainya di menu Nilai.
- **Grup keluarga:** orang tua dengan paket Keluarga membuat grup di tab Grup dan membagikan kode (maksimal 3 anak). Orang tua hanya melihat jadwal, kegiatan, rencana, dan statistik fokus anak, bukan catatan pelajarannya.
- **Kelas lama:** kelas yang dulu dibuat guru sendiri (id = uid guru, atau id acak tanpa field `school`) tetap jalan dengan aturan lama. Kelas baru dibuat oleh akun sekolah (field `school`). **Hapus kelas**: grup ditandai `closed`, isinya (tugas, tanda selesai, nilai, pengajar, anggota) dibersihkan, lalu grup dan kodenya dihapus.
- **Navigasi:** menu samping dibuka dengan ☰ di kiri atas (di layar lebar selalu tampil), Pengaturan di bagian bawah menu. Di kanan atas: 🔔 pengingat (tugas, ujian, dan rencana yang lewat atau jatuh tempo 3 hari ke depan, plus tombol aktifkan notifikasi) dan 💬 Chat admin, dengan angka bila ada yang perlu dilihat.
- **Tugas selesai:** siswa mengisi nama saat bergabung (bisa diubah lewat "ubah" di tab Grup), lalu mencentang tugas kelas di Beranda. Guru melihat "✓ x/y selesai" di tiap tugas; ketuk untuk melihat nama yang sudah dan belum. Guru tidak bisa melihat jadwal, kegiatan, catatan, atau email siswa. Tanda selesai ikut dihapus saat siswa keluar kelas atau menghapus akun.
- **Pengingat tugas dan ujian (lokal):** Pengaturan > Pengingat tugas dan ujian. Setelah izin notifikasi diberikan, aplikasi memunculkan notifikasi untuk Kegiatan berkategori Tugas atau Ujian dan tugas kelas yang belum dicentang, yang jatuh tempo hari ini atau besok. Notifikasi muncul saat aplikasi dibuka dan tiap 30 menit selama terbuka; satu tugas hanya diingatkan sekali per hari. Tanpa server dan tanpa biaya, tetapi **tidak bisa muncul bila aplikasi tidak dibuka sama sekali**. Di aplikasi Android (TWA dari PWABuilder) aktifkan *notification delegation* saat membuat paket agar notifikasi tampil sebagai notifikasi aplikasi. `sw.js` wajib ikut diunggah.
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

## 7. Uji dengan Firebase Emulator
Butuh Node 18+ dan Java 11+. Dari folder `tests`:
```bash
npm i
npm run test:rules   # aturan Firestore (@firebase/rules-unit-testing), termasuk skenario grup lama
npm run test:e2e     # alur di Chromium (Playwright) dengan emulator Auth + Firestore
```
Uji browser memakai Chromium di `/opt/pw-browsers/chromium` (ganti dengan variabel `CHROMIUM`). SDK compat 10.12.2 dilayani dari `node_modules` (paket `firebase-compat`), dan `app.html` disambungkan ke emulator saat uji saja; file aslinya tidak diubah. Project emulator `demo-studiku`, tidak menyentuh `sudiku-zui`.

## 8. Usulan berikutnya (belum dibuat)
- **Pengingat push (FCM):** notifikasi tetap datang walau aplikasi tertutup. Butuh pengirim terjadwal: Cloud Functions + Cloud Scheduler (project naik ke paket Blaze; untuk uji coba satu sekolah praktis Rp0 karena masuk kuota gratis) atau GitHub Actions terjadwal (gratis, kunci service account di GitHub Secrets). Perlu menyimpan token perangkat di Firestore (perbarui Kebijakan Privasi). Di iPhone hanya jalan bila aplikasi dipasang ke layar utama (iOS 16.4+).
- **Anak tanpa email:** orang tua atau guru membuat akun siswa berupa nama pengguna + PIN. Secara teknis akun email/sandi Firebase dengan email buatan (mis. `nama.kode@siswa.studikita.zuisystem.com`) yang dibuat dan ditandai terverifikasi oleh Cloud Function (Admin SDK), jadi butuh Blaze. Alternatif tanpa server: Anonymous Auth + kode pemulihan, tetapi data hilang bila kode hilang.
