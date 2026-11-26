// Tìm kiếm nhanh toàn bộ website (2.345 từ vựng · 160 ngữ pháp · 7 Trạm nâng cao · 1.492 chữ Hán)
// Hỗ trợ gõ Chữ Hán, Pinyin (có dấu hoặc không dấu), hoặc Nghĩa tiếng Việt (có dấu hoặc không dấu)!

import { store } from "./store.js";
import { audioManager } from "./audio.js";
import { showHanziAnalysis, showVocabDetailPanel } from "./hanziPanel.js";
import { escapeHtml } from "./mascots.js";

function normalizeText(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\/\//g, "")
    .replace(/ü/g, "v")
    .trim();
}

let searchIndex = null;

function ensureSearchIndex() {
  if (searchIndex) return searchIndex;
  const items = [];

  // 1. Từ vựng 3 Giáo trình căn bản (38 bài)
  for (const lesson of store.getAllLoadedLessons()) {
    for (const w of lesson.vocabulary || []) {
      const meaning = w.lesson_usage?.meaning || "";
      items.push({
        group: "textbook_vocab",
        groupLabel: "Giáo trình",
        badge: `${lesson.textbook} · Bài ${lesson.lesson_number}`,
        title: w.hanzi,
        sub: w.pinyin,
        desc: `${w.lesson_usage?.part_of_speech ? `[${w.lesson_usage.part_of_speech}] ` : ""}${meaning}`,
        searchHay: normalizeText(`${w.hanzi} ${w.pinyin} ${meaning} ${w.collocations?.join(" ") || ""}`),
        speak: w.hanzi,
        action: () => {
          location.hash = `#lesson/${lesson.id}`;
          setTimeout(() => showVocabDetailPanel(w), 120);
        }
      });
    }
    // 2. Ngữ pháp 3 Giáo trình
    for (const g of lesson.grammar || []) {
      const title = g.title || g.point || "";
      const summary = g.explanation || g.summary || "";
      items.push({
        group: "grammar",
        groupLabel: "Ngữ pháp",
        badge: `${lesson.textbook} · Bài ${lesson.lesson_number}`,
        title,
        sub: g.formula || "",
        desc: summary.slice(0, 110) + (summary.length > 110 ? "…" : ""),
        searchHay: normalizeText(`${title} ${g.formula || ""} ${summary}`),
        action: () => {
          location.hash = `#lesson/${lesson.id}/grammar`;
        }
      });
    }
  }

  // 3. Từ vựng QUYỂN 4 (1.000 từ / 50 bài)
  for (const w of store.getHsk30L4Vocab()) {
    const meaning = w.lesson_usage?.meaning || "";
    items.push({
      group: "quyen4_vocab",
      groupLabel: "QUYỂN 4",
      badge: `QUYỂN 4 · Bài ${w.lesson}`,
      title: w.hanzi,
      sub: w.pinyin,
      desc: `${w.lesson_usage?.part_of_speech ? `[${w.lesson_usage.part_of_speech}] ` : ""}${meaning}`,
      searchHay: normalizeText(`${w.hanzi} ${w.pinyin} ${meaning} ${(w.collocations || []).join(" ")}`),
      speak: w.hanzi,
      action: () => {
        showVocabDetailPanel(w);
      }
    });
  }

  // 4. 7 Trạm nâng cao (149 mục)
  for (const st of store.stations || []) {
    for (const pkg of st.packages || []) {
      for (const it of pkg.items || []) {
        let title = "";
        let sub = "";
        let desc = "";
        let speak = "";
        if (st.kind === "synonyms") {
          title = it.pair_title;
          desc = it.vietnamese_explanation || "";
        } else if (st.kind === "grammar") {
          title = it.title;
          sub = it.formula || "";
          desc = (it.explanation || "").slice(0, 110) + "…";
        } else if (st.kind === "idioms") {
          title = it.hanzi;
          sub = it.pinyin;
          desc = it.meaning_vi || "";
          speak = it.hanzi;
        } else if (st.kind === "polyphones") {
          title = `Chữ đa âm: ${it.char}`;
          sub = (it.readings || []).map((r) => r.pinyin).join(" / ");
          desc = (it.readings || []).map((r) => `${r.pinyin}: ${r.words}`).join(" · ");
          speak = it.char;
        } else if (st.kind === "confusable") {
          title = it.group_label;
          desc = (it.chars || []).map((c) => `${c.char} (${c.pinyin}): ${c.meaning}`).join(" · ");
        } else if (st.kind === "error_correction") {
          title = it.error_type;
          sub = it.correct_sentence || "";
          desc = `Sai: ${it.wrong_sentence || ""}`;
        } else if (st.kind === "reading") {
          title = `${it.title_zh} — ${it.title_vi}`;
          sub = it.difficulty || "";
          desc = (it.passage_vi || "").slice(0, 110) + "…";
        }
        if (!title) continue;
        items.push({
          group: "advanced",
          groupLabel: "Nâng cao",
          badge: `${st.icon} ${st.shortTitle}`,
          title,
          sub,
          desc,
          searchHay: normalizeText(`${title} ${sub} ${desc} ${pkg.title}`),
          speak,
          action: () => {
            location.hash = `#station/${st.id}/${pkg.id}`;
          }
        });
      }
    }
  }

  // 5. Kho phân tích Chữ Hán (1.492 chữ)
  for (const [ch, info] of Object.entries(store.hanziDb || {})) {
    items.push({
      group: "hanzi",
      groupLabel: "Chữ Hán",
      badge: `✍️ ${info.strokes || "?"} nét · Bộ ${info.radical || ""}`,
      title: ch,
      sub: info.pinyin || "",
      desc: info.basic_meaning || "",
      searchHay: normalizeText(`${ch} ${info.pinyin || ""} ${info.basic_meaning || ""} ${info.radical_name || ""}`),
      speak: ch,
      action: () => {
        showHanziAnalysis(ch);
      }
    });
  }

  searchIndex = items;
  return searchIndex;
}

export function openGlobalSearchModal() {
  const modal = document.getElementById("globalSearchModal");
  const body = document.getElementById("globalSearchBody");
  if (!modal || !body) return;

  const index = ensureSearchIndex();
  let query = "";
  let filterGroup = "all";

  const GROUPS = [
    { id: "all", label: "Tất cả" },
    { id: "textbook_vocab", label: "📖 Giáo trình" },
    { id: "quyen4_vocab", label: "📘 QUYỂN 4" },
    { id: "grammar", label: "🧩 Ngữ pháp" },
    { id: "advanced", label: "🚀 7 Trạm nâng cao" },
    { id: "hanzi", label: "✍️ Chữ Hán" }
  ];

  modal.hidden = false;

  function renderResultsOnly() {
    const resBox = body.querySelector("#gsResultsList");
    const countEl = body.querySelector("#gsCountInfo");
    if (!resBox || !countEl) return;

    const qNorm = normalizeText(query);
    if (!qNorm) {
      countEl.textContent = `Kho tra cứu sẵn sàng: ${index.length.toLocaleString("vi-VN")} mục (Chữ Hán, Pinyin không dấu hoặc Nghĩa tiếng Việt)`;
      resBox.innerHTML = `
        <div class="card card-cream" style="margin:0; padding:14px;">
          <strong>💡 Gợi ý tra nhanh:</strong>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
            ${["适合", "把", "尽管", "爱护", "半途而废", "好", "thoi quen", "quyet dinh"].map((s) => `
              <button type="button" class="btn-chip" data-gs-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>
            `).join("")}
          </div>
        </div>
      `;
      resBox.querySelectorAll("[data-gs-suggest]").forEach((btn) => {
        btn.addEventListener("click", () => {
          query = btn.dataset.gsSuggest;
          const inp = body.querySelector("#gsInput");
          if (inp) { inp.value = query; inp.focus(); }
          renderResultsOnly();
        });
      });
      return;
    }

    const qRaw = query.trim().toLowerCase();
    const matches = [];
    for (const item of index) {
      if (filterGroup !== "all" && item.group !== filterGroup) continue;
      if (!item.searchHay.includes(qNorm) && !item.title.toLowerCase().includes(qRaw)) continue;
      // Ưu tiên khớp chính xác chữ Hán hoặc đầu từ lên trên
      let rank = 10;
      if (item.title === query.trim()) rank = 0;
      else if (item.title.includes(query.trim())) rank = 2;
      else if (normalizeText(item.sub) === qNorm) rank = 3;
      else if (item.group === "textbook_vocab" || item.group === "advanced") rank = 5;
      matches.push({ item, rank });
    }
    matches.sort((a, b) => a.rank - b.rank);
    const top = matches.slice(0, 40);

    countEl.textContent = `Tìm thấy ${matches.length} kết quả${matches.length > 40 ? " (hiển thị 40 kết quả sát nhất)" : ""}`;

    if (!top.length) {
      resBox.innerHTML = `<div class="muted-sm" style="padding:14px; text-align:center;">Không tìm thấy mục nào khớp “<strong>${escapeHtml(query)}</strong>”. Thử từ ngắn hơn hoặc gõ Pinyin không dấu nhé!</div>`;
      return;
    }

    resBox.innerHTML = top.map(({ item }, idx) => `
      <div class="gs-row" data-gs-hit="${idx}" style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; border:1px solid var(--border); background:#fff; margin-bottom:7px; cursor:pointer;">
        <div style="min-width:0; flex:1;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="badge badge-mint" style="font-size:0.74rem;">${escapeHtml(item.badge)}</span>
            <strong class="zh" style="font-size:1.1rem; color:var(--green-800);">${escapeHtml(item.title)}</strong>
            ${item.sub ? `<span class="pinyin" style="font-size:0.84rem;">${escapeHtml(item.sub)}</span>` : ""}
          </div>
          ${item.desc ? `<div class="muted-sm" style="margin-top:3px; font-size:0.84rem;">${escapeHtml(item.desc)}</div>` : ""}
        </div>
        <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
          ${item.speak ? `<button type="button" class="icon-btn" style="width:28px; height:28px;" data-gs-speak="${escapeHtml(item.speak)}" title="Nghe (TTS)">🔊</button>` : ""}
          <span class="badge badge-gray" style="font-size:0.74rem;">Mở →</span>
        </div>
      </div>
    `).join("");

    resBox.querySelectorAll("[data-gs-speak]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        audioManager.speak(btn.dataset.gsSpeak);
      });
    });

    resBox.querySelectorAll("[data-gs-hit]").forEach((row) => {
      row.addEventListener("click", () => {
        const hit = top[Number(row.dataset.gsHit)]?.item;
        modal.hidden = true;
        hit?.action?.();
      });
    });
  }

  body.innerHTML = `
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
      <input type="search" id="gsInput" class="search-input" placeholder="Gõ chữ Hán, Pinyin (vd: shihe) hoặc nghĩa Việt (vd: thich hop)..." style="flex:1; font-size:1rem; padding:11px 14px;" autocomplete="off" />
    </div>
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
      ${GROUPS.map((g) => `<button type="button" class="btn-chip ${filterGroup === g.id ? "active" : ""}" data-gs-group="${g.id}">${g.label}</button>`).join("")}
    </div>
    <div id="gsCountInfo" class="muted-sm" style="margin-bottom:8px; font-size:0.82rem;"></div>
    <div id="gsResultsList" style="max-height:54vh; overflow-y:auto; padding-right:2px;"></div>
  `;

  const inp = body.querySelector("#gsInput");
  inp?.addEventListener("input", (e) => {
    query = e.target.value;
    renderResultsOnly();
  });
  body.querySelectorAll("[data-gs-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      filterGroup = btn.dataset.gsGroup;
      body.querySelectorAll("[data-gs-group]").forEach((b) => b.classList.toggle("active", b.dataset.gsGroup === filterGroup));
      renderResultsOnly();
    });
  });

  renderResultsOnly();
  setTimeout(() => inp?.focus(), 30);
}
