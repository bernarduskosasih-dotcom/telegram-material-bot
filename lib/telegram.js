const fetch = require("node-fetch");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Kirim pesan teks biasa
async function sendMessage(chatId, text, options = {}) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...options,
  };

  const res = await fetch(`${API_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return res.json();
}

// Kirim pesan dengan inline keyboard (tombol di bawah pesan)
async function sendInlineKeyboard(chatId, text, buttons) {
  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: buttons,
    },
  });
}

// Kirim pesan dengan reply keyboard (tombol di bawah input)
async function sendReplyKeyboard(chatId, text, buttons, options = {}) {
  return sendMessage(chatId, text, {
    reply_markup: {
      keyboard: buttons,
      resize_keyboard: true,
      one_time_keyboard: options.oneTime || false,
    },
  });
}

// Hapus keyboard
async function removeKeyboard(chatId, text) {
  return sendMessage(chatId, text, {
    reply_markup: {
      remove_keyboard: true,
    },
  });
}

// Answer callback query (untuk inline keyboard)
async function answerCallback(callbackQueryId, text = "") {
  const res = await fetch(`${API_URL}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
  return res.json();
}

module.exports = {
  sendMessage,
  sendInlineKeyboard,
  sendReplyKeyboard,
  removeKeyboard,
  answerCallback,
};
