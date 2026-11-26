// Khu vực KIẾN THỨC NÂNG CAO 高级知识 – 7 Trạm chuyên đề độc lập

import { store } from "../store.js";
import { audioManager } from "../audio.js";
import { renderExerciseSet } from "../exerciseEngine.js";
import { escapeHtml, makeClickableHanzi, LESSON_STATUS_LABELS, showToast } from "../mascots.js";

export function renderAdvancedHubView(container) {
  container.innerHTML = `
    <div class="card card-mint">
      <h2>🚀 KIẾN THỨC NÂNG CAO <span class="zh">高级知识</span> – 7 TRẠM CHUYÊN ĐỀ</h2>
      <p class="muted-sm">
        Xây dựng độc lập theo từng chủ điểm trọng tâm ôn thi Chuyên Trung, học song song với 3 giáo trình HSK 4–5. Mỗi trạm gồm các gói chuyên đề nhỏ (5–8 đơn vị chất lượng cao), đầy đủ lý thuyết, mẹo nhớ, lỗi dễ mắc, bài tập 3 mức độ và kiểm tra tổng hợp.
      </p>
    </div>

    <div class="grid-2">
      ${store.stations.map((st, idx) => {
        const done = st.packages.filter((p) => store.getPackageStatus(p.id) === "completed").length;
        const pct = st.packages.length ? Math.round((done / st.packages.length) * 100) : 0;
        return `
          <a href="#station/${st.id}" class="station-card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="badge badge-mint">TRẠM ${idx + 1}</span>
              <span class="badge badge-gray">${done}/${st.packages.length} gói hoàn thành</span>
            </div>
            <h3 style="margin:2px 0;">${st.icon} ${escapeHtml(st.title_vi)}</h3>
            <div class="zh muted-sm" style="font-size:0.95rem; font-weight:600;">${escapeHtml(st.title_zh)}</div>
            <p class="muted-sm">${escapeHtml(st.description)}</p>
            <div class="progress-track" style="height:7px;"><div class="progress-fill" style="width:${pct}%"></div></div>
          </a>
        `;
      }).join("")}
    </div>
  `;
}

export function renderStationDetailView(container, stationId, initialPkgId = null) {
  const station = store.stations.find((s) => s.id === stationId);
  if (!station) {
    container.innerHTML = `<div class="card">Không tìm thấy trạm kiến thức. <a href="#advanced" class="btn btn-sm btn-primary">Quay lại</a></div>`;
    return;
  }

  let selectedPkgId = (initialPkgId && station.packages.some((p) => p.id === initialPkgId))
    ? initialPkgId
    : (station.packages[0]?.id || null);
  let subTab = "learn"; // learn | practice | summary_test

  function render() {
    const pkg = station.packages.find((p) => p.id === selectedPkgId) || station.packages[0];
    const pkgSt = pkg ? store.getPackageStatus(pkg.id) : "not_started";

    container.innerHTML = `
      <div class="card card-mint">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
          <div>
            <a href="#advanced" class="btn btn-sm btn-outline" style="margin-bottom:8px;">← Về 7 Trạm nâng cao</a>
            <h2>${station.icon} ${escapeHtml(station.title_vi)} <span class="zh">${escapeHtml(station.title_zh)}</span></h2>
            <p class="muted-sm">${escapeHtml(station.description)}</p>
          </div>
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
          ${station.packages.map((p) => {
            const st = store.getPackageStatus(p.id);
            return `
              <button class="btn-chip ${p.id === pkg.id ? "active" : ""}" data-select-pkg="${p.id}">
                ${escapeHtml(p.title)} · ${LESSON_STATUS_LABELS[st]}
              </button>
            `;
          }).join("")}
        </div>
      </div>

      ${pkg ? `
        <div class="card">
          <div class="section-header">
            <div>
              <h3>${escapeHtml(pkg.title)}</h3>
              <p class="muted-sm">${escapeHtml(pkg.intro)}</p>
            </div>
            <select class="select-input status-${pkgSt}" id="pkgStatusSel">
              ${Object.entries(LESSON_STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${pkgSt === k ? "selected" : ""}>${v}</option>`).join("")}
            </select>
          </div>

          <div class="tabs-bar">
            <button class="tab-btn ${subTab === "learn" ? "active" : ""}" data-st-tab="learn">📘 Kiến thức & Phân tích (${pkg.items.length} mục)</button>
            <button class="tab-btn ${subTab === "practice" ? "active" : ""}" data-st-tab="practice">✍️ Bài tập 3 mức độ (${(pkg.exercises || []).length} câu)</button>
            ${station.comprehensive_test?.length ? `<button class="tab-btn ${subTab === "summary_test" ? "active" : ""}" data-st-tab="summary_test">🏆 Kiểm tra tổng hợp trạm (${station.comprehensive_test.length} câu)</button>` : ""}
          </div>

          <div id="stationContentArea"></div>
        </div>
      ` : ""}
    `;

    container.querySelectorAll("[data-select-pkg]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedPkgId = btn.dataset.selectPkg;
        subTab = "learn";
        render();
      });
    });

    container.querySelector("#pkgStatusSel")?.addEventListener("change", (e) => {
      store.setPackageStatus(pkg.id, e.target.value);
      showToast(`Đã cập nhật tiến độ chuyên đề: ${LESSON_STATUS_LABELS[e.target.value]}`);
      render();
    });

    container.querySelectorAll("[data-st-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        subTab = btn.dataset.stTab;
        render();
      });
    });

    const area = container.querySelector("#stationContentArea");
    if (subTab === "learn") {
      renderPackageItems(area, station.kind, pkg);
    } else if (subTab === "practice") {
      renderExerciseSet(area, pkg.exercises || [], {
        title: `Thực hành: ${pkg.title}`,
        category: "Kiến thức nâng cao",
        sourceRef: `${station.shortTitle} – ${pkg.title}`,
        testType: "advanced_practice"
      });
    } else if (subTab === "summary_test") {
      renderExerciseSet(area, station.comprehensive_test || [], {
        title: `Kiểm tra tổng hợp: ${station.title_vi}`,
        category: "Kiến thức nâng cao",
        sourceRef: station.shortTitle,
        testType: "advanced_comprehensive"
      });
    }
  }

  render();
}

function renderPackageItems(area, kind, pkg) {
  let html = "";
  if (kind === "synonyms") {
    html = pkg.items.map((it, i) => `
      <div class="card card-cream" style="margin-bottom:14px;">
        <h4>${i + 1}. Nhóm cận nghĩa: <span class="zh">${makeClickableHanzi(it.pair_title)}</span></h4>
        <p>${escapeHtml(it.vietnamese_explanation)}</p>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr><th>Từ</th><th>Nghĩa & Từ loại</th><th>Điểm khác biệt</th><th>Cách kết hợp</th><th>Ví dụ</th></tr></thead>
            <tbody>
              ${it.comparison_rows.map((r) => `
                <tr>
                  <td><strong class="zh" style="font-size:1.1rem;">${makeClickableHanzi(r.word)}</strong><div class="pinyin" style="font-size:0.82rem;">${escapeHtml(r.pinyin)}</div></td>
                  <td><span class="badge badge-mint">${escapeHtml(r.pos)}</span><div>${escapeHtml(r.meaning)}</div></td>
                  <td>${escapeHtml(r.difference)}</td>
                  <td class="zh">${escapeHtml(r.collocations)}</td>
                  <td>
                    <div class="zh">${makeClickableHanzi(r.example_zh)}</div>
                    <div class="pinyin" style="font-size:0.8rem;">${escapeHtml(r.example_py)}</div>
                    <div class="muted-sm">${escapeHtml(r.example_vi)}</div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        <div class="usage-block-lesson" style="margin-top:10px;">
          <strong>🎯 Tại sao dùng A mà không dùng B?</strong> ${escapeHtml(it.context_rule)}
        </div>
        <div class="muted-sm" style="margin-top:6px;"><strong>💡 Mẹo ghi nhớ:</strong> ${escapeHtml(it.memory_tip)}</div>
        <div style="color:var(--coral-700); font-size:0.88rem; margin-top:4px;"><strong>⚠ Lỗi thường gặp:</strong> ${escapeHtml(it.common_error)}</div>
      </div>
    `).join("");
  } else if (kind === "grammar") {
    html = pkg.items.map((it, i) => `
      <div class="card" style="margin-bottom:14px;">
        <h4>${i + 1}. ${escapeHtml(it.title)}</h4>
        <div class="usage-block-lesson"><strong>Công thức:</strong> <span class="zh" style="font-weight:700;">${escapeHtml(it.formula)}</span></div>
        <p style="margin-top:8px;">${escapeHtml(it.explanation)}</p>
        ${(it.examples || []).map((ex) => `
          <div class="example-box">
            <div class="zh">${makeClickableHanzi(ex.chinese)}</div>
            <div class="pinyin" style="font-size:0.84rem;">${escapeHtml(ex.pinyin)}</div>
            <div class="muted-sm">${escapeHtml(ex.vietnamese)}</div>
          </div>
        `).join("")}
        <div class="muted-sm" style="margin-top:8px;"><strong>⚖ So sánh dễ nhầm:</strong> ${escapeHtml(it.comparison)}</div>
        <div class="muted-sm" style="margin-top:4px;"><strong>💡 Mẹo nhớ:</strong> ${escapeHtml(it.memory_tip)}</div>
        <div style="color:var(--coral-700); font-size:0.88rem; margin-top:4px;"><strong>⚠ Lỗi thường gặp:</strong> ${escapeHtml(it.common_error)}</div>
      </div>
    `).join("");
  } else if (kind === "idioms") {
    html = pkg.items.map((it, i) => `
      <div class="card" style="margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <span class="badge ${it.subtype === "成语" ? "badge-mint" : "badge-yellow"}">${it.subtype === "成语" ? "Thành ngữ 成语" : "Quán dụng ngữ 惯用语"}</span>
            <strong class="zh" style="font-size:1.35rem; margin-left:8px;">${makeClickableHanzi(it.hanzi)}</strong>
            <span class="pinyin" style="margin-left:6px;">${escapeHtml(it.pinyin)}</span>
          </div>
          <button class="btn btn-sm btn-outline" data-speak="${escapeHtml(it.hanzi)}">🔊 Nghe (TTS)</button>
        </div>
        <p style="margin-top:8px;"><strong>Nghĩa tiếng Việt:</strong> ${escapeHtml(it.meaning_vi)}</p>
        <p class="muted-sm"><strong>Giải thích tiếng Trung:</strong> <span class="zh">${escapeHtml(it.meaning_zh)}</span></p>
        <p style="margin-top:6px;"><strong>Sắc thái & Cách dùng:</strong> ${escapeHtml(it.nuance)} · ${escapeHtml(it.usage)}</p>
        <div class="example-box">
          <div class="zh">${makeClickableHanzi(it.example.chinese)}</div>
          <div class="pinyin" style="font-size:0.84rem;">${escapeHtml(it.example.pinyin)}</div>
          <div class="muted-sm">${escapeHtml(it.example.vietnamese)}</div>
        </div>
        <div class="muted-sm" style="margin-top:6px;"><strong>💡 Mẹo nhớ:</strong> ${escapeHtml(it.memory_tip)}</div>
        <div style="color:var(--coral-700); font-size:0.88rem; margin-top:4px;"><strong>⚠ Lỗi dùng sai:</strong> ${escapeHtml(it.common_error)}</div>
      </div>
    `).join("");
  } else if (kind === "polyphones") {
    html = pkg.items.map((it, i) => `
      <div class="card" style="margin-bottom:14px;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <span class="vocab-hanzi">${makeClickableHanzi(it.char)}</span>
          <div>
            <strong>Chữ đa âm #${i + 1} (Chuẩn Phổ thông Đại lục)</strong>
            <div class="muted-sm">${escapeHtml(it.why_diff)}</div>
          </div>
        </div>
        <table class="data-table">
          <thead><tr><th>Cách đọc (Pinyin)</th><th>Từ loại & Nghĩa</th><th>Từ ghép tiêu biểu</th><th>Câu ví dụ</th></tr></thead>
          <tbody>
            ${it.readings.map((r) => `
              <tr>
                <td><strong class="pinyin" style="font-size:1.05rem;">${escapeHtml(r.pinyin)}</strong></td>
                <td>${escapeHtml(r.meaning)}</td>
                <td class="zh">${makeClickableHanzi(r.words)}</td>
                <td>
                  <div class="zh">${makeClickableHanzi(r.example_zh)}</div>
                  <div class="muted-sm">${escapeHtml(r.example_vi)}</div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="muted-sm" style="margin-top:8px;"><strong>💡 Mẹo phân biệt nhanh:</strong> ${escapeHtml(it.memory_tip)}</div>
      </div>
    `).join("");
  } else if (kind === "confusable") {
    html = pkg.items.map((it, i) => `
      <div class="card" style="margin-bottom:14px;">
        <h4>${i + 1}. Nhóm chữ dễ nhầm: <span class="zh" style="font-size:1.4rem;">${makeClickableHanzi(it.group_label)}</span></h4>
        <div class="grid-2" style="margin-top:8px;">
          ${it.chars.map((c) => `
            <div style="background:var(--bg-soft); border:1.5px solid var(--border); border-radius:14px; padding:12px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span class="vocab-hanzi" style="font-size:2.1rem;">${makeClickableHanzi(c.char)}</span>
                <div>
                  <div class="pinyin" style="font-size:1rem;">${escapeHtml(c.pinyin)}</div>
                  <div><strong>${escapeHtml(c.meaning)}</strong></div>
                </div>
              </div>
              <div class="muted-sm" style="margin-top:6px;"><strong>Điểm cấu tạo:</strong> ${escapeHtml(c.structure_diff)}</div>
              <div class="muted-sm" style="margin-top:4px;"><strong>Từ ghép:</strong> <span class="zh">${makeClickableHanzi(c.examples)}</span></div>
            </div>
          `).join("")}
        </div>
        <div class="usage-block-lesson" style="margin-top:10px;"><strong>💡 Mẹo ghi nhớ trực quan:</strong> ${escapeHtml(it.memory_tip)}</div>
      </div>
    `).join("");
  } else if (kind === "error_correction") {
    html = pkg.items.map((it, i) => `
      <div class="card" style="margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
          <strong>Mẫu lỗi #${i + 1}</strong>
          <span class="badge badge-coral">${escapeHtml(it.error_type)}</span>
        </div>
        <div class="feedback-box feedback-err" style="margin-top:4px;">
          <strong>✗ Câu sai:</strong> <span class="zh">${makeClickableHanzi(it.wrong_sentence)}</span>
          <div class="muted-sm" style="color:#7f1d1d; margin-top:3px;"><strong>Phần sai cần nhận diện:</strong> ${escapeHtml(it.error_part)}</div>
        </div>
        <div class="feedback-box feedback-ok" style="margin-top:8px;">
          <strong>✓ Câu sửa đúng:</strong> <span class="zh">${makeClickableHanzi(it.correct_sentence)}</span>
          <div class="pinyin" style="font-size:0.84rem;">${escapeHtml(it.pinyin)}</div>
          <div class="muted-sm">${escapeHtml(it.vietnamese)}</div>
        </div>
        <div style="margin-top:8px; font-size:0.9rem;">
          <div><strong>Giải thích lỗi:</strong> ${escapeHtml(it.explanation)}</div>
          <div style="margin-top:4px;"><strong>📌 Quy tắc ghi nhớ:</strong> ${escapeHtml(it.rule)}</div>
          <div class="muted-sm" style="margin-top:4px;"><strong>Câu luyện tương tự:</strong> <span class="zh">${escapeHtml(it.similar_practice)}</span></div>
        </div>
      </div>
    `).join("");
  } else if (kind === "reading") {
    html = pkg.items.map((it, i) => `
      <div class="card" style="margin-bottom:14px;">
        <div class="section-header">
          <div>
            <span class="badge badge-blue">Mức độ: ${escapeHtml(it.difficulty)}</span>
            <h4 style="margin-top:5px;">Bài đọc ${i + 1}: <span class="zh">${escapeHtml(it.title_zh)}</span> — ${escapeHtml(it.title_vi)}</h4>
          </div>
          <button class="btn btn-sm btn-primary" data-speak="${escapeHtml(it.passage_zh)}">🔊 Nghe đoạn văn (TTS)</button>
        </div>
        <div class="card card-mint" style="padding:14px;">
          <div class="zh" style="font-size:1.05rem; line-height:1.85;">${makeClickableHanzi(it.passage_zh)}</div>
        </div>
        <details style="margin-bottom:8px;">
          <summary style="cursor:pointer; color:var(--green-600); font-weight:600;">Xem Pinyin & Bản dịch tiếng Việt</summary>
          <div class="example-box">
            <div class="pinyin" style="font-size:0.86rem;">${escapeHtml(it.passage_py)}</div>
            <div style="margin-top:6px;">${escapeHtml(it.passage_vi)}</div>
          </div>
        </details>
        <div style="margin-bottom:8px;">
          <strong>Từ vựng cốt lõi:</strong>
          ${it.key_vocab.map((kv) => `<span class="collocation-pill"><strong class="zh">${makeClickableHanzi(kv.zh)}</strong> (${escapeHtml(kv.py)}): ${escapeHtml(kv.vi)}</span>`).join("")}
        </div>
        <div class="muted-sm"><strong>💡 Ghi chú chiến thuật đọc & diễn đạt:</strong> ${escapeHtml(it.strategy_note)}</div>
      </div>
    `).join("");
  }

  area.innerHTML = html + `
    ${pkg.package_notes ? `
      <div class="card card-yellow" style="margin-bottom:0;">
        <strong>📌 Tổng kết gói chuyên đề:</strong> ${escapeHtml(pkg.package_notes)}
      </div>
    ` : ""}
  `;

  area.querySelectorAll("[data-speak]").forEach((btn) => {
    btn.addEventListener("click", () => audioManager.speak(btn.dataset.speak));
  });
}
