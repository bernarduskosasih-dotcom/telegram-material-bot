const express = require("express");
const {
  showMainMenu, startReport, showMaterials, askQuantity,
  askDate, askProject, confirmAndSave, showTodayStatus,
  showHistory, showStockStatus, showProjectMenu, startAddProject,
  saveProject, showToggleProjects, toggleProject,
  getSession, clearSession, saveSession, isValidDate,
} = require("./lib/material");
const { sendMessage, answerCallback } = require("./lib/telegram");

const app = express();
app.use(express.json());

const MASTER_CHAT_ID = process.env.MASTER_CHAT_ID;

app.get("/", (req, res) => res.send("Bot APT Material v2 running!"));

// ============================================================
// Whitelist (opsional)
// ============================================================
function isAllowed(userId) {
  const allowed = process.env.ALLOWED_USER_IDS;
  if (!allowed) return true;
  return allowed.split(",").includes(String(userId));
}

function isMaster(chatId) {
  return String(chatId) === String(MASTER_CHAT_ID);
}

// ============================================================
// Webhook
// ============================================================
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;
    if (body.callback_query) await handleCallback(body.callback_query);
    else if (body.message && body.message.text) await handleMessage(body.message);
    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(200);
  }
});

// ============================================================
// Handle pesan teks
// ============================================================
async function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const userName = message.from.first_name + (message.from.last_name ? " " + message.from.last_name : "");
  const text = message.text.trim();

  if (!isAllowed(userId)) {
    await sendMessage(chatId, "⛔ Belum terdaftar. Hubungi admin.");
    return;
  }

  // Commands
  if (text === "/start") return showMainMenu(chatId, userName);
  if (text === "/laporan") return startReport(chatId);
  if (text === "/status") return showTodayStatus(chatId);
  if (text === "/riwayat") return showHistory(chatId);
  if (text === "/stok") return showStockStatus(chatId);
  if (text === "/batal") {
    await clearSession(chatId);
    return sendMessage(chatId, "❌ Dibatalkan. Ketik /start untuk menu.");
  }

  // Cek session
  const session = await getSession(chatId);

  if (session) {
    // Input jumlah
    if (session.step === "input_quantity") {
      const quantity = parseFloat(text.replace(",", "."));
      if (isNaN(quantity) || quantity <= 0) {
        return sendMessage(chatId, "❌ Angka tidak valid. Contoh: <code>12.5</code>");
      }
      return askDate(chatId, quantity);
    }

    // Input tanggal custom
    if (session.step === "input_date_custom") {
      if (!isValidDate(text)) {
        return sendMessage(chatId, "❌ Format salah. Ketik: <code>2026-08-13</code> (YYYY-MM-DD)");
      }
      return askProject(chatId, text);
    }

    // Tambah project (master)
    if (session.step === "add_project") {
      return saveProject(chatId, text);
    }
  }

  await sendMessage(chatId, "🤔 Ketik /start untuk menu.");
}

// ============================================================
// Handle callback
// ============================================================
async function handleCallback(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const userName = callbackQuery.from.first_name + (callbackQuery.from.last_name ? " " + callbackQuery.from.last_name : "");
  const data = callbackQuery.data;

  await answerCallback(callbackQuery.id);

  if (!isAllowed(userId)) return sendMessage(chatId, "⛔ Akses ditolak.");

  // Menu utama
  if (data === "menu_utama") return showMainMenu(chatId, userName);
  if (data === "menu_laporan") return startReport(chatId);
  if (data === "menu_status") return showTodayStatus(chatId);
  if (data === "menu_riwayat") return showHistory(chatId);
  if (data === "menu_stok") return showStockStatus(chatId);

  if (data === "menu_bantuan") {
    return sendMessage(chatId,
      `❓ <b>Bantuan</b>\n\n` +
      `<b>Cara pakai:</b>\n` +
      `1. Pilih "Lapor Pemakaian"\n` +
      `2. Pilih supplier (Justus/Warna Alpha/Lain-lain)\n` +
      `3. Pilih bahan\n` +
      `4. Ketik jumlah pemakaian\n` +
      `5. Pilih tanggal\n` +
      `6. Pilih project\n` +
      `7. Data tersimpan otomatis!\n\n` +
      `<b>Command:</b>\n` +
      `/start — Menu utama\n` +
      `/laporan — Input pemakaian\n` +
      `/status — Status hari ini\n` +
      `/riwayat — 7 hari terakhir\n` +
      `/stok — Cek stok semua bahan\n` +
      `/batal — Batalkan input`
    );
  }

  if (data === "menu_batal") {
    await clearSession(chatId);
    await sendMessage(chatId, "❌ Dibatalkan.");
    return showMainMenu(chatId, userName);
  }

  // Pilih supplier
  if (data.startsWith("supplier_")) {
    const supplierId = data.replace("supplier_", "");
    return showMaterials(chatId, supplierId);
  }

  // Navigasi halaman bahan
  if (data.startsWith("page_")) {
    const parts = data.replace("page_", "").split("_");
    const page = parseInt(parts.pop());
    const supplierId = parts.join("_");
    return showMaterials(chatId, supplierId, page);
  }

  // Pilih bahan
  if (data.startsWith("mat_")) {
    const materialId = data.replace("mat_", "");
    return askQuantity(chatId, materialId);
  }

  // Pilih tanggal
  if (data.startsWith("date_")) {
    const dateVal = data.replace("date_", "");
    if (dateVal === "custom") {
      const session = await getSession(chatId);
      if (session) {
        session.step = "input_date_custom";
        await saveSession(chatId, session);
      }
      return sendMessage(chatId, "📅 Ketik tanggal (format: <code>2026-08-13</code>):");
    }
    return askProject(chatId, dateVal);
  }

  // Pilih project
  if (data.startsWith("proj_")) {
    const val = data.replace("proj_", "");
    if (val === "add") return startAddProject(chatId);
    if (val === "toggle") return showToggleProjects(chatId);
    // projectId is a number
    return confirmAndSave(chatId, parseInt(val), userId, userName);
  }

  // Toggle project
  if (data.startsWith("toggle_")) {
    if (!isMaster(chatId)) return sendMessage(chatId, "⛔ Hanya master yang bisa.");
    const projectId = parseInt(data.replace("toggle_", ""));
    return toggleProject(chatId, projectId);
  }

  // Project menu (master only)
  if (data === "menu_project") {
    if (!isMaster(chatId)) return sendMessage(chatId, "⛔ Hanya master.");
    return showProjectMenu(chatId);
  }
}

// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot v2 running on port ${PORT}`));
