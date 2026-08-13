// ============================================================
// Daftar bahan APT - dikelompokkan per supplier
// Data dari Stock Barang 13-08-2026
// ============================================================

const SUPPLIERS = [
  { id: "justus", name: "Justus" },
  { id: "warna_alpha", name: "Warna Alpha" },
  { id: "lain_lain", name: "Lain-lain" },
];

const MATERIAL_LIST = [
  // === JUSTUS ===
  { id: "resin_150", name: "Resin 150", unit: "Kg", supplier: "justus", min_stock: 225, initial_stock: 413.5 },
  { id: "resin_157", name: "Resin 157", unit: "Kg", supplier: "justus", min_stock: 225, initial_stock: 135 },
  { id: "pu_a", name: "PU A", unit: "Kg", supplier: "justus", min_stock: 100, initial_stock: 51.665 },
  { id: "pu_b", name: "PU B", unit: "Kg", supplier: "justus", min_stock: 100, initial_stock: 137.98 },
  { id: "catalis_mepoxe", name: "Catalis Mepoxe", unit: "Kg", supplier: "justus", min_stock: 20, initial_stock: 65 },
  { id: "silicone_rtv_999", name: "Silicone RTV 999", unit: "Kg", supplier: "justus", min_stock: 25, initial_stock: 0 },
  { id: "lr_10419_white", name: "LR 10419 Ultra White", unit: "Kg", supplier: "justus", min_stock: 25, initial_stock: 14 },
  { id: "lr_5989_black", name: "LR 5989 Black", unit: "Kg", supplier: "justus", min_stock: 25, initial_stock: 0 },
  { id: "sm_styrene", name: "SM/Styrene Monomer", unit: "Kg", supplier: "justus", min_stock: 1, initial_stock: 0 },
  { id: "cs_met_450", name: "CS MET 450 X1040", unit: "Kg", supplier: "justus", min_stock: 10, initial_stock: 46.44 },
  { id: "epochson_1011_la", name: "Epochson 1011 LA", unit: "Botol", supplier: "justus", min_stock: 1, initial_stock: 0 },
  { id: "epochson_1011_lb", name: "Epochson 1011 LB", unit: "Botol", supplier: "justus", min_stock: 1, initial_stock: 0 },

  // === WARNA ALPHA ===
  { id: "extra_doff", name: "Extra Doff", unit: "Botol", supplier: "warna_alpha", min_stock: 10, initial_stock: 50 },
  { id: "epy_primer_yellow", name: "Epy OR Primer Yellow", unit: "Kg", supplier: "warna_alpha", min_stock: 1, initial_stock: 7 },
  { id: "epy_1452_yellow", name: "Epy OR 1452 Yellow", unit: "Kg", supplier: "warna_alpha", min_stock: 3, initial_stock: 8 },
  { id: "epy_3145_fl_yellow", name: "Epy 3145 FL Yellow", unit: "Kg", supplier: "warna_alpha", min_stock: 1, initial_stock: 2 },
  { id: "epy_primer_blue", name: "Epy Primer Blue", unit: "Kg", supplier: "warna_alpha", min_stock: 1, initial_stock: 0 },
  { id: "epy_17682_blue", name: "Epy 17682 Blue APT", unit: "Kg", supplier: "warna_alpha", min_stock: 1, initial_stock: 5 },
  { id: "epy_54162_orange", name: "Epy OR 54162 Orange Glow", unit: "Kg", supplier: "warna_alpha", min_stock: 1, initial_stock: 4 },
  { id: "epy_5451_fl_orange", name: "Epy OR 5451 FL Orange", unit: "Kg", supplier: "warna_alpha", min_stock: 1, initial_stock: 2 },
  { id: "epy_uc_01_white", name: "Epy UC 01 White", unit: "Kg", supplier: "warna_alpha", min_stock: 3, initial_stock: 5 },
  { id: "epy_uc_02_black", name: "Epy UC 02 Black", unit: "Kg", supplier: "warna_alpha", min_stock: 10, initial_stock: 24 },
  { id: "epy_1542_cream", name: "Epy OR UC 1542 Cream", unit: "Kg", supplier: "warna_alpha", min_stock: 3, initial_stock: 12 },
  { id: "epy_169_purple", name: "Epy 169 Trapic Purple", unit: "Kg", supplier: "warna_alpha", min_stock: 10, initial_stock: 20 },
  { id: "epy_9651_violet", name: "Epy OR 9651 Claret Violet", unit: "Kg", supplier: "warna_alpha", min_stock: 3, initial_stock: 7 },
  { id: "epy_caterpillar_green", name: "Epy OR Cater Pillar 550", unit: "Kg", supplier: "warna_alpha", min_stock: 3, initial_stock: 0 },
  { id: "epy_45281_green", name: "Epy OR 45281 Green", unit: "Kg", supplier: "warna_alpha", min_stock: 3, initial_stock: 4 },
  { id: "epy_521_brown", name: "Epy OR 521 Dark Brown", unit: "Kg", supplier: "warna_alpha", min_stock: 3, initial_stock: 6 },
  { id: "epy_6512_red", name: "Epy OR 6512 Pearl Ruby Red", unit: "Kg", supplier: "warna_alpha", min_stock: 3, initial_stock: 10 },
  { id: "epy_65_red", name: "Epy OR 65 Red APT", unit: "Kg", supplier: "warna_alpha", min_stock: 10, initial_stock: 22 },
  { id: "epy_41_clear_doff", name: "Epy 41 Clear Doff", unit: "Kg", supplier: "warna_alpha", min_stock: 3, initial_stock: 10 },
  { id: "pu_hs_clear_doff", name: "PU HS Clear Doff 73 UV", unit: "Kg", supplier: "warna_alpha", min_stock: 3, initial_stock: 11 },
  { id: "epy_41_clear_gloss", name: "Epy 41 Clear Gloss", unit: "Kg", supplier: "warna_alpha", min_stock: 3, initial_stock: 15 },
  { id: "pu_hs_clear_gloss", name: "PU HS Clear Gloss 73 UV", unit: "Kg", supplier: "warna_alpha", min_stock: 20, initial_stock: 20 },
  { id: "thinner_epy_41", name: "Thinner Epy 41", unit: "Liter", supplier: "warna_alpha", min_stock: 80, initial_stock: 40 },
  { id: "thinner_pu_41", name: "Thinner PU 41", unit: "Liter", supplier: "warna_alpha", min_stock: 10, initial_stock: 35 },
  { id: "thinner_nd", name: "Thinner ND", unit: "Liter", supplier: "warna_alpha", min_stock: 60, initial_stock: 20 },
  { id: "lr_yellow", name: "LR Yellow", unit: "Kg", supplier: "warna_alpha", min_stock: 3, initial_stock: 7 },
  { id: "lr_brown", name: "LR Brown", unit: "Kg", supplier: "warna_alpha", min_stock: 3, initial_stock: 11 },

  // === LAIN-LAIN ===
  { id: "kalsium_caco3", name: "Kalsium (CaCO3)", unit: "Kg", supplier: "lain_lain", min_stock: 100, initial_stock: 4480 },
  { id: "silverbond", name: "Silverbond", unit: "Kg", supplier: "lain_lain", min_stock: 100, initial_stock: 8175 },
];

function getMaterialsBySupplier(supplierId) {
  return MATERIAL_LIST.filter((m) => m.supplier === supplierId);
}

function getMaterialById(materialId) {
  return MATERIAL_LIST.find((m) => m.id === materialId);
}

module.exports = { SUPPLIERS, MATERIAL_LIST, getMaterialsBySupplier, getMaterialById };
