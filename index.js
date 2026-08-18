const express = require("express");
const {
  showMainMenu, startReport, showMaterials, askQuantity,
  askDate, askProject, confirmAndSave, showTodayStatus,
  showHistory, showStockStatus, showProjectMenu, startAddProject,
  saveProject, showToggleProjects, toggleProject,
  startRestock, askRestockQuantity, confirmRestock,
  showRecentEntries, deleteEntry,
  showProjectReport, showProjectDetail,
  getSession, clearSession, saveSession, isValidDate, isMaster,
} = require("./lib/material");
const { sendMessage, answerCallback } = require("./lib/telegram");

const app = express();
app.use(express.json());

app.get("/", (req, res) => res.send("Bot APT Material v2.1 running!"));

function isAllowed(userId) {
  const allowed = process.env.ALLOWED_USER_IDS;
  if (!allowed) return true;
  return allowed.split(",").includes(String(userId));
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

  const session = await getSession(chatId);

  if (session) {
    // Input jumlah pemakaian
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

    // Input jumlah restock
    if (session.step === "input_restock_qty") {
      const quantity = parseFloat(text.replace(",", "."));
      if (isNaN(quantity) || quantity <= 0) {
        return sendMessage(chatId, "❌ Angka tidak valid. Contoh: <code>225</code>");
      }
      return confirmRestock(chatId, quantity, userName);
    }

    // Tambah project
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
      `2. Pilih supplier\n` +
      `3. Pilih bahan\n` +
      `4. Ketik jumlah\n` +
      `5. Pilih tanggal\n` +
      `6. Pilih project\n` +
      `7. Selesai!\n\n` +
      `/start — Menu | /laporan — Input\n` +
      `/status — Hari ini | /stok — Cek stok\n` +
      `/riwayat — 7 hari | /batal — Batalkan`
    );
  }

  if (data === "menu_batal") {
    await clearSession(chatId);
    await sendMessage(chatId, "❌ Dibatalkan.");
    return showMainMenu(chatId, userName);
  }

  // === FLOW PEMAKAIAN ===
  if (data.startsWith("supplier_")) {
    return showMaterials(chatId, data.replace("supplier_", ""), 0, "usage");
  }
  if (data.startsWith("page_")) {
    const parts = data.replace("page_", "").split("_");
    const page = parseInt(parts.pop());
    const supplierId = parts.join("_");
    return showMaterials(chatId, supplierId, page, "usage");
  }
  if (data.startsWith("mat_")) {
    return askQuantity(chatId, data.replace("mat_", ""));
  }
  if (data.startsWith("date_")) {
    const dateVal = data.replace("date_", "");
    if (dateVal === "custom") {
      const session = await getSession(chatId);
      if (session) { session.step = "input_date_custom"; await saveSession(chatId, session); }
      return sendMessage(chatId, "📅 Ketik tanggal (format: <code>2026-08-13</code>):");
    }
    return askProject(chatId, dateVal);
  }
  if (data.startsWith("proj_") && !data.startsWith("proj_add") && !data.startsWith("proj_toggle")) {
    const val = data.replace("proj_", "");
    return confirmAndSave(chatId, parseInt(val), userId, userName);
  }

  // === FLOW RESTOCK (Master) ===
if (data === "menu_restock") {
    return startRestock(chatId);
  }
  if (data.startsWith("rsupplier_")) {
    return showMaterials(chatId, data.replace("rsupplier_", ""), 0, "restock");
  }
  if (data.startsWith("rpage_")) {
    const parts = data.replace("rpage_", "").split("_");
    const page = parseInt(parts.pop());
    const supplierId = parts.join("_");
    return showMaterials(chatId, supplierId, page, "restock");
  }
  if (data.startsWith("rmat_")) {
    return askRestockQuantity(chatId, data.replace("rmat_", ""));
  }

  // === HAPUS DATA (Master) ===
  if (data === "menu_delete") {
    if (!isMaster(chatId)) return sendMessage(chatId, "⛔ Hanya master.");
    return showRecentEntries(chatId);
  }
  if (data.startsWith("del_")) {
    if (!isMaster(chatId)) return sendMessage(chatId, "⛔ Hanya master.");
    return deleteEntry(chatId, parseInt(data.replace("del_", "")));
  }

  // === REPORT PER PROJECT (Master) ===
  if (data === "menu_report_project") {
    if (!isMaster(chatId)) return sendMessage(chatId, "⛔ Hanya master.");
    return showProjectReport(chatId);
  }
  if (data.startsWith("rproj_")) {
    if (!isMaster(chatId)) return sendMessage(chatId, "⛔ Hanya master.");
    return showProjectDetail(chatId, data.replace("rproj_", ""));
  }

  // === KELOLA PROJECT (Master) ===
  if (data === "menu_project") {
    if (!isMaster(chatId)) return sendMessage(chatId, "⛔ Hanya master.");
    return showProjectMenu(chatId);
  }
  if (data === "proj_add") return startAddProject(chatId);
  if (data === "proj_toggle") return showToggleProjects(chatId);
  if (data.startsWith("toggle_")) {
    if (!isMaster(chatId)) return sendMessage(chatId, "⛔ Hanya master.");
    return toggleProject(chatId, parseInt(data.replace("toggle_", "")));
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot v2.1 running on port ${PORT}`));
