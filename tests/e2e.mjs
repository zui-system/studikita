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

async function akun(email) {
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

const env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
async function admin(fn) { let r; await env.withSecurityRulesDisabled(async (c) => { r = await fn(c.firestore()); }); return r; }
const later = Timestamp.fromMillis(Date.now() + 30 * 864e5);

const G = await akun('guru@sekolah.id'), L = await akun('lama@sekolah.id');
const S1 = await akun('andi@siswa.id'), S2 = await akun('budi@siswa.id');
const D = await akun('dewi@coba.id');
await admin(async (d) => {
  for (const [u, n] of [[G, 'Bu Guru'], [L, 'Pak Lama']]) {
    await setDoc(doc(d, 'companies', u), { name: n, owner: u, created_at: Timestamp.now(), plan: 'business', until: later });
  }
  // kelas lama: id = uid pemilik
  await setDoc(doc(d, 'groups', L), { name: '9C lama', kind: 'sekolah', ownerId: L, code: 'LAMA0001', count: 0, createdAt: Timestamp.now() });
  await setDoc(doc(d, 'codes', 'LAMA0001'), { gid: L });
  await setDoc(doc(d, 'groups', L, 'items', 'lama1'), { kind: 'tugas', data: { kind: 'Tugas', judul: 'Rangkuman Bab 2', tgl: besok }, createdAt: Timestamp.now() });
});

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests'] });
async function buka(email, notif, hp) {
  const ctx = await browser.newContext({ permissions: notif ? ['notifications'] : [], viewport: hp ? { width: 390, height: 844 } : undefined });
  if (hp) await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('sk_play', '1'); } });
  await ctx.route('https://www.gstatic.com/firebasejs/**', (rt) => rt.fulfill({ contentType: 'text/javascript', body: SDK(rt.request().url().split('/').pop()) }));
  await ctx.route('https://fonts.googleapis.com/**', (rt) => rt.abort());
  await ctx.route('http://localhost:5055/**', (rt) => {
    const u = new URL(rt.request().url()).pathname;
    if (u === '/app.html') return rt.fulfill({ contentType: 'text/html', body: APP });
    if (u === '/sw.js') return rt.fulfill({ contentType: 'text/javascript', body: SW });
    return rt.fulfill({ status: 404, body: '' });
  });
  // catat notifikasi yang ditampilkan
  await ctx.addInitScript(() => {
    window.__nt = [];
    const rec = (t, o) => window.__nt.push({ t, body: (o && o.body) || '' });
    if (window.ServiceWorkerRegistration) ServiceWorkerRegistration.prototype.showNotification = function (t, o) { rec(t, o); return Promise.resolve(); };
    if (window.Notification) { const N = window.Notification; window.Notification = function (t, o) { rec(t, o); }; window.Notification.permission = N.permission; window.Notification.requestPermission = N.requestPermission.bind(N); }
  });
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Andi Saputra' : undefined));
  p.on('pageerror', (e) => console.log('    [pageerror]', e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('    [console]', m.text().slice(0, 300)); });
  await p.goto('http://localhost:5055/app.html');
  await p.fill('#ge', email); await p.fill('#gp', 'rahasia1');
  await p.click('text=Masuk');
  await p.waitForSelector('#nav button', { timeout: 15000 }).catch(async (e) => { console.log('    [gm]', await p.locator('#gm').innerText()); throw e; });
  await p.waitForFunction(() => typeof UID === 'string' && UID.length > 0);
  await p.waitForTimeout(800);
  return p;
}
async function grup(p) { await p.click('#nav >> text=Grup'); await p.waitForFunction(() => !document.querySelector('#gr.empty')); await p.waitForTimeout(800); }

try {
  console.log('Guru membuat dua kelas');
  const g = await buka('guru@sekolah.id');
  await grup(g);
  await g.fill('#gn', '7A Matematika'); await g.click('#gr >> button:text-is("Buat")'); await g.waitForTimeout(1000);
  await g.waitForSelector('text=Buat kelas lain');
  await g.fill('#gn', '7B Matematika'); await g.click('#gr >> button:text-is("Buat")'); await g.waitForTimeout(1500);
  const kelas = await admin(async (d) => (await getDocs(collection(d, 'groups'))).docs.map((x) => ({ id: x.id, ...x.data() })).filter((x) => x.ownerId === G));
  ok(kelas.length === 2 && kelas.every((k) => k.id.length === 20), 'dua kelas dengan id acak 20 karakter');
  ok((await g.locator('text=Kode untuk dibagikan').count()) === 2, 'kedua kelas tampil di tab Grup');
  const k7a = kelas.find((k) => k.name.startsWith('7A')), k7b = kelas.find((k) => k.name.startsWith('7B'));

  console.log('Guru menambah tugas ke 7A');
  await g.evaluate((id) => { GID = id; openF('kelas'); }, k7a.id);
  await g.selectOption('#f_kind', 'Tugas'); await g.fill('#f_judul', 'PR Pecahan hal. 12'); await g.fill('#f_tgl', besok);
  await g.click('#sh >> text=Simpan'); await g.waitForTimeout(1500);
  ok(await g.locator('text=PR Pecahan hal. 12').isVisible(), 'tugas tampil di kartu kelas');

  console.log('Siswa bergabung dan menandai selesai');
  const a = await buka('andi@siswa.id');
  await grup(a);
  await a.fill('#gc', k7a.code); await a.fill('#gk', 'Andi'); await a.click('#gr >> button:has-text("Gabung")'); await a.waitForTimeout(1500);
  ok(await a.locator('text=7A Matematika').isVisible(), 'Andi masuk ke 7A');
  await a.click('#nav >> text=Beranda'); await a.waitForTimeout(500);
  ok(await a.locator('text=PR Pecahan hal. 12').isVisible(), 'tugas kelas tampil di Beranda siswa');
  await a.click('.card:has-text("PR Pecahan") >> .chk'); await a.waitForTimeout(1500);
  ok(await a.locator('.card.done:has-text("PR Pecahan")').count() === 1, 'tugas tercoret setelah ditandai');
  await a.reload(); await a.waitForFunction(() => typeof UID === 'string' && UID.length > 0); await a.waitForTimeout(1500);
  ok(await a.locator('.card.done:has-text("PR Pecahan")').count() === 1, 'tanda selesai tetap ada setelah muat ulang');
  await grup(a);
  await a.click('text=ubah'); await a.waitForTimeout(1200);
  ok(await a.locator('text=Andi Saputra').isVisible(), 'siswa mengganti namanya di kelas');

  const b = await buka('budi@siswa.id', true);
  await grup(b);
  await b.fill('#gc', k7a.code); await b.fill('#gk', 'Budi'); await b.click('#gr >> button:has-text("Gabung")'); await b.waitForTimeout(1500);

  console.log('Guru melihat siapa yang sudah selesai');
  await g.reload(); await g.waitForFunction(() => typeof UID === 'string' && UID.length > 0); await g.waitForTimeout(800);
  await grup(g);
  ok(await g.locator('text=✓ 1/2 selesai').isVisible(), 'guru melihat 1/2 selesai');
  ok(!(await g.locator('.swd').first().isVisible()), 'daftar nama tersembunyi sebelum diklik');
  await g.click('text=✓ 1/2 selesai');
  const det = await g.locator('.swd').first().innerText();
  ok(/Sudah: Andi Saputra/.test(det) && /Belum: Budi/.test(det), 'guru melihat nama: ' + det.replace(/\n/g, ' | '));

  console.log('Pengingat lokal');
  await b.click('#nav >> text=Beranda');
  await b.click('[aria-label=Pengaturan]');
  ok(/mati/.test(await b.locator('#ntb').innerText()), 'pengingat awalnya mati');
  await b.click('#ntb'); await b.waitForTimeout(800);
  ok(/aktif/.test(await b.locator('#ntb').innerText()), 'pengingat aktif setelah izin diberikan');
  await b.click('#sh >> text=Batal');
  let nt = await b.evaluate(() => window.__nt);
  ok(nt.length === 1 && /PR Pecahan/.test(nt[0].body) && /besok/.test(nt[0].body), 'notifikasi tugas kelas besok: ' + JSON.stringify(nt));
  await b.evaluate(() => remind()); await b.waitForTimeout(300);
  ok((await b.evaluate(() => window.__nt.length)) === 1, 'tidak mengulang notifikasi yang sama');
  await b.click('#nav >> text=Kegiatan'); await b.click('.fab');
  await b.fill('#f_judul', 'Ujian IPA'); await b.fill('#f_tgl', iso(new Date())); await b.selectOption('#f_kat', 'Ujian');
  await b.click('#sh >> text=Simpan');
  await b.evaluate(() => remind()); await b.waitForTimeout(300);
  nt = await b.evaluate(() => window.__nt);
  ok(nt.length === 2 && /Ujian IPA: hari ini/.test(nt[1].body) && !/PR Pecahan/.test(nt[1].body), 'notifikasi ujian hari ini');
  const a2 = await a.evaluate(() => { remind(); return window.__nt.length; });
  ok(a2 === 0, 'tanpa izin, tidak ada notifikasi (Andi)');

  console.log('Kelas lama (id = uid guru) tetap jalan');
  const l = await buka('lama@sekolah.id');
  await grup(l);
  ok(await l.locator('text=9C lama').isVisible() && await l.locator('text=LAMA0001').isVisible(), 'guru lama melihat kelas lamanya');
  ok(await l.locator('text=Buat kelas lain').isVisible(), 'guru lama bisa menambah kelas lain');
  await grup(b);
  await b.fill('#gc', 'LAMA0001'); await b.fill('#gk', 'Budi'); await b.click('#gr >> button:has-text("Gabung")'); await b.waitForTimeout(1500);
  ok(await b.locator('text=9C lama').isVisible(), 'siswa bergabung ke kelas lama');
  await b.click('#nav >> text=Beranda'); await b.waitForTimeout(500);
  await b.click('.card:has-text("Rangkuman Bab 2") >> .chk'); await b.waitForTimeout(1200);
  await grup(l);
  ok(await l.locator('text=✓ 1/1 selesai').isVisible(), 'guru lama melihat 1/1 selesai');

  console.log('Siswa keluar, guru menghapus kelas, hapus akun guru lama');
  await grup(a); await a.click('text=Keluar grup'); await a.waitForTimeout(1500);
  ok(!(await admin(async (d) => (await getDoc(doc(d, 'groups', k7a.id, 'anggota', S1))).exists())), 'Andi keluar dari 7A');
  ok(!(await admin(async (d) => (await getDocs(collection(d, 'groups', k7a.id, 'items'))).docs.length && (await getDocs(collection(d, `groups/${k7a.id}/items/${(await getDocs(collection(d, 'groups', k7a.id, 'items'))).docs[0].id}/selesai`))).size)), 'tanda selesai Andi ikut terhapus');
  await grup(g);
  await g.locator('.card:has-text("7A Matematika") >> text=Hapus kelas').click(); await g.waitForTimeout(2500);
  await g.locator('.card:has-text("7B Matematika") >> text=Hapus kelas').click(); await g.waitForTimeout(2000);
  const sisa = await admin(async (d) => ({
    g: (await getDocs(collection(d, 'groups'))).docs.filter((x) => x.data().ownerId === G).length,
    c: (await getDoc(doc(d, 'codes', k7a.code))).exists() || (await getDoc(doc(d, 'codes', k7b.code))).exists(),
    an: (await getDocs(collection(d, 'groups', k7a.id, 'anggota'))).size,
  }));
  ok(sisa.g === 0 && !sisa.c && sisa.an === 0, 'kelas, kode, dan anggota terhapus');
  await l.click('#nav >> text=Beranda'); await l.click('[aria-label=Pengaturan]');
  await l.click('text=Hapus akun'); await l.waitForTimeout(3000);
  const lama = await admin(async (d) => ({ g: (await getDoc(doc(d, 'groups', L))).exists(), an: (await getDocs(collection(d, 'groups', L, 'anggota'))).size, it: (await getDocs(collection(d, 'groups', L, 'items'))).size, c: (await getDoc(doc(d, 'codes', 'LAMA0001'))).exists() }));
  ok(!lama.g && !lama.an && !lama.it && !lama.c, 'hapus akun guru lama membersihkan kelas lama');

  console.log('Pengguna lama dari versi Supabase mendaftar ulang');
  const ctx = await browser.newContext();
  await ctx.route('https://www.gstatic.com/firebasejs/**', (rt) => rt.fulfill({ contentType: 'text/javascript', body: SDK(rt.request().url().split('/').pop()) }));
  await ctx.route('https://fonts.googleapis.com/**', (rt) => rt.abort());
  await ctx.route('http://localhost:5055/**', (rt) => new URL(rt.request().url()).pathname === '/app.html' ? rt.fulfill({ contentType: 'text/html', body: APP }) : rt.fulfill({ status: 404, body: '' }));
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('seed')) {
      sessionStorage.setItem('seed', '1');
      localStorage.setItem('sk', JSON.stringify({ n: 'Citra', lv: 'SMP', mode: 'cloud', jadwal: [], kegiatan: [{ id: 'k1', judul: 'PR dari versi lama', kat: 'Tugas', tgl: '2026-12-01' }], catatan: [], rencana: [], sesi: {} }));
      localStorage.setItem('sb-nparspjrfkrwgxujdyzy-auth-token', '{"access_token":"lama"}');
    }
    // catat perpindahan layar masuk <-> aplikasi (untuk mendeteksi layar berkedip)
    window.__sw = [];
    new MutationObserver(() => { const st = document.querySelector('#ge') ? 'gate' : document.querySelector('#nav button') ? 'app' : ''; if (st && window.__sw[window.__sw.length - 1] !== st) window.__sw.push(st); })
      .observe(document, { childList: true, subtree: true });
  });
  const c = await ctx.newPage();
  c.on('pageerror', (e) => console.log('    [pageerror]', e.message));
  await c.goto('http://localhost:5055/app.html');
  await c.waitForSelector('#ge');
  await c.waitForTimeout(800);
  ok(/Sesi masukmu sudah berakhir/.test(await c.locator('#gm').innerText()), 'sesi lama tanpa akun Firebase kembali ke layar masuk');
  ok(await c.evaluate(() => Object.keys(localStorage).every((k) => !k.startsWith('sb-'))), 'sisa sesi Supabase dihapus dari perangkat');
  await c.fill('#ge', 'citra@siswa.id'); await c.fill('#gp', 'rahasia1');
  await c.click('button:has-text("Daftar")');
  await c.waitForFunction(() => /email verifikasi/.test(document.querySelector('#gm').textContent), null, { timeout: 15000 });
  ok(true, 'daftar mengirim email verifikasi dan tetap di layar masuk');
  const oob = await (await fetch(AUTH + '/emulator/v1/projects/' + PROJECT + '/oobCodes')).json();
  const v = oob.oobCodes.find((o) => o.email === 'citra@siswa.id' && o.requestType === 'VERIFY_EMAIL');
  await fetch(v.oobLink, { redirect: 'manual' });
  await c.click('button:has-text("Masuk")');
  await c.waitForSelector('#nav button', { timeout: 15000 });
  await c.waitForTimeout(2000);
  const sw = await c.evaluate(() => window.__sw);
  ok(sw.join('>') === 'gate>app', 'layar tidak berkedip (hanya layar masuk lalu aplikasi): ' + sw.join('>'));
  ok(await c.locator('text=PR dari versi lama').isVisible(), 'data di perangkat tetap ada');
  const cu = await c.evaluate(() => UID);
  const ud = await admin(async (d) => (await getDoc(doc(d, 'users', cu))).data());
  ok(ud && ud.data.kegiatan[0].judul === 'PR dari versi lama', 'data di perangkat tersimpan ke akun Firebase baru');
  await ctx.close();


  console.log('HP: menu samping, lonceng, pesan, masa percobaan, dan paket Sekolah');
  const h = await buka('dewi@coba.id', false, true);
  ok(await h.evaluate(() => !PLAY && localStorage.getItem('sk_play') === null), 'tanda Android lama di localStorage dihapus, tombol Berlangganan tidak lagi tersembunyi');
  ok(await h.locator('[aria-label=Menu]').isVisible() && await h.locator('[aria-label=Pengingat]').isVisible() && await h.locator('[aria-label=Pesan]').isVisible(), 'bilah atas: ☰ kiri, 🔔 dan 💬 kanan');
  const tbx = await h.locator('#tb').boundingBox(), mb = await h.locator('[aria-label=Menu]').boundingBox(), pb = await h.locator('[aria-label=Pesan]').boundingBox();
  ok(mb.x < 40 && pb.x + pb.width > tbx.width - 40, 'tombol menu di kiri, pesan di kanan');
  ok((await h.locator('#nav').boundingBox()).x < -100, 'menu samping tertutup di awal');
  await h.click('[aria-label=Menu]'); await h.waitForTimeout(400);
  ok((await h.locator('#nav').boundingBox()).x >= 0, 'menu samping terbuka setelah ☰ ditekan');
  const set = await h.locator('#nav .set').boundingBox();
  ok(set.y > 844 - 120 && set.x < 30, 'Pengaturan ada di kiri bawah menu (y=' + Math.round(set.y) + ')');
  await h.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/menu.png' : '/dev/null' }).catch(() => {});
  await h.click('#nav >> text=Grup'); await h.waitForTimeout(400);
  ok((await h.locator('#nav').boundingBox()).x < -100, 'menu tertutup setelah memilih Grup');
  await h.waitForFunction(() => !document.querySelector('#gr.empty')); await h.waitForTimeout(800);
  ok(await h.locator('text=Buat kelas atau grup keluarga').isVisible(), 'masa percobaan bisa membuat kelas dan grup keluarga');
  await h.fill('#gn', 'Kelas Coba'); await h.click('#gr >> button:text-is("Buat")'); await h.waitForTimeout(1500);
  await h.selectOption('#gkind', 'keluarga'); await h.fill('#gn', 'Keluarga Dewi'); await h.click('#gr >> button:text-is("Buat")'); await h.waitForTimeout(1500);
  const dg = await admin(async (d) => (await getDocs(collection(d, 'groups'))).docs.map((x) => x.data()).filter((x) => x.ownerId === D).map((x) => x.kind).sort().join(','));
  ok(dg === 'keluarga,sekolah', 'kelas dan grup keluarga dibuat selama masa percobaan');
  ok(!(await h.locator('#gkind').count()), 'setelah grup keluarga ada, hanya kelas yang bisa ditambah');
  await h.evaluate(() => go('kegiatan')); await h.click('.fab');
  await h.fill('#f_judul', 'Ulangan Matematika'); await h.fill('#f_tgl', besok); await h.selectOption('#f_kat', 'Ujian');
  await h.click('#sh >> text=Simpan'); await h.waitForTimeout(300);
  ok((await h.locator('[aria-label=Pengingat] .bdg').innerText()) === '1', 'lonceng menampilkan 1 pengingat');
  await h.click('[aria-label=Pengingat]');
  ok(await h.locator('#sh >> text=Ulangan Matematika').isVisible() && /Ujian · besok/.test(await h.locator('#sh').innerText()), 'lonceng menampilkan ujian besok');
  await h.click('#sh >> button:has-text("Tutup")');
  await h.click('[aria-label=Pesan]'); await h.waitForTimeout(300);
  ok(await h.locator('text=Chat dengan admin ZUI').isVisible(), 'tombol pesan membuka Chat admin');
  await h.evaluate(() => cl());
  await h.click('[aria-label=Menu]'); await h.click('#nav .set'); await h.waitForTimeout(300);
  ok(await h.locator('#sh h3:has-text("Pengaturan")').isVisible(), 'Pengaturan terbuka dari menu');
  await h.click('#sh >> button:has-text("Premium")');
  ok(/Masa percobaan semua fitur/.test(await h.locator('#sh').innerText()), 'status masa percobaan semua fitur');
  await h.click('#sh >> button:has-text("Berlangganan")'); await h.waitForSelector('#sp');
  const opts = await h.locator('#sp option').allInnerTexts();
  ok(opts.length === 3 && /Sekolah/.test(opts[2]), 'pilihan paket: ' + opts.join(', '));
  await h.selectOption('#sp', 'business'); await h.selectOption('#sm', '6');
  ok((await h.locator('#spr').innerText()) === 'Rp750.000', 'harga Sekolah 6 bulan Rp750.000');
  await h.fill('#sref', 'QRIS123'); await h.click('#sh >> button:has-text("Kirim")'); await h.waitForTimeout(1500);
  const rq = await admin(async (d) => (await getDocs(collection(d, 'subreqs'))).docs.map((x) => x.data()).find((x) => x.cid === D));
  ok(rq && rq.plan === 'business' && rq.months === 6 && rq.amount === 750000 && rq.status === 'wait', 'permintaan paket Sekolah masuk antrean Zui Admin');

  console.log(`\nLulus ${pass} pemeriksaan.`);
} finally {
  await browser.close();
  await env.cleanup();
}
