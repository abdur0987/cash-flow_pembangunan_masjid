# Cash Flow Pembangunan Masjid

Web sederhana untuk monitoring cash flow Pembangunan Masjid Babul Jannah Kanwil Kementerian Agama Provinsi Lampung.

## Fitur

- Buku kas umum, kas bank, dan kas tunai
- Input transaksi debet/kredit
- Upload foto atau dokumen nota pembelian
- Grafik pemasukan, pengeluaran, dan saldo bulanan
- Download laporan bulanan Excel
- Database libSQL lokal untuk development dan Turso untuk online

## Menjalankan Lokal

```bash
npm install
npm run dev
```

Saat `TURSO_DATABASE_URL` belum diisi, aplikasi otomatis memakai database lokal:

```text
data/cash-flow.sqlite
```

## Menggunakan Turso Online

Buat file `.env.local` dari `.env.example`, lalu isi:

```env
TURSO_DATABASE_URL=libsql://nama-database-org.turso.io
TURSO_AUTH_TOKEN=token-turso
```

Setelah env diisi, restart server:

```bash
npm run dev
```

Tabel database akan dibuat otomatis saat endpoint `/api/cash-flow` pertama kali diakses.
