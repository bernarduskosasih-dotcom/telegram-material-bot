const fetch = require("node-fetch");
const FormData = require("form-data");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chatId, text, options = {}) {
  const body = { chat_id: chatId, text, parse_mode: "HTML", ...options };
  const res = await fetch(`${API_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sendInlineKeyboard(chatId, text, buttons) {
  return sendMessage(chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

async function sendReplyKeyboard(chatId, text, buttons, options = {}) {
  return sendMessage(chatId, text, {
    reply_markup: { keyboard: buttons, resize_keyboard: true, one_time_keyboard: options.oneTime || false },
  });
}

async function removeKeyboard(chatId, text) {
  return sendMessage(chatId, text, { reply_markup: { remove_keyboard: true } });
}

async function answerCallback(callbackQueryId, text = "") {
  const res = await fetch(`${API_URL}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
  return res.json();
}

// ============================================================
// Download file yang diupload user (misal Excel adjustment)
// ============================================================
async function getFileBuffer(fileId) {
  const infoRes = await fetch(`${API_URL}/getFile?file_id=${fileId}`);
  const info = await infoRes.json();
  if (!info.ok) throw new Error("Gagal ambil info file dari Telegram: " + JSON.stringify(info));

  const filePath = info.result.file_path;
  const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error("Gagal download file dari Telegram");
  return fileRes.buffer();
}

// ============================================================
// Kirim file/dokumen (misal report Excel) ke chat
// ============================================================
async function sendDocument(chatId, buffer, filename, caption = "") {
  const form = new FormData();
  form.append("chat_id", chatId);
  if (caption) {
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
  }
  form.append("document", buffer, { filename });

  const res = await fetch(`${API_URL}/sendDocument`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!json.ok) throw new Error("Gagal kirim dokumen ke Telegram: " + JSON.stringify(json));
  return json;
}

module.exports = {
  sendMessage, sendInlineKeyboard, sendReplyKeyboard, removeKeyboard,
  answerCallback, getFileBuffer, sendDocument,
};
