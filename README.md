# Bot Telegram — Laporan Pemakaian Bahan APT (Render)

## Setup di Render

1. Push repo ini ke GitHub
2. Di Render, pilih **Web Services** → hubungkan repo GitHub
3. Setting:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Tambah Environment Variables:
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `ALLOWED_USER_IDS` (opsional)
5. Deploy, lalu set webhook Telegram ke:
   `https://nama-app.onrender.com/webhook`
