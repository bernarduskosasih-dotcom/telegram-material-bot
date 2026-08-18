const { supabase } = require("./supabase");
const {
  sendMessage,
  sendInlineKeyboard,
  answerCallback,
} = require("./telegram");
const { SUPPLIERS, MATERIAL_LIST, getMaterialsBySupplier, getMaterialById } = require("./data");

const MASTER_CHAT_ID = process.env.MASTER_CHAT_ID;

// ============================================================
// Session management
// ============================================================
async function saveSession(chatId, sessionData) {
  const { error } = await supabase.from("sessions").upsert(
    { chat_id: String(chatId), data: sessionData, updated_at: new Date().toISOString() },
    { onConflict: "chat_id" }
  );
  if (error) console.error("Save session error:", error);
}

async function getSession(chatId) {
  const { data, error } = await supabase
    .from("sessions").select("data").eq("chat_id", String(chatId)).single();
  if (error || !data) return null;
  return data.data;
}

async function clearSession(chatId) {
  await supabase.from("sessions").delete().eq("chat_id", String(chatId));
}

function isMaster(chatId) {
  return String(chatId) === String(MASTER_CHAT_ID);
}

// ============================================================
// Menu utama
// ============================================================
async function showMainMenu(chatId, userName) {
  const buttons = [
    [
      { text: "📦 Lapor Pemakaian", callback_data: "menu_laporan" },
      { text: "📊 Status Hari Ini", callback_data: "menu_status" },
    ],
    [
      { text: "📋 Riwayat 7 Hari", callback_data: "menu_riwayat" },
      { text: "📦 Cek Stok", callback_data: "menu_stok" },
    ],
    [
      { text: "❓ Bantuan", callback_data: "menu_bantuan" },
    ],
  ];

  // Menu master
  if (isMaster(chatId)) {
    buttons.push([
      { text: "🚚 Barang Masuk", callback_data: "menu_restock" },
      { text: "🗑️ Hapus Data", callback_data: "menu_delete" },
    ]);
    buttons.push([
      { text: "📈 Report per Project", callback_data: "menu_report_project" },
      { text: "⚙️ Kelola Project", callback_data: "menu_project" },
    ]);
  }

  await sendInlineKeyboard(
    chatId,
    `Halo <b>${userName}</b>! 👋\n\nBot Laporan Pemakaian Bahan APT.\nPilih menu:`,
    buttons
  );
}

// ============================================================
// FLOW LAPORAN: Step 1 - Pilih supplier
// ============================================================
async function startReport(chatId) {
  const buttons = SUPPLIERS.map((s) => [
    { text: s.name, callback_data: `supplier_${s.id}` },
  ]);
  buttons.push([{ text: "❌ Batal", callback_data: "menu_batal" }]);

  await sendInlineKeyboard(
    chatId,
    "📦 <b>Lapor Pemakaian Bahan</b>\n\nPilih supplier:",
    buttons
  );
}

// ============================================================
// Step 2 - Pilih bahan (dari supplier yang dipilih)
// ============================================================
async function showMaterials(chatId, supplierId, page = 0, mode = "usage") {
  const materials = getMaterialsBySupplier(supplierId);
  const PAGE_SIZE = 8;
  const start = page * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageMaterials = materials.slice(start, end);

  const prefix = mode === "restock" ? "rmat_" : "mat_";

  const buttons = [];
  for (let i = 0; i < pageMaterials.length; i += 2) {
    const row = [{ text: pageMaterials[i].name, callback_data: `${prefix}${pageMaterials[i].id}` }];
    if (pageMaterials[i + 1]) {
      row.push({ text: pageMaterials[i + 1].name, callback_data: `${prefix}${pageMaterials[i + 1].id}` });
    }
    buttons.push(row);
  }

  // Navigasi halaman
  const pagePrefix = mode === "restock" ? "rpage_" : "page_";
  const navRow = [];
  if (page > 0) navRow.push({ text: "⬅️ Sebelumnya", callback_data: `${pagePrefix}${supplierId}_${page - 1}` });
  if (end < materials.length) navRow.push({ text: "Selanjutnya ➡️", callback_data: `${pagePrefix}${supplierId}_${page + 1}` });
  if (navRow.length) buttons.push(navRow);

  const backMenu = mode === "restock" ? "menu_restock" : "menu_laporan";
  buttons.push([
    { text: "🔙 Pilih Supplier", callback_data: backMenu },
    { text: "❌ Batal", callback_data: "menu_batal" },
  ]);

  const supplier = SUPPLIERS.find((s) => s.id === supplierId);
  const totalPages = Math.ceil(materials.length / PAGE_SIZE);
  const title = mode === "restock" ? "🚚 <b>Barang Masuk</b>" : "📦 <b>Pemakaian</b>";
  await sendInlineKeyboard(
    chatId,
    `${title} — <b>${supplier.name}</b>\nPilih bahan: (Hal ${page + 1}/${totalPages})`,
    buttons
  );
}

// ============================================================
// Step 3 - Input jumlah
// ============================================================
async function askQuantity(chatId, materialId) {
  const material = getMaterialById(materialId);
  if (!material) {
    await sendMessage(chatId, "❌ Bahan tidak ditemukan.");
    return;
  }

  await saveSession(chatId, {
    step: "input_quantity",
    material_id: materialId,
    material_name: material.name,
    material_unit: material.unit,
    supplier: material.supplier,
  });

  await sendMessage(
    chatId,
    `📏 Berapa <b>${material.unit}</b> <b>${material.name}</b> yang dipakai?\n\nKetik angka (contoh: <code>12.5</code>)`
  );
}

// ============================================================
// Step 4 - Input tanggal
// ============================================================
async function askDate(chatId, quantity) {
  const session = await getSession(chatId);
  if (!session) return;

  session.step = "input_date";
  session.quantity = quantity;
  await saveSession(chatId, session);

  const today = getJakartaDate();

  const buttons = [
    [{ text: `📅 Hari ini (${today})`, callback_data: `date_${today}` }],
    [{ text: `📅 Kemarin (${getDateOffset(-1)})`, callback_data: `date_${getDateOffset(-1)}` }],
    [{ text: "✏️ Ketik tanggal lain", callback_data: "date_custom" }],
  ];

  await sendInlineKeyboard(chatId, "📅 Tanggal pemakaian:", buttons);
}

// ============================================================
// Step 5 - Pilih project
// ============================================================
async function askProject(chatId, dateStr) {
  const session = await getSession(chatId);
  if (!session) return;

  session.step = "input_project";
  session.report_date = dateStr;
  await saveSession(chatId, session);

  const { data: projects, error } = await supabase
    .from("projects").select("*").eq("is_active", true).order("name");

  if (error || !projects || projects.length === 0) {
    await sendMessage(chatId, "⚠️ Belum ada project aktif. Minta master untuk menambah project.\nKetik /start untuk menu.");
    await clearSession(chatId);
    return;
  }

  const buttons = projects.map((p) => [
    { text: p.name, callback_data: `proj_${p.id}` },
  ]);
  buttons.push([{ text: "❌ Batal", callback_data: "menu_batal" }]);

  await sendInlineKeyboard(chatId, "🏗️ Untuk project apa?", buttons);
}

// ============================================================
// Step 6 - Simpan & cek stok
// ============================================================
async function confirmAndSave(chatId, projectId, userId, userName) {
  const session = await getSession(chatId);
  if (!session) return;

  const { data: project } = await supabase
    .from("projects").select("name").eq("id", projectId).single();
  const projectName = project ? project.name : "-";

  const { error } = await supabase.from("material_usage").insert({
    material_id: session.material_id,
    material_name: session.material_name,
    quantity: session.quantity,
    unit: session.material_unit,
    supplier: session.supplier,
    project_id: projectId,
    project_name: projectName,
    order_note: projectName,
    operator_id: String(userId),
    operator_name: userName,
    reported_at: new Date().toISOString(),
    report_date: session.report_date,
  });

  if (error) {
    console.error("Insert error:", error);
    await sendMessage(chatId, "❌ Gagal menyimpan. Error: " + error.message);
    await clearSession(chatId);
    return;
  }

  const summary =
    `✅ <b>Laporan Tersimpan!</b>\n\n` +
    `📦 Bahan: <b>${session.material_name}</b>\n` +
    `📏 Jumlah: <b>${session.quantity} ${session.material_unit}</b>\n` +
    `📅 Tanggal: <b>${session.report_date}</b>\n` +
    `🏗️ Project: <b>${projectName}</b>\n` +
    `👤 Operator: <b>${userName}</b>`;

  await sendMessage(chatId, summary);
  await checkStockAlert(session.material_id, session.material_name);

  await sendInlineKeyboard(chatId, "Mau input lagi?", [
    [
      { text: "✅ Ya, input lagi", callback_data: "menu_laporan" },
      { text: "🏠 Menu Utama", callback_data: "menu_utama" },
    ],
  ]);

  await clearSession(chatId);
}

// ============================================================
// FITUR BARU 1: BARANG MASUK (Restock) - Master only
// ============================================================
async function startRestock(chatId) {
  const buttons = SUPPLIERS.map((s) => [
    { text: s.name, callback_data: `rsupplier_${s.id}` },
  ]);
  buttons.push([{ text: "❌ Batal", callback_data: "menu_batal" }]);

  await sendInlineKeyboard(
    chatId,
    "🚚 <b>Barang Masuk dari Supplier</b>\n\nPilih supplier:",
    buttons
  );
}

async function askRestockQuantity(chatId, materialId) {
  const material = getMaterialById(materialId);
  if (!material) {
    await sendMessage(chatId, "❌ Bahan tidak ditemukan.");
    return;
  }

  await saveSession(chatId, {
    step: "input_restock_qty",
    material_id: materialId,
    material_name: material.name,
    material_unit: material.unit,
    supplier: material.supplier,
  });

  await sendMessage(
    chatId,
    `🚚 Berapa <b>${material.unit}</b> <b>${material.name}</b> yang masuk?\n\nKetik angka (contoh: <code>225</code>)`
  );
}

async function confirmRestock(chatId, quantity, userName) {
  const session = await getSession(chatId);
  if (!session) return;

  // Simpan sebagai quantity negatif (mengurangi "total pemakaian" = menambah stok)
  const { error } = await supabase.from("material_usage").insert({
    material_id: session.material_id,
    material_name: session.material_name,
    quantity: -quantity, // negatif = restock
    unit: session.material_unit,
    supplier: session.supplier,
    project_id: null,
    project_name: "RESTOCK",
    order_note: "Barang masuk dari supplier",
    operator_id: String(MASTER_CHAT_ID),
    operator_name: userName,
    reported_at: new Date().toISOString(),
    report_date: getJakartaDate(),
  });

  if (error) {
    await sendMessage(chatId, "❌ Gagal menyimpan. Error: " + error.message);
  } else {
    // Hitung stok terbaru
    const material = getMaterialById(session.material_id);
    const { data } = await supabase
      .from("material_usage").select("quantity").eq("material_id", session.material_id);
    const totalUsed = data ? data.reduce((sum, r) => sum + parseFloat(r.quantity), 0) : 0;
    const currentStock = material.initial_stock - totalUsed;

    await sendMessage(chatId,
      `✅ <b>Barang Masuk Tercatat!</b>\n\n` +
      `📦 Bahan: <b>${session.material_name}</b>\n` +
      `🚚 Jumlah masuk: <b>+${quantity} ${session.material_unit}</b>\n` +
      `📊 Stok sekarang: <b>${currentStock.toFixed(1)} ${session.material_unit}</b>\n` +
      `📅 Tanggal: <b>${getJakartaDate()}</b>`
    );
  }

  await sendInlineKeyboard(chatId, "Lanjut?", [
    [
      { text: "🚚 Input barang masuk lagi", callback_data: "menu_restock" },
      { text: "🏠 Menu Utama", callback_data: "menu_utama" },
    ],
  ]);

  await clearSession(chatId);
}

// ============================================================
// FITUR BARU 2: HAPUS DATA - Master only
// ============================================================
async function showRecentEntries(chatId) {
  const { data, error } = await supabase
    .from("material_usage")
    .select("*")
    .neq("project_name", "RESTOCK")
    .order("reported_at", { ascending: false })
    .limit(10);

  if (error || !data || data.length === 0) {
    await sendMessage(chatId, "🗑️ Tidak ada data untuk dihapus.");
    return;
  }

  let message = "🗑️ <b>Pilih data yang mau dihapus:</b>\n\n";

  const buttons = [];
  data.forEach((row, i) => {
    const time = new Date(row.reported_at).toLocaleTimeString("id-ID", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
    });
    message += `${i + 1}. ${row.material_name} — ${row.quantity} ${row.unit}\n`;
    message += `   📅 ${row.report_date} | 🏗️ ${row.project_name} | 👤 ${row.operator_name} (${time})\n\n`;
    buttons.push([{ text: `🗑️ Hapus #${i + 1}: ${row.material_name} ${row.quantity}${row.unit}`, callback_data: `del_${row.id}` }]);
  });

  buttons.push([{ text: "🏠 Menu Utama", callback_data: "menu_utama" }]);

  await sendInlineKeyboard(chatId, message, buttons);
}

async function deleteEntry(chatId, entryId) {
  // Ambil data dulu sebelum hapus
  const { data: entry } = await supabase
    .from("material_usage").select("*").eq("id", entryId).single();

  if (!entry) {
    await sendMessage(chatId, "❌ Data tidak ditemukan.");
    return;
  }

  const { error } = await supabase.from("material_usage").delete().eq("id", entryId);

  if (error) {
    await sendMessage(chatId, "❌ Gagal menghapus: " + error.message);
  } else {
    await sendMessage(chatId,
      `✅ <b>Data dihapus!</b>\n\n` +
      `📦 ${entry.material_name} — ${entry.quantity} ${entry.unit}\n` +
      `📅 ${entry.report_date} | 👤 ${entry.operator_name}`
    );
  }

  // Tampilkan daftar lagi
  await showRecentEntries(chatId);
}

// ============================================================
// FITUR BARU 3: REPORT PER PROJECT - Master only
// ============================================================
async function showProjectReport(chatId) {
  const { data: projects } = await supabase
    .from("projects").select("*").order("name");

  if (!projects || projects.length === 0) {
    await sendMessage(chatId, "Belum ada project.");
    return;
  }

  const buttons = projects.map((p) => [
    { text: `📈 ${p.name}`, callback_data: `rproj_${p.id}` },
  ]);
  buttons.push([{ text: "📈 Semua Project (Ringkasan)", callback_data: "rproj_all" }]);
  buttons.push([{ text: "🏠 Menu Utama", callback_data: "menu_utama" }]);

  await sendInlineKeyboard(chatId, "📈 <b>Report Pemakaian per Project</b>\n\nPilih project:", buttons);
}

async function showProjectDetail(chatId, projectId) {
  let query = supabase.from("material_usage").select("*").neq("project_name", "RESTOCK");

  if (projectId !== "all") {
    query = query.eq("project_id", parseInt(projectId));
  }

  const { data, error } = await query.order("material_name");

  if (error || !data || data.length === 0) {
    await sendMessage(chatId, "📈 Belum ada data untuk project ini.");
    return;
  }

  if (projectId === "all") {
    // Ringkasan semua project
    let message = "📈 <b>Ringkasan Semua Project</b>\n\n";
    const byProject = {};
    data.forEach((row) => {
      const pn = row.project_name || "-";
      if (!byProject[pn]) byProject[pn] = {};
      if (!byProject[pn][row.material_name]) byProject[pn][row.material_name] = { total: 0, unit: row.unit };
      byProject[pn][row.material_name].total += parseFloat(row.quantity);
    });

    for (const [projName, materials] of Object.entries(byProject)) {
      message += `🏗️ <b>${projName}</b>\n`;
      for (const [matName, info] of Object.entries(materials)) {
        message += `   📦 ${matName}: ${info.total.toFixed(1)} ${info.unit}\n`;
      }
      message += "\n";
    }

    await sendMessage(chatId, message);
  } else {
    // Detail satu project
    const projectName = data[0]?.project_name || "Unknown";
    let message = `📈 <b>Report: ${projectName}</b>\n\n`;

    const byMaterial = {};
    data.forEach((row) => {
      if (!byMaterial[row.material_name]) byMaterial[row.material_name] = { total: 0, unit: row.unit, entries: [] };
      byMaterial[row.material_name].total += parseFloat(row.quantity);
      byMaterial[row.material_name].entries.push(row);
    });

    for (const [name, info] of Object.entries(byMaterial)) {
      message += `📦 <b>${name}</b>: ${info.total.toFixed(1)} ${info.unit}\n`;
      info.entries.forEach((e) => {
        message += `   └ ${e.report_date}: ${e.quantity} ${e.unit} (${e.operator_name})\n`;
      });
      message += "\n";
    }

    const totalEntries = data.length;
    message += `Total ${totalEntries} catatan pemakaian.`;

    await sendMessage(chatId, message);
  }

  await sendInlineKeyboard(chatId, "Lihat project lain?", [
    [
      { text: "📈 Project lain", callback_data: "menu_report_project" },
      { text: "🏠 Menu Utama", callback_data: "menu_utama" },
    ],
  ]);
}

// ============================================================
// Cek stok & kirim alert ke master
// ============================================================
async function checkStockAlert(materialId, materialName) {
  if (!MASTER_CHAT_ID) return;

  const material = getMaterialById(materialId);
  if (!material) return;

  const { data, error } = await supabase
    .from("material_usage").select("quantity").eq("material_id", materialId);

  if (error || !data) return;

  const totalUsed = data.reduce((sum, row) => sum + parseFloat(row.quantity), 0);
  const currentStock = material.initial_stock - totalUsed;

  if (currentStock <= material.min_stock) {
    const alert =
      `🚨 <b>ALERT STOK RENDAH!</b>\n\n` +
      `📦 <b>${materialName}</b>\n` +
      `📊 Stok saat ini: <b>${currentStock.toFixed(1)} ${material.unit}</b>\n` +
      `⚠️ Minimum stok: <b>${material.min_stock} ${material.unit}</b>\n` +
      `📉 Total terpakai: <b>${totalUsed.toFixed(1)} ${material.unit}</b>\n\n` +
      `Segera order ke supplier!`;

    await sendMessage(MASTER_CHAT_ID, alert);
  }
}

// ============================================================
// Status hari ini
// ============================================================
async function showTodayStatus(chatId) {
  const today = getJakartaDate();

  const { data, error } = await supabase
    .from("material_usage").select("*")
    .eq("report_date", today)
    .neq("project_name", "RESTOCK")
    .order("reported_at", { ascending: false });

  if (error || !data || data.length === 0) {
    await sendMessage(chatId, `📊 <b>Status Pemakaian</b> (${today})\n\nBelum ada laporan hari ini.`);
    return;
  }

  let message = `📊 <b>Status Pemakaian</b> (${today})\n\n`;

  const grouped = {};
  data.forEach((row) => {
    if (!grouped[row.material_name]) grouped[row.material_name] = { total: 0, unit: row.unit, entries: [] };
    grouped[row.material_name].total += parseFloat(row.quantity);
    grouped[row.material_name].entries.push(row);
  });

  for (const [name, info] of Object.entries(grouped)) {
    message += `📦 <b>${name}</b>: ${info.total} ${info.unit}\n`;
    info.entries.forEach((e) => {
      const time = new Date(e.reported_at).toLocaleTimeString("id-ID", {
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
      });
      message += `   └ ${e.quantity} ${e.unit} — ${e.project_name || e.order_note} (${time}, ${e.operator_name})\n`;
    });
    message += "\n";
  }

  message += `Total ${data.length} laporan.`;
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
    .select("report_date, material_name, quantity, unit, project_name")
    .neq("project_name", "RESTOCK")
    .gte("report_date", weekAgo.toISOString().split("T")[0])
    .order("report_date", { ascending: false });

  if (error || !data || data.length === 0) {
    await sendMessage(chatId, "📋 Tidak ada data dalam 7 hari terakhir.");
    return;
  }

  let message = `📋 <b>Riwayat 7 Hari Terakhir</b>\n\n`;

  const byDate = {};
  data.forEach((row) => {
    if (!byDate[row.report_date]) byDate[row.report_date] = [];
    byDate[row.report_date].push(row);
  });

  for (const [date, entries] of Object.entries(byDate)) {
    message += `📅 <b>${date}</b>\n`;
    const byMaterial = {};
    entries.forEach((e) => {
      if (!byMaterial[e.material_name]) byMaterial[e.material_name] = { total: 0, unit: e.unit };
      byMaterial[e.material_name].total += parseFloat(e.quantity);
    });
    for (const [name, info] of Object.entries(byMaterial)) {
      message += `   ${name}: ${info.total} ${info.unit}\n`;
    }
    message += "\n";
  }

  await sendMessage(chatId, message);
}

// ============================================================
// Cek stok semua bahan
// ============================================================
async function showStockStatus(chatId) {
  const { data, error } = await supabase
    .from("material_usage").select("material_id, quantity");

  const usageMap = {};
  if (data) {
    data.forEach((row) => {
      if (!usageMap[row.material_id]) usageMap[row.material_id] = 0;
      usageMap[row.material_id] += parseFloat(row.quantity);
    });
  }

  let message = `📦 <b>Status Stok Bahan</b>\n\n`;
  let lowStockCount = 0;

  for (const supplier of SUPPLIERS) {
    const materials = getMaterialsBySupplier(supplier.id);
    message += `<b>🏭 ${supplier.name}</b>\n`;

    materials.forEach((m) => {
      const used = usageMap[m.id] || 0;
      const current = m.initial_stock - used;
      const isLow = current <= m.min_stock;
      const icon = isLow ? "🔴" : "🟢";
      if (isLow) lowStockCount++;
      message += `${icon} ${m.name}: ${current.toFixed(1)} ${m.unit}`;
      if (isLow) message += ` ⚠️`;
      message += "\n";
    });
    message += "\n";
  }

  if (lowStockCount > 0) {
    message += `\n⚠️ <b>${lowStockCount} bahan di bawah minimum stok!</b>`;
  }

  await sendMessage(chatId, message);
}

// ============================================================
// Project management (Master only)
// ============================================================
async function showProjectMenu(chatId) {
  const { data: projects } = await supabase
    .from("projects").select("*").order("name");

  let message = "⚙️ <b>Kelola Project</b>\n\n";

  if (projects && projects.length > 0) {
    projects.forEach((p) => {
      message += `${p.is_active ? "🟢" : "🔴"} ${p.name}\n`;
    });
  } else {
    message += "Belum ada project.\n";
  }

  const buttons = [
    [{ text: "➕ Tambah Project", callback_data: "proj_add" }],
    [{ text: "🏠 Menu Utama", callback_data: "menu_utama" }],
  ];

  if (projects && projects.length > 0) {
    buttons.splice(1, 0, [{ text: "✅ Aktifkan/Nonaktifkan", callback_data: "proj_toggle" }]);
  }

  await sendInlineKeyboard(chatId, message, buttons);
}

async function startAddProject(chatId) {
  await saveSession(chatId, { step: "add_project" });
  await sendMessage(chatId, "✏️ Ketik nama project baru:");
}

async function saveProject(chatId, projectName) {
  const { error } = await supabase.from("projects").insert({ name: projectName, is_active: true });
  if (error) {
    await sendMessage(chatId, "❌ Gagal: " + error.message);
  } else {
    await sendMessage(chatId, `✅ Project <b>${projectName}</b> ditambahkan!`);
  }
  await clearSession(chatId);
  await showProjectMenu(chatId);
}

async function showToggleProjects(chatId) {
  const { data: projects } = await supabase.from("projects").select("*").order("name");
  if (!projects || projects.length === 0) {
    await sendMessage(chatId, "Belum ada project.");
    return;
  }

  const buttons = projects.map((p) => [
    { text: `${p.is_active ? "🟢" : "🔴"} ${p.name}`, callback_data: `toggle_${p.id}` },
  ]);
  buttons.push([{ text: "🔙 Kembali", callback_data: "menu_project" }]);

  await sendInlineKeyboard(chatId, "Klik project untuk aktifkan/nonaktifkan:", buttons);
}

async function toggleProject(chatId, projectId) {
  const { data: project } = await supabase
    .from("projects").select("*").eq("id", projectId).single();
  if (!project) return;

  await supabase.from("projects").update({ is_active: !project.is_active }).eq("id", projectId);
  const status = !project.is_active ? "diaktifkan ✅" : "dinonaktifkan 🔴";
  await sendMessage(chatId, `Project <b>${project.name}</b> ${status}`);
  await showToggleProjects(chatId);
}

// ============================================================
// Helper: Jakarta date
// ============================================================
function getJakartaDate() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

function getDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

function isValidDate(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  return !isNaN(new Date(dateStr).getTime());
}

module.exports = {
  showMainMenu, startReport, showMaterials, askQuantity, askDate,
  askProject, confirmAndSave, showTodayStatus, showHistory, showStockStatus,
  showProjectMenu, startAddProject, saveProject, showToggleProjects, toggleProject,
  // New features
  startRestock, askRestockQuantity, confirmRestock,
  showRecentEntries, deleteEntry,
  showProjectReport, showProjectDetail,
  // Utils
  getSession, clearSession, saveSession, isValidDate, isMaster,
};
