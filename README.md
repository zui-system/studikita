# ZUI Studiku: panduan pasang

## 1. Supabase
1. Buat project di supabase.com, lalu buka **SQL Editor**, tempel isi `supabase.sql`, klik Run.
2. **Project Settings > API**: salin *Project URL* dan *anon public key*, tempel ke `SB_URL` dan `SB_KEY` di bagian atas `<script>` pada `index.html`. Kunci anon memang boleh publik karena data dilindungi aturan RLS dari langkah 1. Jangan pernah memakai kunci `service_role` di sini.
3. **Authentication > Providers > Email**: pastikan *Confirm email* aktif (ini yang membuat daftar memakai verifikasi email).
4. **Authentication > URL Configuration**: isi *Site URL* dengan alamat domainmu (https://domainmu.com) dan tambahkan alamat yang sama di *Redirect URLs*.
5. **Login Google**: di Google Cloud Console buat *OAuth client ID* (Web application). Isi *Authorized redirect URI* dengan alamat callback yang tertera di Supabase pada **Authentication > Providers > Google**. Salin Client ID dan Client Secret ke halaman Supabase itu, lalu aktifkan.
6. Untuk email verifikasi yang stabil di banyak pengguna, atur SMTP sendiri di **Authentication > SMTP Settings**, karena email bawaan Supabase dibatasi jumlahnya.

## 2. GitHub Pages dan domain
1. Buat repo di GitHub, unggah `index.html` (dan file lain di folder ini) ke branch `main`.
2. **Settings > Pages**: Source = *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. Di **Custom domain** isi domainmu. Di DNS domain: untuk subdomain (misal belajar.domainmu.com) buat record CNAME ke `USERNAME.github.io`; untuk domain utama buat record A ke 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153.
4. Centang **Enforce HTTPS** setelah sertifikat aktif.

## 3. Paket premium
- Jalankan ulang `supabase.sql` bagian tabel `plans` (bagian paling bawah).
- Isi `UPGRADE_URL` di `index.html` dengan tautan pembayaran atau WhatsApp-mu. Selama kosong, tombol Upgrade tidak muncul.
- Aktifkan premium untuk seorang pengguna lewat SQL Editor (contoh ada di bagian bawah `supabase.sql`). Untuk otomatis setelah bayar, nanti dibuat Edge Function yang dipanggil Midtrans atau Xendit.
- Batas 30 catatan untuk paket gratis hanya diatur di tampilan aplikasi. Pengguna yang paham teknis bisa melewatinya. Untuk batas yang tegas, aturan itu harus dipindah ke server.

## 4. Paket Keluarga dan Sekolah
- Jalankan ulang bagian paling bawah `supabase.sql` ("Paket Keluarga dan Sekolah").
- Aktifkan paket pelanggan lewat SQL Editor dengan nilai `plan` = `keluarga` atau `sekolah` (contoh ada di komentar SQL).
- **Keluarga:** orang tua membuat grup di tab Grup dan membagikan kode ke anak (maksimal 3 anak). Anak yang bergabung otomatis mendapat fitur Premium selama paket orang tua aktif. Orang tua hanya melihat jadwal, kegiatan, rencana, dan statistik fokus anak, bukan catatan pelajarannya.
- **Sekolah:** guru membuat kelas, membagikan kode ke siswa, lalu menambah tugas atau jadwal kelas. Siswa melihatnya di tab Grup. Guru tidak bisa melihat data pribadi siswa.
- Anak di bawah umur: aturan persetujuan orang tua ada di `legal.html` (Syarat bagian 3, Privasi bagian 7).

## 5. Play Store
1. Unggah SEMUA file di folder ini ke GitHub (termasuk `.nojekyll` dan folder `.well-known`). Dokumen legal (Syarat Layanan, Kebijakan Privasi, Pengembalian Dana, Kontak) ada di `legal.html`; `privacy.html` mengarah ke bagian privasinya. Jalankan bagian "Hapus akun" di `supabase.sql`.
2. Buka pwabuilder.com, masukkan alamat domainmu, pilih paket Android, isi package name (misal `com.domainmu.studikita`), lalu unduh file `.aab` dan kunci penandatanganannya. Simpan kunci itu baik-baik.
3. Di Play Console aktifkan Play App Signing, lalu salin *SHA-256 fingerprint* ke `.well-known/assetlinks.json` (dan package name yang sama), unggah ulang ke GitHub. Tanpa ini aplikasi tampil dengan bilah alamat browser.
4. Buat aplikasi di Play Console, unggah `.aab` ke jalur Closed testing, isi: kebijakan privasi (alamat `legal.html#privasi`), Data safety, content rating, target audiens, ikon 512 px, feature graphic 1024x500, dan minimal 2 screenshot.

## 6. Halaman depan (landing)
- `index.html` sekarang halaman depan (fitur, harga, FAQ). Aplikasinya ada di `app.html`; tombol Masuk dan Mulai gratis mengarah ke sana. Aplikasi Android langsung membuka `app.html`.
- Setelah aplikasi tayang di Play Store, isi `PLAY_URL` di bagian bawah `index.html` agar tombol unduh muncul.
- Di Supabase (Authentication > URL Configuration) tambahkan `https://domainmu.com/**` ke Redirect URLs agar login Google dan verifikasi email kembali ke `app.html`.
- Isi `SB_URL` dan `SB_KEY` di `app.html` (bukan `index.html`).

## 7. Tombol Berlangganan
- Tombol **Berlangganan** selalu tampil di versi web (Pengaturan > Lihat Premium) untuk pengguna yang belum Premium. Di aplikasi Play Store tombol ini disembunyikan.
- Isi `WA` di `app.html` dengan nomor WhatsApp-mu (format 628xxxxxxxxxx). Tombol akan membuka WhatsApp dengan pesan berisi ID akun pengguna, yang kamu pakai untuk mengaktifkan Premium lewat SQL Editor.
- Jika kamu sudah punya tautan pembayaran, isi `UPGRADE_URL` dan tombol akan membukanya.

## 8. Dokumen legal
- `legal.html` berisi Syarat Layanan (`#syarat`), Kebijakan Privasi (`#privasi`), Kebijakan Pengembalian Dana (`#refund`), serta Kontak & Alamat (`#kontak`).
- Tabel harga di Kebijakan Pengembalian Dana disalin dari `index.html` dan fungsi `up()` di `app.html`. Bila harga atau fitur berubah, samakan juga `legal.html`, lalu perbarui tanggal berlakunya.

## 9. Firebase (pengganti Supabase)
Aturan keamanan ada di `firestore.rules`, indeks di `firestore.indexes.json`, dan `firebase.json` untuk deploy.

### Pasang
1. Buat project di console.firebase.google.com, lalu aktifkan **Authentication** (Email/Password dan Google) dan **Cloud Firestore**.
2. **Authentication > Settings > Authorized domains**: tambahkan domainmu (misal `studikita.zuisystem.com`).
3. Deploy aturan dan indeks: `npm i -g firebase-tools`, `firebase login`, lalu `firebase deploy --only firestore --project ID_PROJECT`. Bisa juga tempel isi `firestore.rules` di **Firestore > Rules** lalu Publish, dan buat indeks collection group `members.uid` dari pesan error pertama yang muncul.
4. Semua akses butuh email terverifikasi. Akun Google otomatis terverifikasi. Untuk email/kata sandi, kirim `sendEmailVerification()` setelah daftar dan jangan izinkan masuk sebelum terverifikasi.

### Struktur data
| Lokasi | Isi | Siapa yang bisa |
|---|---|---|
| `users/{uid}` | `{data: S, updatedAt}`, seluruh data aplikasi (pengganti `user_data`) | baca/tulis: pemilik |
| `pantau/{uid}` | `{nick, jadwal, kegiatan, rencana, sesi, mnt, updatedAt}`, tanpa catatan | tulis: pemilik; baca: pemilik dan orang tua di grup keluarga |
| `plans/{uid}` | `{plan: 'free'/'pelajar'/'keluarga'/'sekolah', until: timestamp, note}` | tulis: admin; baca: pemilik dan anggota grupnya |
| `codes/{KODE}` | `{gid}` | buka satu per satu, tidak bisa didaftar |
| `groups/{uidPemilik}` | `{name, kind, ownerId, code, count, createdAt}`, satu grup per pemilik | pemilik dan anggota |
| `groups/{gid}/members/{uid}` | `{uid, code, joinedAt}` | anggota itu sendiri dan pemilik grup |
| `groups/{gid}/items/{id}` | `{kind: 'tugas'/'jadwal', data, createdAt}` (pengganti `class_items`) | tulis: guru pemilik; baca: anggota |

### Cara pakai di aplikasi (pengganti RPC Supabase)
- **my_plan:** baca `plans/{uid}`; Premium bila `plan != 'free'` dan `until` belum lewat. Anak juga Premium bila tergabung di grup keluarga yang paket pemiliknya aktif: cari lewat `collectionGroup('members').where('uid','==',uid)`, lalu baca `plans/{gid}`.
- **create_group:** satu batch: `set groups/{uid}` (`count: 0`, `createdAt: serverTimestamp()`) dan `set codes/{KODE}` (`{gid: uid}`). Kode minimal 8 karakter acak; bila gagal karena kode sudah dipakai, buat kode lain.
- **join_group:** baca `codes/{KODE}`, lalu satu batch: `set groups/{gid}/members/{uid}` (`{uid, code, joinedAt: serverTimestamp()}`) dan `update groups/{gid}` (`count: increment(1)`). Grup keluarga maksimal 3 anak, dan paket pemilik harus aktif.
- **Keluar grup:** satu batch: `delete members/{uid}` dan `update groups/{gid}` (`count: increment(-1)`).
- **family_view:** orang tua membaca `groups/{uid}/members`, lalu `pantau/{uidAnak}` untuk tiap anak. Aplikasi menulis `pantau/{uid}` setiap kali `users/{uid}` disimpan.
- **delete_account:** hapus `users`, `pantau`, dan `plans` milik sendiri, keluar dari semua grup, dan bila punya grup: hapus `groups/{uid}` dan `codes/{KODE}` dulu, lalu anggota dan item di bawahnya. Terakhir `auth.currentUser.delete()`.

### Mengaktifkan paket
Di **Firestore > Data**, buat atau ubah dokumen `plans/{uid}`: `plan` (string) dan `until` (timestamp tanggal berakhir). Konsol Firebase tidak terikat aturan. Untuk panel admin di aplikasi, beri akun admin custom claim `admin: true` lewat Admin SDK.

### Catatan
- Satu dokumen Firestore maksimal 1 MB. Bila catatan pengguna sangat banyak, pindahkan catatan ke subkoleksi `users/{uid}/catatan`.
- Setelah aplikasi benar-benar pindah ke Firebase, perbarui `legal.html` (Kebijakan Privasi bagian 1, 3, dan 4): ganti Supabase dengan Firebase Authentication dan Cloud Firestore dari Google.
