# Studi Kita: panduan pasang

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
- Anak di bawah umur: sebelum dipakai publik, siapkan kebijakan privasi dan persetujuan orang tua.

## 5. Play Store
1. Unggah SEMUA file di folder ini ke GitHub (termasuk `.nojekyll` dan folder `.well-known`). Ganti `[TANGGAL]`, `[NAMA...]`, `[EMAIL]` di `privacy.html`. Jalankan bagian "Hapus akun" di `supabase.sql`.
2. Buka pwabuilder.com, masukkan alamat domainmu, pilih paket Android, isi package name (misal `com.domainmu.studikita`), lalu unduh file `.aab` dan kunci penandatanganannya. Simpan kunci itu baik-baik.
3. Di Play Console aktifkan Play App Signing, lalu salin *SHA-256 fingerprint* ke `.well-known/assetlinks.json` (dan package name yang sama), unggah ulang ke GitHub. Tanpa ini aplikasi tampil dengan bilah alamat browser.
4. Buat aplikasi di Play Console, unggah `.aab` ke jalur Closed testing, isi: kebijakan privasi (alamat `privacy.html`), Data safety, content rating, target audiens, ikon 512 px, feature graphic 1024x500, dan minimal 2 screenshot.

## 6. Halaman depan (landing)
- `index.html` sekarang halaman depan (fitur, harga, FAQ). Aplikasinya ada di `app.html`; tombol Masuk dan Mulai gratis mengarah ke sana. Aplikasi Android langsung membuka `app.html`.
- Ganti `EMAIL@DOMAINMU.COM` di `index.html`. Setelah aplikasi tayang di Play Store, isi `PLAY_URL` di bagian bawah `index.html` agar tombol unduh muncul.
- Di Supabase (Authentication > URL Configuration) tambahkan `https://domainmu.com/**` ke Redirect URLs agar login Google dan verifikasi email kembali ke `app.html`.
- Isi `SB_URL` dan `SB_KEY` di `app.html` (bukan `index.html`).

## 7. Tombol Berlangganan
- Tombol **Berlangganan** selalu tampil di versi web (Pengaturan > Lihat Premium) untuk pengguna yang belum Premium. Di aplikasi Play Store tombol ini disembunyikan.
- Isi `WA` di `app.html` dengan nomor WhatsApp-mu (format 628xxxxxxxxxx). Tombol akan membuka WhatsApp dengan pesan berisi ID akun pengguna, yang kamu pakai untuk mengaktifkan Premium lewat SQL Editor.
- Jika kamu sudah punya tautan pembayaran, isi `UPGRADE_URL` dan tombol akan membukanya.
