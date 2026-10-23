// Uji firestore.rules di Firebase Emulator. Jalankan dari folder tests:
//   npm i && npm run test:rules
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, collection, collectionGroup,
  query, where, getDocs, serverTimestamp, increment, Timestamp } from 'firebase/firestore';

let env;
const DAY = 864e5;
const later = Timestamp.fromMillis(Date.now() + 30 * DAY);
const past = Timestamp.fromMillis(Date.now() - 30 * DAY);
// UID Firebase 28 karakter, id kelas baru 20 karakter (seperti doc() otomatis)
const U = (s) => (s + '_'.repeat(28)).slice(0, 28);
const T = U('guru'), L = U('guruLama'), E = U('guruHabis'), P = U('ortu'), S1 = U('siswa1'), S2 = U('siswa2'), X = U('orangLain');
const K1 = 'KELAS1aaaaaaaaaaaaaa', K2 = 'KELAS2bbbbbbbbbbbbbb';
const db = (uid) => env.authenticatedContext(uid, { email: uid + '@x.id', email_verified: true }).firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-studiku',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    await setDoc(doc(d, 'companies', T), { name: 'Bu Guru', owner: T, plan: 'business', until: later });
    await setDoc(doc(d, 'companies', L), { name: 'Pak Lama', owner: L, plan: 'business', until: later });
    await setDoc(doc(d, 'companies', E), { name: 'Habis', owner: E, plan: 'business', until: past });
    await setDoc(doc(d, 'companies', P), { name: 'Ortu', owner: P, plan: 'pro', until: later });
    // Kelas lama: id grup = uid pemilik, anggota tanpa nick, dibuat dengan aturan lama
    await setDoc(doc(d, 'groups', L), { name: '7A lama', kind: 'sekolah', ownerId: L, code: 'LAMA0001', count: 1, createdAt: past });
    await setDoc(doc(d, 'codes', 'LAMA0001'), { gid: L });
    await setDoc(doc(d, 'groups', L, 'anggota', S1), { uid: S1, code: 'LAMA0001', joinedAt: past });
    await setDoc(doc(d, 'groups', L, 'items', 'i1'), { kind: 'tugas', data: { judul: 'PR lama', tgl: '2026-11-01' }, createdAt: past });
  });
});

async function newClass(uid, gid, code, kind = 'sekolah') {
  const d = db(uid), b = writeBatch(d);
  b.set(doc(d, 'groups', gid), { name: 'Kelas ' + gid, kind, ownerId: uid, code, count: 0, createdAt: serverTimestamp() });
  b.set(doc(d, 'codes', code), { gid });
  return b.commit();
}
async function join(uid, gid, code, nick) {
  const d = db(uid), b = writeBatch(d);
  const a = { uid, code, joinedAt: serverTimestamp() };
  if (nick !== undefined) a.nick = nick;
  b.set(doc(d, 'groups', gid, 'anggota', uid), a);
  b.update(doc(d, 'groups', gid), { count: increment(1) });
  return b.commit();
}
async function leave(uid, gid) {
  const d = db(uid), b = writeBatch(d);
  b.delete(doc(d, 'groups', gid, 'anggota', uid));
  b.update(doc(d, 'groups', gid), { count: increment(-1) });
  return b.commit();
}
const addItem = (uid, gid, id, kind = 'tugas') =>
  setDoc(doc(db(uid), 'groups', gid, 'items', id), { kind, data: { judul: 'x' }, createdAt: serverTimestamp() });
const mark = (uid, gid, item, as = uid) =>
  setDoc(doc(db(uid), 'groups', gid, 'items', item, 'selesai', as), { uid: as, nick: 'Andi', at: serverTimestamp() });

// ---- Skenario lama (grup dengan id = uid pemilik) ----

test('lama: guru membaca, mendaftar, mengganti nama, dan menambah tugas kelasnya', async () => {
  await assertSucceeds(getDoc(doc(db(L), 'groups', L)));
  const r = await assertSucceeds(getDocs(query(collection(db(L), 'groups'), where('ownerId', '==', L))));
  if (r.size !== 1) throw new Error('harus 1 grup');
  await assertSucceeds(updateDoc(doc(db(L), 'groups', L), { name: '7A' }));
  await assertSucceeds(addItem(L, L, 'i2'));
  await assertSucceeds(deleteDoc(doc(db(L), 'groups', L, 'items', 'i2')));
  await assertSucceeds(getDoc(doc(db(L), 'groups', L, 'anggota', S1)));
});

test('lama: membuka groups/{uid sendiri} yang belum ada tetap boleh (klien lama)', async () => {
  await assertSucceeds(getDoc(doc(db(T), 'groups', T)));
});

test('lama: siswa lama membaca tugas, siswa baru bergabung dan keluar', async () => {
  await assertSucceeds(getDocs(collection(db(S1), 'groups', L, 'items')));
  await assertSucceeds(join(S2, L, 'LAMA0001'));
  await assertSucceeds(getDocs(collection(db(S2), 'groups', L, 'items')));
  await assertSucceeds(leave(S2, L));
  await assertFails(getDocs(collection(db(S2), 'groups', L, 'items')));
});

test('lama: siswa lama (tanpa nick) bisa menandai tugas selesai', async () => {
  await assertSucceeds(mark(S1, L, 'i1'));
  await assertSucceeds(getDocs(collection(db(L), 'groups', L, 'items', 'i1', 'selesai')));
});

test('lama: klien lama menghapus grup dulu, lalu membersihkan anggota dan item', async () => {
  const d = db(L), b = writeBatch(d);
  b.delete(doc(d, 'groups', L)); b.delete(doc(d, 'codes', 'LAMA0001'));
  await assertSucceeds(b.commit());
  await assertSucceeds(getDocs(collection(d, 'groups', L, 'anggota')));
  await assertSucceeds(deleteDoc(doc(d, 'groups', L, 'anggota', S1)));
  await assertSucceeds(getDocs(collection(d, 'groups', L, 'items')));
  await assertSucceeds(deleteDoc(doc(d, 'groups', L, 'items', 'i1')));
});

test('lama: klien lama membuat kelas dengan id = uid sendiri', async () => {
  await assertSucceeds(newClass(T, T, 'BARU0001'));
});

test('lama: orang lain tidak bisa membaca atau mengubah grup lama', async () => {
  await assertFails(getDoc(doc(db(X), 'groups', L)));
  await assertFails(getDocs(collection(db(X), 'groups', L, 'items')));
  await assertFails(updateDoc(doc(db(X), 'groups', L), { name: 'bobol' }));
  await assertFails(deleteDoc(doc(db(X), 'groups', L)));
  await assertFails(addItem(X, L, 'i9'));
});

// ---- Beberapa kelas per guru ----

test('guru membuat beberapa kelas dan melihat daftarnya', async () => {
  await assertSucceeds(newClass(T, K1, 'KODE0001'));
  await assertSucceeds(newClass(T, K2, 'KODE0002'));
  const r = await assertSucceeds(getDocs(query(collection(db(T), 'groups'), where('ownerId', '==', T))));
  if (r.size !== 2) throw new Error('harus 2 kelas, dapat ' + r.size);
  await assertSucceeds(addItem(T, K1, 'a'));
  await assertSucceeds(addItem(T, K2, 'b', 'jadwal'));
});

test('orang lain tidak bisa mendaftar kelas guru', async () => {
  await newClass(T, K1, 'KODE0001');
  await assertFails(getDocs(query(collection(db(X), 'groups'), where('ownerId', '==', T))));
  await assertFails(getDocs(collection(db(X), 'groups')));
});

test('id kelas harus uid sendiri atau 20 karakter; tidak bisa memakai uid orang lain', async () => {
  await assertFails(newClass(T, P, 'KODE0003'));
  await assertFails(newClass(T, 'pendek', 'KODE0004'));
});

test('grup keluarga tetap hanya di groups/{uid sendiri}', async () => {
  await assertFails(newClass(P, K1, 'KODE0005', 'keluarga'));
  await assertSucceeds(newClass(P, P, 'KODE0006', 'keluarga'));
});

test('paket habis, tanpa dokumen paket, atau paket salah tidak bisa membuat kelas', async () => {
  await assertFails(newClass(E, K1, 'KODE0007'));
  await assertFails(newClass(X, K1, 'KODE0008'));
  await assertFails(newClass(P, K1, 'KODE0009'));
});

test('masa percobaan membuka kelas sekolah dan grup keluarga', async () => {
  const C = U('coba');
  await setDoc(doc(db(C), 'companies', C), { name: 'Coba', owner: C, created_at: serverTimestamp() });
  await assertSucceeds(newClass(C, K1, 'COBA0001'));
  await assertSucceeds(newClass(C, C, 'COBA0002', 'keluarga'));
  await assertSucceeds(addItem(C, K1, 't1'));
  await assertSucceeds(join(S1, K1, 'COBA0001', 'Andi'));
  await assertSucceeds(join(S2, C, 'COBA0002'));
  // paket berbayar yang sudah habis tidak kembali ke masa percobaan
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'companies', C), { plan: 'starter', until: past }));
  await assertFails(newClass(C, K2, 'COBA0003'));
  await assertFails(join(X, K1, 'COBA0001', 'x'));
});

test('ownerId harus pembuatnya dan kode tidak bisa diarahkan ke kelas orang lain', async () => {
  const d = db(X), b = writeBatch(d);
  b.set(doc(d, 'groups', K1), { name: 'x', kind: 'sekolah', ownerId: T, code: 'KODE0010', count: 0, createdAt: serverTimestamp() });
  b.set(doc(d, 'codes', 'KODE0010'), { gid: K1 });
  await assertFails(b.commit());
  await newClass(T, K1, 'KODE0011');
  await assertFails(setDoc(doc(db(X), 'codes', 'KODE0012'), { gid: K1 }));
  await assertFails(setDoc(doc(db(T), 'codes', 'KODE0013'), { gid: K1 }));
  await assertFails(deleteDoc(doc(db(X), 'codes', 'KODE0011')));
});

test('siswa bergabung ke kelas baru dengan nama panggilan, guru melihat anggotanya', async () => {
  await newClass(T, K1, 'KODE0001');
  await assertSucceeds(join(S1, K1, 'KODE0001', 'Andi'));
  await assertFails(join(S2, K1, 'SALAH001', 'Budi'));
  await assertFails(join(T, K1, 'KODE0001', 'Guru'));
  await assertFails(join(S2, K1, 'KODE0001', 'x'.repeat(61)));
  const r = await assertSucceeds(getDocs(collection(db(T), 'groups', K1, 'anggota')));
  if (r.docs[0].data().nick !== 'Andi') throw new Error('nick');
  await assertFails(getDocs(collection(db(S1), 'groups', K1, 'anggota')));
  await assertSucceeds(getDocs(collection(db(S1), 'groups', K1, 'items')));
  await assertSucceeds(getDocs(query(collectionGroup(db(S1), 'anggota'), where('uid', '==', S1))));
});

test('siswa mengganti nama panggilannya, tidak bisa mengubah field lain', async () => {
  await newClass(T, K1, 'KODE0001');
  await join(S1, K1, 'KODE0001', 'Andi');
  await assertSucceeds(updateDoc(doc(db(S1), 'groups', K1, 'anggota', S1), { nick: 'Andi S' }));
  await assertFails(updateDoc(doc(db(S1), 'groups', K1, 'anggota', S1), { code: 'X' }));
  await assertFails(updateDoc(doc(db(T), 'groups', K1, 'anggota', S1), { nick: 'ganti' }));
  // anggota lama tanpa nick juga bisa menambahkannya
  await assertSucceeds(updateDoc(doc(db(S1), 'groups', L, 'anggota', S1), { nick: 'Andi' }));
});

test('kelas guru yang paketnya habis tidak bisa diikuti dan tidak bisa ditambah tugas', async () => {
  await newClass(T, K1, 'KODE0001');
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'companies', T), { until: past }));
  await assertFails(join(S1, K1, 'KODE0001', 'Andi'));
  await assertFails(addItem(T, K1, 'z'));
});

// ---- Tugas kelas selesai ----

test('siswa menandai tugas selesai; guru melihat siapa saja; siswa lain tidak', async () => {
  await newClass(T, K1, 'KODE0001');
  await join(S1, K1, 'KODE0001', 'Andi');
  await join(S2, K1, 'KODE0001', 'Budi');
  await addItem(T, K1, 'tg');
  await addItem(T, K1, 'jd', 'jadwal');
  await assertSucceeds(mark(S1, K1, 'tg'));
  await assertFails(mark(S1, K1, 'jd'));
  await assertFails(mark(S2, K1, 'tg', S1));
  await assertFails(mark(X, K1, 'tg'));
  await assertFails(mark(T, K1, 'tg'));
  const r = await assertSucceeds(getDocs(collection(db(T), 'groups', K1, 'items', 'tg', 'selesai')));
  if (r.size !== 1 || r.docs[0].data().nick !== 'Andi') throw new Error('guru harus melihat Andi');
  await assertFails(getDocs(collection(db(S2), 'groups', K1, 'items', 'tg', 'selesai')));
  await assertFails(getDoc(doc(db(S2), 'groups', K1, 'items', 'tg', 'selesai', S1)));
  await assertSucceeds(getDoc(doc(db(S1), 'groups', K1, 'items', 'tg', 'selesai', S1)));
  const m = await assertSucceeds(getDocs(query(collectionGroup(db(S1), 'selesai'), where('uid', '==', S1))));
  if (m.size !== 1) throw new Error('collectionGroup selesai');
  await assertFails(getDocs(query(collectionGroup(db(S2), 'selesai'), where('uid', '==', S1))));
  await assertFails(updateDoc(doc(db(S1), 'groups', K1, 'items', 'tg', 'selesai', S1), { nick: 'x' }));
  await assertFails(deleteDoc(doc(db(S2), 'groups', K1, 'items', 'tg', 'selesai', S1)));
  await assertSucceeds(deleteDoc(doc(db(S1), 'groups', K1, 'items', 'tg', 'selesai', S1)));
});

test('siswa yang sudah keluar tidak bisa menandai, tapi bisa menghapus tandanya', async () => {
  await newClass(T, K1, 'KODE0001');
  await join(S1, K1, 'KODE0001', 'Andi');
  await addItem(T, K1, 'tg');
  await mark(S1, K1, 'tg');
  await assertSucceeds(deleteDoc(doc(db(S1), 'groups', K1, 'items', 'tg', 'selesai', S1)));
  await leave(S1, K1);
  await assertFails(mark(S1, K1, 'tg'));
});

// ---- Menutup dan menghapus kelas ----

test('guru menutup kelas, membersihkan isinya, lalu menghapus kelas dan kode', async () => {
  await newClass(T, K1, 'KODE0001');
  await join(S1, K1, 'KODE0001', 'Andi');
  await addItem(T, K1, 'tg');
  await mark(S1, K1, 'tg');
  await assertFails(updateDoc(doc(db(X), 'groups', K1), { closed: true }));
  await assertFails(updateDoc(doc(db(T), 'groups', K1), { closed: false }));
  await assertFails(deleteDoc(doc(db(T), 'groups', K1, 'anggota', S1)));
  await assertSucceeds(updateDoc(doc(db(T), 'groups', K1), { closed: true }));
  await assertFails(join(S2, K1, 'KODE0001', 'Budi'));
  await assertFails(addItem(T, K1, 'baru'));
  await assertSucceeds(deleteDoc(doc(db(T), 'groups', K1, 'items', 'tg', 'selesai', S1)));
  await assertSucceeds(deleteDoc(doc(db(T), 'groups', K1, 'items', 'tg')));
  await assertSucceeds(deleteDoc(doc(db(T), 'groups', K1, 'anggota', S1)));
  const d = db(T), b = writeBatch(d);
  b.delete(doc(d, 'groups', K1)); b.delete(doc(d, 'codes', 'KODE0001'));
  await assertSucceeds(b.commit());
});

test('guru tidak bisa mengubah count atau kode kelasnya', async () => {
  await newClass(T, K1, 'KODE0001');
  await assertFails(updateDoc(doc(db(T), 'groups', K1), { count: 5 }));
  await assertFails(updateDoc(doc(db(T), 'groups', K1), { code: 'LAIN0001' }));
  await assertFails(updateDoc(doc(db(T), 'groups', K1), { ownerId: X }));
});

// ---- Grup keluarga (skenario lama) ----

test('keluarga: anak bergabung (maks 3), orang tua membaca pantau, guru tidak', async () => {
  await newClass(P, P, 'FAM00001', 'keluarga');
  const kids = [S1, S2, X];
  for (const k of kids) await assertSucceeds(join(k, P, 'FAM00001'));
  await assertFails(join(U('anak4'), P, 'FAM00001'));
  await setDoc(doc(db(S1), 'pantau', S1), { nick: 'Andi', jadwal: [], kegiatan: [], rencana: [], sesi: {}, mnt: {} });
  await assertSucceeds(getDoc(doc(db(P), 'pantau', S1)));
  await assertSucceeds(getDoc(doc(db(S1), 'companies', P)));
  await newClass(T, K1, 'KODE0001');
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'groups', K1, 'anggota', S1), { uid: S1, code: 'KODE0001', joinedAt: past }));
  await assertFails(getDoc(doc(db(T), 'pantau', S1)));
  await assertFails(getDoc(doc(db(L), 'pantau', S1)));
});

// ---- Pola standar Zui Admin tidak berubah ----

test('standar: pengguna tidak bisa mengisi paket sendiri; permintaan bayar tetap jalan', async () => {
  const d = db(X);
  await assertFails(setDoc(doc(d, 'companies', X), { name: 'x', owner: X, created_at: serverTimestamp(), plan: 'business' }));
  await assertSucceeds(setDoc(doc(d, 'companies', X), { name: 'x', owner: X, created_at: serverTimestamp() }));
  await assertFails(updateDoc(doc(d, 'companies', X), { plan: 'business' }));
  await assertSucceeds(setDoc(doc(d, 'subreqs', 'r1'), { cid: X, coName: 'x', plan: 'starter', months: 1, amount: 19000, cur: 'IDR', ref: 'REF1', by: X, byEmail: 'x@x.id', status: 'wait', at: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(d, 'subreqs', 'r3'), { cid: X, coName: 'x', plan: 'business', months: 6, amount: 750000, cur: 'IDR', ref: 'REF3', by: X, byEmail: 'x@x.id', status: 'wait', at: serverTimestamp() }));
  await assertFails(setDoc(doc(d, 'subreqs', 'r4'), { cid: X, coName: 'x', plan: 'starter', months: 1, amount: 1, cur: 'IDR', ref: 'REF1', by: X, byEmail: 'x@x.id', status: 'active', at: serverTimestamp() }));
  await assertFails(setDoc(doc(d, 'subreqs', 'r2'), { cid: X, coName: 'x', plan: 'gratis', months: 1, amount: 1, cur: 'IDR', ref: 'REF1', by: X, byEmail: 'x@x.id', status: 'wait', at: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(d, 'users', X), { data: { n: 'x' }, updatedAt: serverTimestamp() }));
  await assertFails(getDoc(doc(db(T), 'users', X)));
});

// ---- Pendaftaran dengan peran, sekolah, guru, pengajar, dan nilai ----

const SK = U('sekolah'), G1 = U('guruA'), G2 = U('guruB'), M1 = U('muridA'), M2 = U('muridB');
const KLS = 'KELAS7Aaaaaaaaaaaaaa';
const prof = (uid, peran, extra = {}) => setDoc(doc(db(uid), 'profil', uid),
  { peran, nama: 'Nama ' + peran, hp: '081234567890', alamat: 'Jl. Merdeka 1, Bandung', at: serverTimestamp(), ...extra });
async function sekolah(uid = SK, code = 'GURU0001') {
  const d = db(uid), b = writeBatch(d);
  b.set(doc(d, 'schools', uid), { name: 'SMPN 5 Bandung', jenjang: 'SMP / MTs', alamat: 'Jl. Belitung 8', ownerId: uid, codeGuru: code, createdAt: serverTimestamp() });
  b.set(doc(d, 'kodeguru', code), { sid: uid });
  return b.commit();
}
const joinGuru = (uid, sid = SK, code = 'GURU0001') =>
  setDoc(doc(db(uid), 'schools', sid, 'guru', uid), { uid, nama: 'Guru ' + uid.slice(0, 5), code, joinedAt: serverTimestamp() });
async function kelasSekolah(gid = KLS, code = 'K7A00001') {
  const d = db(SK), b = writeBatch(d);
  b.set(doc(d, 'groups', gid), { name: '7A', kind: 'sekolah', ownerId: SK, code, count: 0, createdAt: serverTimestamp(), school: SK });
  b.set(doc(d, 'codes', code), { gid });
  return b.commit();
}
const ajar = (uid, mapel, gid = KLS) => setDoc(doc(db(SK), 'groups', gid, 'pengajar', uid), { uid, nama: 'Guru', mapel, at: serverTimestamp() });
const tugasGuru = (uid, id, mapel, gid = KLS) => setDoc(doc(db(uid), 'groups', gid, 'items', id),
  { kind: 'tugas', data: { judul: 'Latihan', tgl: '2026-11-01', guru: 'Bu Rina' }, createdAt: serverTimestamp(), by: uid, mapel });
const nilai = (uid, item, murid, n, gid = KLS) => setDoc(doc(db(uid), 'groups', gid, 'items', item, 'nilai', murid),
  { uid: murid, nilai: n, by: uid, at: serverTimestamp() });

async function siapSekolah() {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'companies', SK), { name: 'SMPN 5', owner: SK, created_at: Timestamp.now() }));
  await prof(SK, 'sekolah', { instansi: 'SMPN 5 Bandung' });
  await sekolah();
  for (const g of [G1, G2]) { await prof(g, 'guru', { sekolah: 'SMPN 5 Bandung', mapel: 'Matematika' }); await joinGuru(g); }
  await kelasSekolah();
  await ajar(G1, ['Matematika']);
  await ajar(G2, ['IPA']);
  for (const [m, n] of [[M1, 'Andi'], [M2, 'Budi']]) { await prof(m, 'murid', { jenjang: 'SMP', kelas: 'Kelas 7', sekolah: 'SMPN 5 Bandung' }); await join(m, KLS, 'K7A00001', n); }
}

test('profil: wajib lengkap, peran tidak bisa diganti, hanya pemilik yang membaca', async () => {
  await assertSucceeds(prof(M1, 'murid', { jenjang: 'SMA/SMK/MA', kelas: 'Kelas 11', jurusan: 'IPA', sekolah: 'SMAN 1' }));
  await assertFails(prof(M2, 'admin'));
  await assertFails(setDoc(doc(db(M2), 'profil', M2), { peran: 'murid', nama: 'Budi', alamat: 'x', at: serverTimestamp() }));
  await assertFails(prof(M2, 'murid', { lain: 'x' }));
  await assertFails(prof(M1, 'guru'));
  await assertSucceeds(prof(M1, 'murid', { kelas: 'Kelas 12' }));
  await assertFails(getDoc(doc(db(T), 'profil', M1)));
  await assertFails(prof(M2, 'murid', {}).then(() => setDoc(doc(db(X), 'profil', M2), { peran: 'murid', nama: 'x', hp: '081234567890', alamat: 'x', at: serverTimestamp() })));
});

test('sekolah: hanya akun berperan sekolah yang membuat sekolah dan kode guru', async () => {
  await prof(M1, 'murid');
  await assertFails(sekolah(M1, 'GURU0009'));
  await prof(SK, 'sekolah');
  await assertSucceeds(sekolah());
  await assertFails(setDoc(doc(db(X), 'kodeguru', 'GURU0002'), { sid: SK }));
  await assertSucceeds(getDoc(doc(db(X), 'kodeguru', 'GURU0001')));
  await assertFails(getDocs(collection(db(X), 'kodeguru')));
  await assertFails(getDoc(doc(db(X), 'schools', SK)));
});

test('guru bergabung ke sekolah dengan kode guru', async () => {
  await prof(SK, 'sekolah'); await sekolah();
  await prof(G1, 'guru'); await prof(M1, 'murid');
  await assertFails(joinGuru(G1, SK, 'SALAH001'));
  await assertFails(joinGuru(M1));
  await assertSucceeds(joinGuru(G1));
  await assertSucceeds(getDoc(doc(db(G1), 'schools', SK)));
  const r = await assertSucceeds(getDocs(query(collectionGroup(db(G1), 'guru'), where('uid', '==', G1))));
  if (r.size !== 1) throw new Error('collectionGroup guru');
  await assertSucceeds(getDocs(collection(db(SK), 'schools', SK, 'guru')));
  await assertFails(getDocs(collection(db(G1), 'schools', SK, 'guru')));
  await assertSucceeds(deleteDoc(doc(db(SK), 'schools', SK, 'guru', G1)));
});

test('kelas milik sekolah; field school hanya untuk sekolahnya sendiri', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'companies', SK), { name: 'S', owner: SK, created_at: Timestamp.now() }));
  await prof(SK, 'sekolah');
  await assertFails(kelasSekolah());
  await sekolah();
  await assertSucceeds(kelasSekolah());
  const d = db(T), b = writeBatch(d);
  b.set(doc(d, 'groups', K2), { name: 'x', kind: 'sekolah', ownerId: T, code: 'KODE0099', count: 0, createdAt: serverTimestamp(), school: SK });
  b.set(doc(d, 'codes', 'KODE0099'), { gid: K2 });
  await assertFails(b.commit());
});

test('sekolah menugaskan guru dan mapel; guru tidak bisa menugaskan dirinya', async () => {
  await siapSekolah();
  await assertFails(setDoc(doc(db(G1), 'groups', KLS, 'pengajar', G1), { uid: G1, nama: 'x', mapel: ['IPS'], at: serverTimestamp() }));
  await prof(X, 'guru');
  await assertFails(ajar(X, ['IPS']));
  await assertFails(ajar(G1, []));
  await assertSucceeds(ajar(G1, ['Matematika', 'Informatika']));
  const r = await assertSucceeds(getDocs(query(collectionGroup(db(G1), 'pengajar'), where('uid', '==', G1))));
  if (r.size !== 1) throw new Error('collectionGroup pengajar');
  await assertSucceeds(getDocs(collection(db(M1), 'groups', KLS, 'pengajar')));
});

test('guru pengajar membaca kelas, siswa, dan memberi tugas untuk mapelnya saja', async () => {
  await siapSekolah();
  await assertSucceeds(getDoc(doc(db(G1), 'groups', KLS)));
  await assertSucceeds(getDocs(collection(db(G1), 'groups', KLS, 'anggota')));
  await assertSucceeds(tugasGuru(G1, 'mtk1', 'Matematika'));
  await assertFails(tugasGuru(G1, 'ipa1', 'IPA'));
  await assertFails(tugasGuru(X, 'x1', 'Matematika'));
  await assertFails(setDoc(doc(db(G1), 'groups', KLS, 'items', 'mtk2'), { kind: 'tugas', data: {}, createdAt: serverTimestamp(), by: G2, mapel: 'Matematika' }));
  await assertSucceeds(getDocs(collection(db(M1), 'groups', KLS, 'items')));
  await assertFails(deleteDoc(doc(db(G2), 'groups', KLS, 'items', 'mtk1')));
  await assertSucceeds(deleteDoc(doc(db(G1), 'groups', KLS, 'items', 'mtk1')));
});

test('guru melihat siapa yang selesai dan memberi nilai; siswa hanya melihat nilainya', async () => {
  await siapSekolah();
  await tugasGuru(G1, 'mtk1', 'Matematika');
  await tugasGuru(G2, 'ipa1', 'IPA');
  await assertSucceeds(mark(M1, KLS, 'mtk1'));
  await assertSucceeds(getDocs(collection(db(G1), 'groups', KLS, 'items', 'mtk1', 'selesai')));
  await assertSucceeds(nilai(G1, 'mtk1', M1, 88));
  await assertSucceeds(nilai(G1, 'mtk1', M1, 90));
  await assertFails(nilai(G1, 'mtk1', M1, 101));
  await assertFails(nilai(G1, 'mtk1', X, 80));
  await assertFails(nilai(G2, 'mtk1', M2, 80));
  await assertFails(nilai(M1, 'mtk1', M1, 100));
  await assertSucceeds(getDoc(doc(db(M1), 'groups', KLS, 'items', 'mtk1', 'nilai', M1)));
  await assertFails(getDoc(doc(db(M2), 'groups', KLS, 'items', 'mtk1', 'nilai', M1)));
  await assertFails(getDocs(collection(db(G2), 'groups', KLS, 'items', 'mtk1', 'nilai')));
  await assertSucceeds(getDocs(collection(db(SK), 'groups', KLS, 'items', 'mtk1', 'nilai')));
  const r = await assertSucceeds(getDocs(query(collectionGroup(db(M1), 'nilai'), where('uid', '==', M1))));
  if (r.size !== 1 || r.docs[0].data().nilai !== 90) throw new Error('collectionGroup nilai');
  await assertFails(getDocs(query(collectionGroup(db(M2), 'nilai'), where('uid', '==', M1))));
});

test('paket sekolah habis: guru tidak bisa memberi tugas', async () => {
  await siapSekolah();
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'companies', SK), { plan: 'business', until: past }));
  await assertFails(tugasGuru(G1, 'mtk9', 'Matematika'));
});

test('sekolah menghapus kelas beserta pengajar, tugas, nilai, dan anggota', async () => {
  await siapSekolah();
  await tugasGuru(G1, 'mtk1', 'Matematika');
  await mark(M1, KLS, 'mtk1');
  await nilai(G1, 'mtk1', M1, 80);
  const d = db(SK);
  await assertSucceeds(updateDoc(doc(d, 'groups', KLS), { closed: true }));
  await assertSucceeds(deleteDoc(doc(d, 'groups', KLS, 'items', 'mtk1', 'nilai', M1)));
  await assertSucceeds(deleteDoc(doc(d, 'groups', KLS, 'items', 'mtk1', 'selesai', M1)));
  await assertSucceeds(deleteDoc(doc(d, 'groups', KLS, 'items', 'mtk1')));
  for (const g of [G1, G2]) await assertSucceeds(deleteDoc(doc(d, 'groups', KLS, 'pengajar', g)));
  for (const m of [M1, M2]) await assertSucceeds(deleteDoc(doc(d, 'groups', KLS, 'anggota', m)));
  const b = writeBatch(d); b.delete(doc(d, 'groups', KLS)); b.delete(doc(d, 'codes', 'K7A00001'));
  await assertSucceeds(b.commit());
});

// ---- Tahap 3: pengumuman, program, pesan sekolah dan guru ----

const info = (uid, id, extra = {}) => setDoc(doc(db(uid), 'schools', SK, 'info', id), { judul: 'PTS 3 November', isi: 'Siswa hadir 06.45.', dari: 'SMPN 5 Bandung', at: serverTimestamp(), ...extra });
const prog = (uid, id, extra = {}) => setDoc(doc(db(uid), 'schools', SK, 'program', id), { nama: 'Literasi 15 menit', pj: 'Pak Dodi', status: 'Berjalan', progres: 60, catatan: '', at: serverTimestamp(), ...extra });
const msg = (uid, guid, dari, t = 'Halo') => setDoc(doc(db(uid), 'schools', SK, 'pesan', guid, 'msgs', 'm' + Math.random().toString(36).slice(2)), { dari, t, uid, at: serverTimestamp() });
const head = (uid, guid, dari) => setDoc(doc(db(uid), 'schools', SK, 'pesan', guid), { last: 'Halo', dari, at: serverTimestamp() });

test('pengumuman: hanya sekolah yang menulis, semua pengguna masuk bisa membaca', async () => {
  await siapSekolah();
  await assertSucceeds(info(SK, 'a1'));
  await assertFails(info(G1, 'a2'));
  await assertFails(info(SK, 'a3', { judul: '' }));
  await assertFails(info(SK, 'a4', { lain: 1 }));
  await assertSucceeds(getDocs(collection(db(M1), 'schools', SK, 'info')));
  await assertSucceeds(getDocs(collection(db(X), 'schools', SK, 'info')));
  await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'schools', SK, 'info')));
  await assertFails(deleteDoc(doc(db(G1), 'schools', SK, 'info', 'a1')));
  await assertSucceeds(deleteDoc(doc(db(SK), 'schools', SK, 'info', 'a1')));
});

test('program: ditulis sekolah, dibaca sekolah dan gurunya saja', async () => {
  await siapSekolah();
  await assertSucceeds(prog(SK, 'p1'));
  await assertFails(prog(SK, 'p2', { status: 'Batal' }));
  await assertFails(prog(SK, 'p3', { progres: 120 }));
  await assertFails(prog(G1, 'p4'));
  await assertSucceeds(getDocs(collection(db(G1), 'schools', SK, 'program')));
  await assertFails(getDocs(collection(db(M1), 'schools', SK, 'program')));
  await assertSucceeds(prog(SK, 'p1', { status: 'Selesai', progres: 100 }));
});

test('pesan pribadi sekolah dan guru: guru lain dan murid tidak bisa membaca', async () => {
  await siapSekolah();
  await assertSucceeds(msg(SK, G1, 'sekolah'));
  await assertSucceeds(head(SK, G1, 'sekolah'));
  await assertSucceeds(msg(G1, G1, 'guru'));
  await assertSucceeds(head(G1, G1, 'guru'));
  await assertFails(msg(G1, G1, 'sekolah'));
  await assertFails(msg(G2, G1, 'guru'));
  await assertSucceeds(getDocs(collection(db(G1), 'schools', SK, 'pesan', G1, 'msgs')));
  await assertSucceeds(getDocs(collection(db(SK), 'schools', SK, 'pesan', G1, 'msgs')));
  await assertFails(getDocs(collection(db(G2), 'schools', SK, 'pesan', G1, 'msgs')));
  await assertFails(getDocs(collection(db(M1), 'schools', SK, 'pesan', G1, 'msgs')));
  await deleteDoc(doc(db(SK), 'schools', SK, 'guru', G1));
  await assertFails(getDocs(collection(db(G1), 'schools', SK, 'pesan', G1, 'msgs')));
});

test('pantau boleh menyimpan daftar sekolah anak untuk pengumuman orang tua', async () => {
  const base = { nick: 'Andi', jadwal: [], kegiatan: [], rencana: [], sesi: {}, mnt: {} };
  await assertSucceeds(setDoc(doc(db(M1), 'pantau', M1), { ...base, sek: [SK] }));
  await assertFails(setDoc(doc(db(M1), 'pantau', M1), { ...base, sek: 'x' }));
});
