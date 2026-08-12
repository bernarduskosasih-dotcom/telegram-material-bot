const { supabase } = require("./supabase");
const {
  sendMessage,
  sendInlineKeyboard,
  sendReplyKeyboard,
  removeKeyboard,
  answerCallback,
} = require("./telegram");

// ============================================================
// Daftar bahan yang tersedia (sesuaikan dengan bahan di APT kamu)
// ============================================================
const MATERIAL_LIST = [
  { id: "resin_150_hrn", name: "Resin 150 HRN", unit: "kg" },
  { id: "resin_157", name: "Resin 157/Yukalac 157", unit: "kg" },
  { id: "pu_a", name: "PU A (Polyurethane A)", unit: "kg" },
  { id: "pu_b", name: "PU B (Polyurethane B)", unit: "kg" },
  { id: "catalyst_mepoxe", name: "Catalyst Mepoxe", unit: "kg" },
  { id: "cs_met_450", name: "CS Met 450x1040", unit: "kg" },
  { id: "silicone_rtv_999", name: "Silicone RTV 999", unit: "kg" },
  { id: "pig_lr_10419", name: "PIG LR 10419 H White", unit: "kg" },
  { id: "pig_lr_5989", name: "PIG LR 5989 Black", unit: "kg" },
  { id: "styrene_monomer", name: "SM/Styrene Monomer", unit: "kg" },
  { id: "eposchon_1011_la", name: "Eposchon 1011 LA", unit: "kg" },
  { id: "eposchon_1011_lb", name: "Eposchon 1011 LB", unit: "kg" },
];

// In-memory session storage (untuk Netlify, bisa diganti Redis/Supabase)
// Catatan: karena Netlify Functions stateless, kita simpan session di Supabase
// ============================================================

// Simpan session percakapan ke Supabase
async function saveSession(chatId, sessionData) {
  const { error } = await supabase.from("sessions").upsert(
    {
      chat_id: String(chatId),
      data: sessionData,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chat_id" }
  );
  if (error) console.error("Save session error:", error);
}

// Ambil session percakapan dari Supabase
async function getSession(chatId) {
  const { data, error } = await supabase
    .from("sessions")
    .select("data")
    .eq("chat_id", String(chatId))
    .single();

  if (error || !data) return null;
  return data.data;
}

// Hapus session
async function clearSession(chatId) {
  await supabase.from("sessions").delete().eq("chat_id", String(chatId));
}

// ============================================================
// Menu utama
// ============================================================
async function showMainMenu(chatId, userName) {
  const buttons = [
    [
      { text: "📦 Laporan Pemakaian", callback_data: "menu_laporan" },
      { text: "📊 Status Hari Ini", callback_data: "menu_status" },
    ],
    [
      { text: "📋 Riwayat 7 Hari", callback_data: "menu_riwayat" },
      { text: "❓ Bantuan", callback_data: "menu_bantuan" },
    ],
  ];

  await sendInlineKeyboard(
    chatId,
    `Halo <b>${userName}</b>! 👋\n\nSelamat datang di Bot Laporan Pemakaian Bahan APT.\nPilih menu di bawah:`,
    buttons
  );
}

// ============================================================
// Flow: Laporan Pemakaian Bahan
// ============================================================

// Step 1: Pilih bahan
async function startMaterialReport(chatId) {
  // Buat tombol dari daftar bahan, 2 per baris
  const buttons = [];
  for (let i = 0; i < MATERIAL_LIST.length; i += 2) {
    const row = [
      {
        text: MATERIAL_LIST[i].name,
        callback_data: `bahan_${MATERIAL_LIST[i].id}`,
      },
    ];
    if (MATERIAL_LIST[i + 1]) {
      row.push({
        text: MATERIAL_LIST[i + 1].name,
        callback_data: `bahan_${MATERIAL_LIST[i + 1].id}`,
      });
    }
    buttons.push(row);
  }
  buttons.push([{ text: "❌ Batal", callback_data: "menu_batal" }]);

  await sendInlineKeyboard(
    chatId,
    "📦 <b>Laporan Pemakaian Bahan</b>\n\nPilih bahan yang dipakai:",
    buttons
  );
}

// Step 2: User sudah pilih bahan, minta jumlah
async function askQuantity(chatId, materialId) {
  const material = MATERIAL_LIST.find((m) => m.id === materialId);
  if (!material) {
    await sendMessage(chatId, "❌ Bahan tidak ditemukan.");
    return;
  }

  // Simpan session: sedang input jumlah untuk bahan ini
  await saveSession(chatId, {
    step: "input_quantity",
    material_id: materialId,
    material_name: material.name,
    material_unit: material.unit,
  });

  await sendMessage(
    chatId,
    `📏 Berapa <b>${material.unit}</b> <b>${material.name}</b> yang dipakai?\n\n` +
      `Ketik angkanya saja (contoh: <code>12.5</code>)`
  );
}

// Step 3: User sudah input jumlah, minta keterangan/nomor order
async function askOrderNote(chatId, quantity) {
  const session = await getSession(chatId);
  if (!session) return;

  // Update session dengan jumlah
  session.step = "input_order";
  session.quantity = quantity;
  await saveSession(chatId, session);

  await sendMessage(
    chatId,
    `📝 Untuk order/job apa?\n\n` +
      `Ketik nomor order atau keterangan (contoh: <code>ORD-2026-001</code> atau <code>Spanduk Bank BCA</code>)\n\n` +
      `Ketik <code>-</code> jika tidak ada order tertentu.`
  );
}

// Step 4: Konfirmasi dan simpan
async function confirmAndSave(chatId, orderNote, userId, userName) {
  const session = await getSession(chatId);
  if (!session) return;

  // Tampilkan konfirmasi
  const summary =
    `✅ <b>Konfirmasi Laporan Pemakaian</b>\n\n` +
    `📦 Bahan: <b>${session.material_name}</b>\n` +
    `📏 Jumlah: <b>${session.quantity} ${session.material_unit}</b>\n` +
    `📋 Order: <b>${orderNote}</b>\n` +
    `👤 Operator: <b>${userName}</b>\n` +
    `📅 Tanggal: <b>${new Date().toISOString().split("T")[0]}</b>\n\n` +
    `Data sudah tersimpan! ✅`;

  // Simpan ke database
  const { error } = await supabase.from("material_usage").insert({
    material_id: session.material_id,
    material_name: session.material_name,
    quantity: session.quantity,
    unit: session.material_unit,
    order_note: orderNote,
    operator_id: String(userId),
    operator_name: userName,
    reported_at: new Date().toISOString(),
    report_date: new Date().toISOString().split("T")[0],
  });

  if (error) {
    console.error("Insert error:", error);
    await sendMessage(
      chatId,
      "❌ Gagal menyimpan data. Silakan coba lagi.\n\nError: " + error.message
    );
  } else {
    await sendMessage(chatId, summary);

    // Tanya apakah mau input lagi
    await sendInlineKeyboard(chatId, "Mau input pemakaian bahan lagi?", [
      [
        { text: "✅ Ya, input lagi", callback_data: "menu_laporan" },
        { text: "🏠 Menu Utama", callback_data: "menu_utama" },
      ],
    ]);
  }

  // Hapus session
  await clearSession(chatId);
}

// ============================================================
// Status hari ini
// ============================================================
async function showTodayStatus(chatId) {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("material_usage")
    .select("*")
    .eq("report_date", today)
    .order("reported_at", { ascending: false });

  if (error || !data || data.length === 0) {
    await sendMessage(
      chatId,
      `📊 <b>Status Pemakaian Hari Ini</b> (${today})\n\nBelum ada laporan hari ini.`
    );
    return;
  }

  let message = `📊 <b>Status Pemakaian Hari Ini</b> (${today})\n\n`;

  // Group by material
  const grouped = {};
  data.forEach((row) => {
    if (!grouped[row.material_name]) {
      grouped[row.material_name] = { total: 0, unit: row.unit, entries: [] };
    }
    grouped[row.material_name].total += row.quantity;
    grouped[row.material_name].entries.push(row);
  });

  for (const [name, info] of Object.entries(grouped)) {
    message += `📦 <b>${name}</b>: ${info.total} ${info.unit}\n`;
    info.entries.forEach((e) => {
      const time = new Date(e.reported_at).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      message += `   └ ${e.quantity} ${e.unit} — ${e.order_note} (${time}, ${e.operator_name})\n`;
    });
    message += "\n";
  }

  message += `Total ${data.length} laporan hari ini.`;

  await sendMessage(chatId, message);
}

// ============================================================
// Riwayat 7 hari
// ============================================================
async function showHistory(chatId) {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from("material_usage")
    .select("report_date, material_name, quantity, unit")
    .gte("report_date", weekAgo.toISOString().split("T")[0])
    .order("report_date", { ascending: false });

  if (error || !data || data.length === 0) {
    await sendMessage(chatId, "📋 Tidak ada data dalam 7 hari terakhir.");
    return;
  }

  let message = `📋 <b>Riwayat 7 Hari Terakhir</b>\n\n`;

  // Group by date
  const byDate = {};
  data.forEach((row) => {
    if (!byDate[row.report_date]) byDate[row.report_date] = [];
    byDate[row.report_date].push(row);
  });

  for (const [date, entries] of Object.entries(byDate)) {
    message += `📅 <b>${date}</b>\n`;
    // Group by material within date
    const byMaterial = {};
    entries.forEach((e) => {
      if (!byMaterial[e.material_name])
        byMaterial[e.material_name] = { total: 0, unit: e.unit };
      byMaterial[e.material_name].total += e.quantity;
    });
    for (const [name, info] of Object.entries(byMaterial)) {
      message += `   ${name}: ${info.total} ${info.unit}\n`;
    }
    message += "\n";
  }

  await sendMessage(chatId, message);
}

module.exports = {
  showMainMenu,
  startMaterialReport,
  askQuantity,
  askOrderNote,
  confirmAndSave,
  showTodayStatus,
  showHistory,
  getSession,
  clearSession,
  MATERIAL_LIST,
};
