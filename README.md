# Restaurant API

## Jalankan dengan Docker

1. Bila belum ada, buat berkas environment. Jika `.env` sudah ada, jangan timpa—tambahkan nilai PostgreSQL dari `.env.example` ke berkas tersebut. Isi seluruh nilainya, terutama password database dan secret JWT:

   ```sh
   cp -n .env.example .env
   ```

2. Mulai API dan PostgreSQL:

   ```sh
   docker compose up -d --build
   ```

   Saat API mulai, `prisma migrate deploy` otomatis menerapkan semua migrasi yang belum ada. API tersedia pada `http://localhost:3001`.

3. Periksa status dan log bila diperlukan:

   ```sh
   docker compose ps
   docker compose logs -f api
   ```

## Deploy ke VPS

Install Docker Engine beserta Docker Compose plugin di VPS, salin repository dan `.env` yang berisi secret produksi, lalu jalankan perintah yang sama:

```sh
docker compose up -d --build
```

Jangan membuka port PostgreSQL ke internet bila tidak diperlukan. Untuk itu, hapus bagian `ports` pada service `db` di `compose.yaml`; API tetap dapat mengakses database melalui jaringan Docker internal.

Data PostgreSQL disimpan dalam named volume `postgres_data`, sehingga tidak hilang ketika container dibuat ulang. Untuk pembaruan aplikasi:

```sh
git pull
docker compose up -d --build
```

Untuk backup database:

```sh
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```
 
 