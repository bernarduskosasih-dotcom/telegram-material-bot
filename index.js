const express = require("express");
const {
  showMainMenu,
  startMaterialReport,
  askQuantity,
  askOrderNote,
  confirmAndSave,
  showTodayStatus,
  showHistory,
  getSession,
  clearSession,
} = require("./lib/material");
const { sendMessage, answerCallback } = require("./lib/telegram");

const app = express();
app.use(express.json());

// ============================================================
// Health check (Render butuh ini)
// ============================================================
app.get("/", (req, res) => {
  res.send("Bot is running!");
});

// ============================================================
// Whitelist user (opsional)
// ============================================================
function isAllowed(userId) {
  const allowed = process.env.ALLOWED_USER_IDS;
  if (!allowed) return true;
  return allowed.split(",").includes(String(userId));
}

// ============================================================
// Webhook endpoint - menerima update dari Telegram
// ============================================================
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    // Handle callback query (tombol ditekan)
    if (body.callback_query) {
      await handleCallback(body.callback_query);
    }
    // Handle pesan teks
    else if (body.message && body.message.text) {
      await handleMessage(body.message);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(200); // Tetap 200 agar Telegram tidak retry
  }
});

// ============================================================
// Handle pesan teks
// ============================================================
async function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const userName =
    message.from.first_name +
    (message.from.last_name ? " " + message.from.last_name : "");
  const text = message.text.trim();

  if (!isAllowed(userId)) {
    await sendMessage(chatId, "⛔ Maaf, kamu belum terdaftar. Hubungi admin.");
    return;
  }

  // Commands
  if (text === "/start") return showMainMenu(chatId, userName);
  if (text === "/laporan") return startMaterialReport(chatId);
  if (text === "/status") return showTodayStatus(chatId);
  if (text === "/riwayat") return showHistory(chatId);
  if (text === "/batal") {
    await clearSession(chatId);
    return sendMessage(chatId, "❌ Dibatalkan. Ketik /start untuk menu utama.");
  }

  // Cek session aktif
  const session = await getSession(chatId);

  if (session) {
    if (session.step === "input_quantity") {
      const quantity = parseFloat(text.replace(",", "."));
      if (isNaN(quantity) || quantity <= 0) {
        return sendMessage(chatId, "❌ Angka tidak valid. Contoh: <code>12.5</code>");
      }
      return askOrderNote(chatId, quantity);
    }

    if (session.step === "input_order") {
      return confirmAndSave(chatId, text, userId, userName);
    }
  }

  await sendMessage(chatId, "🤔 Pesan tidak dikenali. Ketik /start untuk menu.");
}

// ============================================================
// Handle callback (tombol inline keyboard)
// ============================================================
async function handleCallback(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const userName =
    callbackQuery.from.first_name +
    (callbackQuery.from.last_name ? " " + callbackQuery.from.last_name : "");
  const data = callbackQuery.data;

  await answerCallback(callbackQuery.id);

  if (!isAllowed(userId)) {
    return sendMessage(chatId, "⛔ Akses ditolak.");
  }

  if (data === "menu_utama") return showMainMenu(chatId, userName);
  if (data === "menu_laporan") return startMaterialReport(chatId);
  if (data === "menu_status") return showTodayStatus(chatId);
  if (data === "menu_riwayat") return showHistory(chatId);
  if (data === "menu_bantuan") {
    return sendMessage(
      chatId,
      `❓ <b>Bantuan</b>\n\n` +
        `<b>Cara pakai:</b>\n` +
        `1. Pilih "Laporan Pemakaian" dari menu\n` +
        `2. Pilih bahan yang dipakai\n` +
        `3. Ketik jumlah pemakaian\n` +
        `4. Ketik nomor order / keterangan\n` +
        `5. Data otomatis tersimpan!\n\n` +
        `<b>Command:</b>\n` +
        `/start — Menu utama\n` +
        `/laporan — Input pemakaian baru\n` +
        `/status — Lihat pemakaian hari ini\n` +
        `/riwayat — Lihat 7 hari terakhir\n` +
        `/batal — Batalkan input`
    );
  }
  if (data === "menu_batal") {
    await clearSession(chatId);
    await sendMessage(chatId, "❌ Dibatalkan.");
    return showMainMenu(chatId, userName);
  }
  if (data.startsWith("bahan_")) {
    return askQuantity(chatId, data.replace("bahan_", ""));
  }
}

// ============================================================
// Start server
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
});
