// Uji alur app.html di Chromium dengan emulator Auth + Firestore. Jalankan dari folder tests:
//   npm i && npm run test:e2e
// Chromium: CHROMIUM=/jalur/ke/chrome (bawaan /opt/pw-browsers/chromium).
// SDK Firebase compat 10.12.2 dilayani dari node_modules (paket firebase-compat), bukan dari gstatic.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, Timestamp } from 'firebase/firestore';

const PROJECT = 'demo-studiku';
const AUTH = 'http://localhost:9099';
const SDK = (f) => readFileSync(new URL('node_modules/firebase-compat/' + f.replace(/[^\w.-]/g, ''), import.meta.url));
const APP = readFileSync(new URL('../app.html', import.meta.url), 'utf8')
  .replace("projectId:'sudiku-zui'", "projectId:'" + PROJECT + "'")
  .replace("db=firebase.firestore()}", "db=firebase.firestore();fa.useEmulator('" + AUTH + "',{disableWarnings:true});db.useEmulator('localhost',8080)}");
if (!APP.includes('useEmulator')) throw new Error('gagal menyambungkan app.html ke emulator');
const SW = readFileSync(new URL('../sw.js', import.meta.url));

let pass = 0;
function ok(c, m) { if (!c) throw new Error('GAGAL: ' + m); pass++; console.log('  ✔ ' + m); }
const iso = (d) => d.toISOString().slice(0, 10);
const besok = iso(new Date(Date.now() + 864e5));

// akun lama (sebelum ada pendaftaran dengan peran): sudah terverifikasi, belum punya profil
async function akunLama(email) {
  const r = await (await fetch(AUTH + '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'rahasia1', returnSecureToken: true }),
  })).json();
  await fetch(AUTH + '/identitytoolkit.googleapis.com/v1/projects/' + PROJECT + '/accounts:update', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: r.localId, emailVerified: true }),
  });
  return r.localId;
}
async function klikVerifikasi(email) {
  const oob = await (await fetch(AUTH + '/emulator/v1/projects/' + PROJECT + '/oobCodes')).json();
  const v = oob.oobCodes.filter((o) => o.email === email && o.requestType === 'VERIFY_EMAIL').pop();
  await fetch(v.oobLink, { redirect: 'manual' });
}

const env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
async function admin(fn) { let r; await env.withSecurityRulesDisabled(async (c) => { r = await fn(c.firestore()); }); return r; }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests'] });
async function halaman({ hp, notif, seed } = {}) {
  const ctx = await browser.newContext({ permissions: notif ? ['notifications'] : [], viewport: hp ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
  await ctx.route('https://www.gstatic.com/firebasejs/**', (rt) => rt.fulfill({ contentType: 'text/javascript', body: SDK(rt.request().url().split('/').pop()) }));
  await ctx.route('https://fonts.googleapis.com/**', (rt) => rt.abort());
  await ctx.route('http://localhost:5055/**', (rt) => {
    const u = new URL(rt.request().url()).pathname;
    if (u === '/app.html') return rt.fulfill({ contentType: 'text/html', body: APP });
    if (u === '/sw.js') return rt.fulfill({ contentType: 'text/javascript', body: SW });
    return rt.fulfill({ status: 404, body: '' });
  });
  await ctx.addInitScript((seed) => {
    if (seed && !sessionStorage.getItem('seed')) { sessionStorage.setItem('seed', '1'); for (const k in seed) localStorage.setItem(k, seed[k]); }
  }, seed || null);
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept());
  p.on('pageerror', (e) => console.log('    [pageerror]', e.message));
  await p.goto('http://localhost:5055/app.html');
  return p;
}
// tangkapan layar bila SHOT_DIR diisi
const foto = (p, n) => process.env.SHOT_DIR ? p.screenshot({ path: process.env.SHOT_DIR + '/' + n + '.png', fullPage: true }) : null;
const siap = (p) => p.waitForFunction(() => typeof UID === 'string' && UID && document.querySelector('#nav button') && !document.querySelector('#pg.empty'), null, { timeout: 20000 });
async function masuk(p, email) { await p.waitForSelector('#ge'); await p.fill('#ge', email); await p.fill('#gp', 'rahasia1'); await p.click('#v >> button:text-is("Masuk")'); }
async function menu(p, label) { if (await p.locator('[aria-label=Menu]').isVisible()) { await p.click('[aria-label=Menu]'); await p.waitForTimeout(250); } await p.click('#nav >> button:has-text("' + label + '")'); await p.waitForFunction(() => !document.querySelector('#pg.empty'), null, { timeout: 20000 }); await p.waitForTimeout(300); }
async function isiData(p, data) {
  for (const [k, v] of Object.entries(data)) {
    const el = p.locator('#r_' + k);
    if ((await el.evaluate((e) => e.tagName)) === 'SELECT') await el.selectOption(v); else await el.fill(v);
  }
}
// daftar lewat layar: peran, data, email dan kata sandi, verifikasi email
async function daftar(p, peran, data, email) {
  await p.waitForSelector('#ge'); await p.click('text=Belum punya akun? Daftar');
  await p.click('.role:has-text("' + peran + '")'); await p.click('#v >> button:text-is("Lanjut")');
  if (data.jenjang) await p.selectOption('#r_jenjang', data.jenjang);
  await isiData(p, data);
  if (await p.locator('#r_izin').count()) await p.check('#r_izin');
  await p.check('#r_setuju'); await p.click('#v >> button:text-is("Lanjut")');
  await p.fill('#r_email', email); await p.fill('#r_pw', 'rahasia1'); await p.fill('#r_pw2', 'rahasia1');
  await p.click('#v >> button:text-is("Daftar")');
  await p.waitForSelector('text=Cek emailmu');
  await klikVerifikasi(email);
  await p.click('text=Sudah verifikasi, lanjut');
  await siap(p);
}

try {
  console.log('Sekolah mendaftar, membuat kelas, dan membagikan kode guru');
  const sk = await halaman();
  await sk.waitForSelector('#ge');
  ok(!(await sk.locator('text=Lanjut dengan Google').count()) && !(await sk.locator('text=Pakai tanpa akun').count()), 'layar masuk tanpa Google dan tanpa mode tanpa akun');
  await sk.click('text=Belum punya akun? Daftar');
  await sk.click('#v >> button:text-is("Lanjut")');
  ok(await sk.locator('text=Pilih salah satu peran.').isVisible(), 'peran wajib dipilih');
  await sk.click('.role:has-text("Sekolah / Universitas")'); await sk.click('#v >> button:text-is("Lanjut")');
  await sk.click('#v >> button:text-is("Lanjut")');
  ok((await sk.locator('.rerr:has-text("Wajib diisi.")').count()) >= 6, 'data sekolah wajib diisi lengkap');
  await isiData(sk, { instansi: 'SMPN 5 Bandung', jenis: 'SMP / MTs', nama: 'Drs. Hendra', jabatan: 'Kepala sekolah', hp: '0812', jumlah: '101 sampai 300', alamat: 'Jl. Belitung 8, Bandung' });
  await sk.check('#r_setuju'); await sk.click('#v >> button:text-is("Lanjut")');
  await foto(sk, 'daftar-data');
  ok(await sk.locator('text=Nomor HP Indonesia diawali 08').isVisible(), 'nomor HP diperiksa');
  await sk.fill('#r_hp', '081234567890'); await sk.click('#v >> button:text-is("Lanjut")');
  ok(await sk.locator('#r_email').isVisible(), 'email diisi di langkah terakhir');
  await sk.fill('#r_email', 'admin@smpn5.sch.id'); await sk.fill('#r_pw', 'rahasia1'); await sk.fill('#r_pw2', 'rahasia2');
  await sk.click('.eye >> nth=0');
  ok((await sk.locator('#r_pw').getAttribute('type')) === 'text', 'kata sandi bisa dilihat');
  await sk.click('#v >> button:text-is("Daftar")');
  ok(await sk.locator('text=Kata sandi tidak sama').isVisible(), 'kata sandi harus dikonfirmasi');
  ok((await sk.locator('#r_pw').inputValue()) === 'rahasia1', 'kata sandi yang sudah diketik tidak hilang');
  await sk.fill('#r_pw2', 'rahasia1'); await sk.click('#v >> button:text-is("Daftar")');
  await sk.waitForSelector('text=Cek emailmu');
  ok(await sk.locator('text=admin@smpn5.sch.id').isVisible(), 'layar verifikasi email');
  await sk.click('text=Sudah verifikasi, lanjut'); await sk.waitForTimeout(800);
  ok(await sk.locator('text=Email belum terverifikasi').isVisible(), 'tidak bisa lanjut sebelum email diverifikasi');
  await klikVerifikasi('admin@smpn5.sch.id');
  await sk.click('text=Sudah verifikasi, lanjut'); await siap(sk);
  const SK = await sk.evaluate(() => UID);
  const pf = await admin(async (d) => (await getDoc(doc(d, 'profil', SK))).data());
  ok(pf.peran === 'sekolah' && pf.instansi === 'SMPN 5 Bandung' && pf.hp === '081234567890', 'profil sekolah tersimpan');
  const menuSk = await sk.locator('#nav button').allInnerTexts();
  ok(menuSk.join('|').includes('Dasbor') && !menuSk.join('|').includes('Catatan'), 'menu sekolah: ' + menuSk.map((x) => x.replace(/^\W+/u, '')).join(', '));
  await menu(sk, 'Kelas');
  for (const k of ['7A', '7B']) { await sk.fill('#kn', k); await sk.click('button:text-is("Buat kelas")'); await sk.waitForFunction((k) => [...document.querySelectorAll('#pg b')].some((b) => b.textContent === k), k); }
  const kelas = await admin(async (d) => (await getDocs(collection(d, 'groups'))).docs.map((x) => ({ id: x.id, ...x.data() })).filter((x) => x.school === SK));
  ok(kelas.length === 2, 'sekolah membuat kelas 7A dan 7B');
  const k7a = kelas.find((k) => k.name === '7A'), k7b = kelas.find((k) => k.name === '7B');
  await menu(sk, 'Guru');
  const kodeGuru = (await sk.locator('.kode').innerText()).trim();
  ok(/^[A-Z0-9]{8}$/.test(kodeGuru), 'kode guru: ' + kodeGuru);

  console.log('Guru mendaftar dengan kode guru');
  const g = await halaman({ hp: true });
  await daftar(g, 'Guru / Dosen', { nama: 'Rina Wulandari, S.Pd.', hp: '081298765432', sekolah: 'SMPN 5 Bandung', mapel: 'Matematika', ajar: '7A, 7B', alamat: 'Jl. Belitung 8, Bandung', kode: kodeGuru }, 'rina@guru.id');
  const G = await g.evaluate(() => UID);
  ok(await admin(async (d) => (await getDoc(doc(d, 'schools', SK, 'guru', G))).exists()), 'guru tergabung ke sekolah lewat kode');
  ok(await g.locator('text=Sekolah belum menugaskanmu ke kelas').isVisible(), 'guru menunggu ditugaskan');

  console.log('Sekolah menugaskan guru ke kelas dan mapel');
  await menu(sk, 'Kelas');
  for (const k of [k7a, k7b]) { await sk.fill('#am_' + k.id, 'Matematika'); await sk.click('#pg .card:has(#am_' + k.id + ') >> button:text-is("Tambah")'); await sk.waitForFunction((id) => !document.querySelector('#pg.empty') && document.querySelector('#am_' + id), k.id); await sk.waitForTimeout(300); }
  ok((await sk.locator('#pg .it .t:text-is("Rina Wulandari, S.Pd.")').count()) === 2, 'guru tampil di 7A dan 7B');
  ok((await admin(async (d) => [(await getDoc(doc(d, 'groups', k7a.id, 'pengajar', G))).data(), (await getDoc(doc(d, 'groups', k7b.id, 'pengajar', G))).data()])).every((x) => x && x.mapel.join() === 'Matematika'), 'penugasan guru dan mapel tersimpan');

  console.log('Murid mendaftar dengan kode kelas');
  const m = await halaman({ hp: true });
  await m.waitForSelector('#ge'); await m.click('text=Belum punya akun? Daftar');
  await m.click('.role:has-text("Murid")'); await m.click('#v >> button:text-is("Lanjut")');
  ok(!(await m.locator('#r_jurusan').count()), 'jurusan belum muncul sebelum jenjang dipilih');
  await m.selectOption('#r_jenjang', 'SMA/SMK/MA');
  ok(await m.locator('#r_jurusan').isVisible(), 'jurusan muncul untuk SMA');
  await m.selectOption('#r_jenjang', 'SMP');
  ok(!(await m.locator('#r_jurusan').count()), 'jurusan tidak muncul untuk SMP');
  await m.click('#v >> button:text-is("Kembali")'); await m.click('#v >> button:text-is("Batal")');
  await daftar(m, 'Murid', { jenjang: 'SMP', kelas: 'Kelas 7', nama: 'Andi Saputra', sekolah: 'SMPN 5 Bandung', hp: '081211112222', alamat: 'Jl. Belitung 8, Bandung', kode: k7a.code }, 'andi@siswa.id');
  const M = await m.evaluate(() => UID);
  ok(await admin(async (d) => (await getDoc(doc(d, 'groups', k7a.id, 'anggota', M))).exists()), 'murid langsung masuk ke 7A lewat kode');
  const menuM = (await m.locator('#nav button').allInnerTexts()).join('|');
  ok(menuM.includes('Nilai') && menuM.includes('Kelasku') && !menuM.includes('Beri tugas'), 'menu murid berisi Nilai dan Kelasku');

  console.log('Guru memberi tugas ke dua kelas, murid mencentang, guru menilai');
  await g.reload(); await siap(g);
  ok(await g.locator('text=7A · Matematika').isVisible() && await g.locator('text=7B · Matematika').isVisible(), 'guru melihat kelas dan mapel yang diajar');
  await menu(g, 'Beri tugas');
  await g.fill('#bj', 'Latihan pecahan hal. 42'); await g.fill('#bt', besok);
  for (const c of await g.locator('[name=kk]').all()) await c.check();
  await g.click('button:text-is("Kirim tugas")'); await g.waitForFunction(() => tab === 'gkelas' && !document.querySelector('#pg.empty'));
  const it = await admin(async (d) => { const a = []; for (const k of [k7a, k7b]) a.push(...(await getDocs(collection(d, 'groups', k.id, 'items'))).docs.map((x) => x.data())); return a; });
  ok(it.length === 2 && it.every((x) => x.by === G && x.mapel === 'Matematika'), 'satu tugas terkirim ke 7A dan 7B');
  await m.reload(); await siap(m);
  ok(await m.locator('.card:has-text("Latihan pecahan") >> text=Matematika · Rina Wulandari').isVisible(), 'murid melihat tugas beserta mapel dan gurunya');
  await m.click('.card:has-text("Latihan pecahan") >> .chk'); await m.waitForTimeout(1200);
  await menu(g, 'Kelas dan mapel');
  await foto(g, 'guru-kelas');
  ok(await g.locator('text=1/1 selesai').first().isVisible(), 'guru melihat 1/1 selesai');
  ok(await g.locator('td >> text=Andi Saputra').isVisible() && await g.locator('td .pill:has-text("Selesai")').isVisible(), 'guru melihat nama dan status siswa');
  await menu(g, 'Penilaian');
  await g.selectOption('#gns', { label: '7A · Matematika · Latihan pecahan hal. 42' }); await g.waitForFunction(() => !document.querySelector('#pg.empty'));
  await g.fill('.nil', '150'); await g.click('button:text-is("Simpan nilai")');
  ok(await g.locator('text=Nilai harus angka 0 sampai 100').isVisible(), 'nilai di luar 0 sampai 100 ditolak');
  await g.fill('.nil', '88'); await g.click('button:text-is("Simpan nilai")'); await g.waitForTimeout(1500);
  ok((await admin(async (d) => (await getDoc(doc(d, 'groups', k7a.id, 'items', (await getDocs(collection(d, 'groups', k7a.id, 'items'))).docs[0].id, 'nilai', M))).data()))?.nilai === 88, 'nilai 88 tersimpan');
  await m.reload(); await siap(m);
  ok(await m.locator('.card:has-text("Latihan pecahan") >> text=Nilai 88').isVisible(), 'murid melihat nilai di Beranda');
  await menu(m, 'Nilai');
  await foto(m, 'murid-nilai');
  ok(await m.locator('text=Rata-rata 88').isVisible(), 'menu Nilai murid: rata-rata Matematika 88');

  console.log('Dasbor sekolah');
  await menu(sk, 'Dasbor');
  const st = (await sk.locator('.stats.st5').innerText()).replace(/\n/g, ' ');
  ok(/2 kelas/.test(st) && /1 siswa/.test(st) && /1\/1 guru aktif/.test(st) && /88 rata-rata nilai/.test(st), 'angka dasbor: ' + st);
  await foto(sk, 'sekolah-dasbor');
  ok(!(await sk.locator('#pg >> text=Andi Saputra').count()), 'dasbor tidak menampilkan nama siswa');

  console.log('Pengguna lama tanpa profil wajib melengkapi data');
  const LAMA = await akunLama('lama@siswa.id');
  await admin((d) => setDoc(doc(d, 'companies', LAMA), { name: 'Lama', owner: LAMA, created_at: Timestamp.now() }));
  const l = await halaman({ hp: true, seed: { sk: JSON.stringify({ n: 'Citra', lv: 'SMP', mode: 'local', jadwal: [], kegiatan: [{ id: 'k1', judul: 'Ujian IPA', kat: 'Ujian', tgl: besok }], catatan: [], rencana: [], sesi: {} }), 'sb-nparspjrfkrwgxujdyzy-auth-token': '{}' } });
  await l.waitForSelector('#ge');
  ok(await l.evaluate(() => S.mode === '' && Object.keys(localStorage).every((k) => !k.startsWith('sb-'))), 'mode tanpa akun lama dan sisa Supabase dibersihkan');
  await masuk(l, 'lama@siswa.id');
  await l.waitForSelector('text=Lengkapi data akunmu');
  ok(!(await l.locator('#nav button').count()), 'aplikasi belum bisa dipakai sebelum data lengkap');
  await l.click('.role:has-text("Murid")'); await l.click('#v >> button:text-is("Lanjut")');
  await l.selectOption('#r_jenjang', 'SMA/SMK/MA');
  await isiData(l, { kelas: 'Kelas 11', jurusan: 'IPA', nama: 'Citra Ayu', sekolah: 'SMAN 1 Bandung', hp: '081233334444', alamat: 'Jl. Ir. H. Juanda 93' });
  await l.check('#r_izin'); await l.check('#r_setuju'); await l.click('#v >> button:text-is("Simpan")');
  await siap(l);
  ok((await admin(async (d) => (await getDoc(doc(d, 'profil', LAMA))).data())).jurusan === 'IPA', 'data lengkap tersimpan, termasuk jurusan');
  ok(await l.locator('text=Ujian IPA').first().isVisible(), 'data lama di perangkat tetap ada');

  console.log('Masuk dengan email yang belum diverifikasi');
  await fetch(AUTH + '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'belum@x.id', password: 'rahasia1' }) });
  const u = await halaman();
  await masuk(u, 'belum@x.id');
  await u.waitForSelector('text=Cek emailmu');
  ok(await u.locator('text=belum@x.id').isVisible(), 'diarahkan ke verifikasi email');
  await klikVerifikasi('belum@x.id'); await u.click('text=Sudah verifikasi, lanjut');
  await u.waitForSelector('text=Lengkapi data akunmu');
  ok(true, 'setelah verifikasi diminta melengkapi data');

  console.log('HP: menu samping, pengaturan, lonceng');
  ok((await m.locator('#nav').boundingBox()).x < -100, 'menu samping tertutup di HP');
  await m.click('[aria-label=Menu]'); await m.waitForTimeout(300);
  const set = await m.locator('#nav .set').boundingBox();
  ok(set.y > 844 - 120 && set.x < 30, 'Pengaturan di kiri bawah menu');
  await m.click('#nav .set'); await m.waitForSelector('#sh h3:has-text("Pengaturan")');
  ok(await m.locator('#sh >> text=Andi Saputra').isVisible() && await m.locator('#sh >> text=Murid / Mahasiswa').isVisible(), 'pengaturan menampilkan profil dan peran');
  await m.click('#sh >> button:text-is("Batal")');
  await menu(sk, 'Dasbor');
  await sk.click('[aria-label=Pengingat]'); await sk.waitForSelector('#sh h3:has-text("Pengingat")'); await sk.click('#sh >> button:text-is("Tutup")');
  ok(true, 'lonceng bisa dibuka dari peran sekolah');

  console.log('Paket per peran');
  await sk.click('[aria-label=Pesan]'); await sk.waitForSelector('text=Chat dengan admin ZUI'); await sk.evaluate(() => cl());
  await sk.evaluate(() => langganan()); await sk.waitForSelector('#sp');
  const opsi = await sk.locator('#sp option').allInnerTexts();
  ok(opsi.length === 1 && /Sekolah/.test(opsi[0]), 'sekolah hanya melihat paket Sekolah');
  await sk.evaluate(() => cl());
  await g.evaluate(() => up()); await g.waitForSelector('#sh h3');
  ok(!(await g.locator('#sh >> button:text-is("Berlangganan")').count()) && await g.locator('#sh >> text=mengikuti paket sekolah').isVisible(), 'guru tidak perlu berlangganan');

  console.log('Hapus kelas dan hapus akun sekolah');
  await menu(sk, 'Kelas');
  await sk.locator('#pg .card:has-text("7B") >> button:text-is("Hapus")').click(); await sk.waitForTimeout(2500);
  ok(!(await admin(async (d) => (await getDoc(doc(d, 'groups', k7b.id))).exists())), 'kelas 7B beserta isinya terhapus');
  await sk.evaluate(() => openF('set')); await sk.click('text=Hapus akun'); await sk.waitForTimeout(4000);
  const sisa = await admin(async (d) => ({ s: (await getDoc(doc(d, 'schools', SK))).exists(), k: (await getDoc(doc(d, 'groups', k7a.id))).exists(), p: (await getDoc(doc(d, 'profil', SK))).exists(), kg: (await getDoc(doc(d, 'kodeguru', kodeGuru))).exists() }));
  ok(!sisa.s && !sisa.k && !sisa.p && !sisa.kg, 'hapus akun sekolah membersihkan sekolah, kelas, kode guru, dan profil');

  console.log(`\nLulus ${pass} pemeriksaan.`);
} finally {
  await browser.close();
  await env.cleanup();
}
