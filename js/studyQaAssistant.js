// Trợ lý Hỏi Đáp Kiến Thức Nội Bộ (CHỈ trả lời từ dữ liệu đã nạp trên website!)
// Nguồn duy nhất: 38 bài HSK 4上/4下/5上 · 1.000 từ QUYỂN 4 · 7 Trạm nâng cao · 1.492 chữ Hán.

import { store } from "./store.js";
import { audioManager } from "./audio.js";
import { escapeHtml } from "./mascots.js";

function norm(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\/\//g, "")
    .replace(/ü/g, "v")
    .replace(/[?!.,;:'"“”‘’()（）【】\[\]—\-·/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractChineseTokens(text = "") {
  return (String(text).match(/[\u4e00-\u9fff]+/g) || []).filter(Boolean);
}

const STOP_WORDS = new Set([
  "la", "gi", "cua", "va", "voi", "cho", "minh", "em", "con", "toi", "hoi", "ve",
  "cach", "dung", "nghia", "phan", "biet", "khac", "nhau", "giua", "tu", "chu",
  "cau", "ngu", "phap", "bai", "hoc", "nao", "sao", "the", "co", "khong", "trong",
  "tieng", "trung", "han", "giai", "thich", "vi", "du", "nhu", "hay", "hoac",
  "thanh", "da", "am", "de", "nham", "loi", "sai", "tra", "xem", "net", "bo",
  "quyen", "tram", "nang", "cao", "can", "ban", "vui", "long", "giup", "o", "dau", "ai", "tai"
]);

function hasWholeWord(normHay, word) {
  return (` ${normHay} `).includes(` ${word} `);
}

function extractMeaningfulTerms(rawQuery) {
  const zhTokens = extractChineseTokens(rawQuery);
  const n = norm(rawQuery);
  const words = n.split(" ").filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  return { zhTokens, words, normFull: n };
}

/**
 * Tìm kiếm & tổng hợp câu trả lời CHỈ từ kho kiến thức đã tải lên website
 */
export function answerFromWebsiteKnowledge(rawQuery) {
  const q = String(rawQuery || "").trim();
  if (!q) return null;

  const { zhTokens, words, normFull } = extractMeaningfulTerms(q);
  const isCompareIntent = /(phan biet|khac nhau|khac gi|so sanh|\bvs\b|nham)/.test(normFull) || zhTokens.length >= 2;
  const isGrammarIntent = /(ngu phap|cau truc|cach dung|bo ngu|lien tu|cau chu|cau bi dong|cau ton hien|cau kiem ngu|cau phuc|phan van|luong tu|lap tu|hu tu|pho tu|gioi tu|tro tu)/.test(normFull);
  const isPolyphoneIntent = /(da am|doc la|thanh dieu|phat am|pinyin)/.test(normFull);
  const isIdiomIntent = /(thanh ngu|quan dung)/.test(normFull);
  const isErrorIntent = /(loi sai|sua loi|benh cau|sai o dau)/.test(normFull);
  const isHanziIntent = /(bo thu|so net|viet net|ket cau|chu han)/.test(normFull);

  const hits = [];
  const joinedWords = words.join(" ");

  function scoreMatch(hayRaw, titleRaw, exactTarget = "") {
    const hay = norm(hayRaw);
    const title = norm(titleRaw);
    let sc = 0;

    if (exactTarget && q === exactTarget) sc += 120;
    for (const z of zhTokens) {
      if (titleRaw.includes(z)) sc += 55;
      else if (hayRaw.includes(z)) sc += 28;
    }
    if (!zhTokens.length && words.length) {
      let matched = 0;
      let titleMatched = 0;
      for (const w of words) {
        if (hasWholeWord(title, w)) { sc += 28; matched++; titleMatched++; }
        else if (hasWholeWord(hay, w)) { sc += 14; matched++; }
      }
      if (joinedWords.length >= 4 && (` ${hay} `).includes(` ${joinedWords} `)) {
        sc += 40;
      }
      // Bắt buộc khớp nghiêm ngặt toàn bộ từ khóa (hoặc >= 80% khi câu hỏi dài >= 3 từ) để tuyệt đối không trả lời sai chủ đề ngoài web!
      const minNeeded = words.length <= 2 ? words.length : Math.ceil(words.length * 0.8);
      if (matched < minNeeded) return 0;
      if (words.length >= 2 && titleMatched === 0 && !(` ${hay} `).includes(` ${joinedWords} `)) return 0;
    }
    return sc;
  }

  // 1. Trạm 1 (Từ cận nghĩa) & Bảng so sánh 比一比 / 词语辨析 trong 38 bài
  const st1 = store.stations.find((s) => s.id === "station1");
  for (const pkg of st1?.packages || []) {
    for (const it of pkg.items || []) {
      const hay = `${it.pair_title} ${it.vietnamese_explanation} ${it.context_rule} ${(it.comparison_rows || []).map((r) => `${r.word} ${r.pinyin} ${r.meaning}`).join(" ")}`;
      let sc = scoreMatch(hay, it.pair_title);
      if (sc > 0 && isCompareIntent) sc += 30;
      if (zhTokens.length >= 2 && zhTokens.every((z) => it.pair_title.includes(z))) sc += 80;
      if (sc >= 28) {
        hits.push({
          score: sc,
          tag: "⚖️ Trạm 1 · Từ cận nghĩa",
          title: it.pair_title,
          summary: it.vietnamese_explanation,
          details: [
            ...(it.comparison_rows || []).map((r) => `• ${r.word} (${r.pinyin} – ${r.pos}): ${r.meaning}. ${r.difference}`),
            it.context_rule ? `🎯 Phân biệt nhanh: ${it.context_rule}` : "",
            it.memory_tip ? `💡 Mẹo nhớ: ${it.memory_tip}` : ""
          ].filter(Boolean),
          linkHash: `#station/station1/${pkg.id}`,
          linkLabel: "Mở Trạm 1 →"
        });
      }
    }
  }

  // 2. Trạm 2 (Ngữ pháp chuyên sâu)
  const st2 = store.stations.find((s) => s.id === "station2");
  for (const pkg of st2?.packages || []) {
    for (const it of pkg.items || []) {
      const hay = `${it.title} ${it.formula} ${it.explanation} ${it.comparison || ""} ${it.memory_tip || ""}`;
      let sc = scoreMatch(hay, `${it.title} ${it.formula}`);
      if (sc > 0 && isGrammarIntent) sc += 25;
      if (sc >= 28) {
        const ex0 = it.examples?.[0];
        hits.push({
          score: sc,
          tag: "🧩 Trạm 2 · Ngữ pháp chuyên sâu",
          title: it.title,
          summary: it.formula ? `Công thức: ${it.formula}` : it.explanation,
          details: [
            it.explanation,
            ex0 ? `Ví dụ: ${ex0.chinese} (${ex0.vietnamese})` : "",
            it.memory_tip ? `💡 Mẹo nhớ: ${it.memory_tip}` : ""
          ].filter(Boolean),
          linkHash: `#station/station2/${pkg.id}`,
          linkLabel: "Mở Trạm 2 →"
        });
      }
    }
  }

  // 3. Trạm 3 (Thành ngữ & Quán dụng ngữ)
  const st3 = store.stations.find((s) => s.id === "station3");
  for (const pkg of st3?.packages || []) {
    for (const it of pkg.items || []) {
      const hay = `${it.hanzi} ${it.pinyin} ${it.meaning_vi} ${it.usage} ${it.memory_tip}`;
      let sc = scoreMatch(hay, `${it.hanzi} ${it.pinyin}`, it.hanzi);
      if (sc > 0 && isIdiomIntent) sc += 25;
      if (sc >= 28) {
        hits.push({
          score: sc,
          tag: `🏮 Trạm 3 · ${it.subtype === "成语" ? "Thành ngữ" : "Quán dụng ngữ"}`,
          title: `${it.hanzi} (${it.pinyin})`,
          summary: it.meaning_vi,
          details: [
            `Cách dùng: ${it.nuance} ${it.usage}`,
            it.example ? `Ví dụ: ${it.example.chinese} (${it.example.vietnamese})` : "",
            it.common_error ? `⚠ Lưu ý: ${it.common_error}` : ""
          ].filter(Boolean),
          speak: it.hanzi,
          linkHash: `#station/station3/${pkg.id}`,
          linkLabel: "Mở Trạm 3 →"
        });
      }
    }
  }

  // 4. Trạm 4 (Chữ đa âm)
  const st4 = store.stations.find((s) => s.id === "station4");
  for (const pkg of st4?.packages || []) {
    for (const it of pkg.items || []) {
      const hay = `${it.char} ${it.why_diff} ${(it.readings || []).map((r) => `${r.pinyin} ${r.words} ${r.meaning}`).join(" ")}`;
      let sc = scoreMatch(hay, it.char, it.char);
      if (sc > 0 && isPolyphoneIntent) sc += 35;
      if (sc >= 30) {
        hits.push({
          score: sc,
          tag: "🔊 Trạm 4 · Chữ đa âm",
          title: `Chữ đa âm “${it.char}”`,
          summary: it.why_diff,
          details: [
            ...(it.readings || []).map((r) => `• ${r.pinyin}: ${r.meaning} (VD: ${r.words})`),
            it.memory_tip ? `💡 Mẹo phân biệt: ${it.memory_tip}` : ""
          ].filter(Boolean),
          speak: it.char,
          linkHash: `#station/station4/${pkg.id}`,
          linkLabel: "Mở Trạm 4 →"
        });
      }
    }
  }

  // 5. Trạm 5 (Chữ Hán dễ nhầm)
  const st5 = store.stations.find((s) => s.id === "station5");
  for (const pkg of st5?.packages || []) {
    for (const it of pkg.items || []) {
      const hay = `${it.group_label} ${(it.chars || []).map((c) => `${c.char} ${c.pinyin} ${c.meaning} ${c.examples}`).join(" ")} ${it.memory_tip}`;
      let sc = scoreMatch(hay, it.group_label);
      if (sc > 0 && (isCompareIntent || isHanziIntent)) sc += 25;
      if (zhTokens.length >= 2 && zhTokens.every((z) => it.group_label.includes(z))) sc += 80;
      if (sc >= 30) {
        hits.push({
          score: sc,
          tag: "🔍 Trạm 5 · Chữ Hán dễ nhầm",
          title: `Nhóm chữ dễ nhầm: ${it.group_label}`,
          summary: it.memory_tip,
          details: (it.chars || []).map((c) => `• ${c.char} (${c.pinyin}): ${c.meaning} — ${c.structure_diff} (VD: ${c.examples})`),
          linkHash: `#station/station5/${pkg.id}`,
          linkLabel: "Mở Trạm 5 →"
        });
      }
    }
  }

  // 6. Trạm 6 (Sửa lỗi sai)
  const st6 = store.stations.find((s) => s.id === "station6");
  for (const pkg of st6?.packages || []) {
    for (const it of pkg.items || []) {
      const hay = `${it.error_type} ${it.wrong_sentence} ${it.correct_sentence} ${it.explanation} ${it.rule}`;
      let sc = scoreMatch(hay, `${it.error_type} ${it.wrong_sentence}`);
      if (sc > 0 && isErrorIntent) sc += 30;
      if (sc >= 30) {
        hits.push({
          score: sc,
          tag: "🩺 Trạm 6 · Luyện sửa lỗi sai",
          title: it.error_type,
          summary: `✗ Sai: ${it.wrong_sentence}  →  ✓ Đúng: ${it.correct_sentence}`,
          details: [
            it.explanation,
            it.rule ? `📌 Quy tắc: ${it.rule}` : ""
          ].filter(Boolean),
          linkHash: `#station/station6/${pkg.id}`,
          linkLabel: "Mở Trạm 6 →"
        });
      }
    }
  }

  // 7. 38 Bài giáo trình (Từ vựng, Ngữ pháp, So sánh 比一比)
  for (const lesson of store.getAllLoadedLessons()) {
    for (const w of lesson.vocabulary || []) {
      const meaning = w.lesson_usage?.meaning || "";
      const hay = `${w.hanzi} ${w.pinyin} ${meaning} ${(w.collocations || []).join(" ")}`;
      let sc = scoreMatch(hay, `${w.hanzi} ${w.pinyin}`, w.hanzi);
      if (zhTokens.includes(w.hanzi)) sc += 35;
      if (sc >= 32) {
        const ex0 = w.lesson_usage?.examples?.[0];
        hits.push({
          score: sc,
          tag: `📖 ${lesson.textbook} · Bài ${lesson.lesson_number}`,
          title: `${w.hanzi} (${w.pinyin})`,
          summary: `[${w.lesson_usage?.part_of_speech || ""}] ${meaning}`,
          details: [
            w.lesson_usage?.explanation || "",
            ex0 ? `Ví dụ: ${ex0.chinese} — ${ex0.vietnamese}` : "",
            w.collocations?.length ? `Kết hợp từ: ${w.collocations.slice(0, 4).join(" · ")}` : "",
            w.common_errors ? `⚠ Lưu ý: ${w.common_errors}` : ""
          ].filter(Boolean),
          speak: w.hanzi,
          linkHash: `#lesson/${lesson.id}`,
          linkLabel: `Vào ${lesson.textbook} Bài ${lesson.lesson_number} →`
        });
      }
    }
    for (const g of lesson.grammar || []) {
      const gTitle = g.title || g.point || "";
      const hay = `${gTitle} ${g.formula || ""} ${g.explanation || ""}`;
      let sc = scoreMatch(hay, gTitle);
      if (sc > 0 && isGrammarIntent) sc += 25;
      if (sc >= 32) {
        const ex0 = g.examples?.[0];
        hits.push({
          score: sc,
          tag: `📘 Ngữ pháp · ${lesson.textbook} Bài ${lesson.lesson_number}`,
          title: gTitle,
          summary: g.formula ? `Cấu trúc: ${g.formula}` : (g.explanation || ""),
          details: [
            g.explanation || "",
            ex0 ? `Ví dụ: ${ex0.chinese} (${ex0.vietnamese})` : ""
          ].filter(Boolean),
          linkHash: `#lesson/${lesson.id}/grammar`,
          linkLabel: `Xem ngữ pháp Bài ${lesson.lesson_number} →`
        });
      }
    }
    for (const c of lesson.comparisons || []) {
      const cTitle = c.title || (c.words || []).join(" — ");
      const hay = `${cTitle} ${c.summary || ""} ${(c.points || []).map((p) => `${p.aspect} ${p.detail}`).join(" ")}`;
      let sc = scoreMatch(hay, cTitle);
      if (sc > 0 && isCompareIntent) sc += 30;
      if (zhTokens.length >= 2 && zhTokens.every((z) => cTitle.includes(z))) sc += 75;
      if (sc >= 32) {
        hits.push({
          score: sc,
          tag: `⚖️ So sánh sách · ${lesson.textbook} Bài ${lesson.lesson_number}`,
          title: cTitle,
          summary: c.summary || "",
          details: (c.points || []).slice(0, 3).map((p) => `• ${p.aspect}: ${p.detail}`),
          linkHash: `#lesson/${lesson.id}/grammar`,
          linkLabel: `Xem mục So sánh Bài ${lesson.lesson_number} →`
        });
      }
    }
  }

  // 8. 1.000 từ QUYỂN 4 (HSK 3.0 Cấp 4)
  for (const w of store.getHsk30L4Vocab()) {
    const meaning = w.lesson_usage?.meaning || "";
    const hay = `${w.hanzi} ${w.pinyin} ${meaning} ${(w.collocations || []).join(" ")}`;
    let sc = scoreMatch(hay, `${w.hanzi} ${w.pinyin}`, w.hanzi);
    if (zhTokens.includes(w.hanzi)) sc += 32;
    if (sc >= 32) {
      const exZh = w.lesson_usage?.example?.chinese || "";
      hits.push({
        score: sc,
        tag: `📘 QUYỂN 4 · Bài ${w.lesson}`,
        title: `${w.hanzi} (${w.pinyin})`,
        summary: `[${w.lesson_usage?.part_of_speech || ""}] ${meaning}`,
        details: [
          w.collocations?.length ? `Kết hợp từ: ${w.collocations.join(" · ")}` : "",
          exZh ? `Ví dụ QUYỂN 4: ${exZh}` : ""
        ].filter(Boolean),
        speak: w.hanzi,
        linkHash: "#quyen4",
        linkLabel: `Luyện QUYỂN 4 Bài ${w.lesson} →`
      });
    }
  }

  // 9. Kho phân tích Chữ Hán (1.492 chữ — khi hỏi 1 chữ đơn hoặc hỏi bộ thủ/số nét)
  const singleChars = zhTokens.join("").split("");
  if ((singleChars.length === 1) || (isHanziIntent && singleChars.length >= 1)) {
    const ch = singleChars[singleChars.length - 1];
    const info = store.hanziDb?.[ch];
    if (info) {
      hits.push({
        score: isHanziIntent ? 115 : 65,
        tag: "✍️ Phân tích Chữ Hán",
        title: `Chữ “${ch}” (${info.pinyin})`,
        summary: `Bộ thủ: ${info.radical} (${info.radical_name}) · ${info.strokes} nét · ${info.structure}`,
        details: [
          `Thành phần: ${info.components}`,
          `Nghĩa cơ bản: ${info.basic_meaning}`,
          info.common_words?.length ? `Từ thường gặp: ${info.common_words.slice(0, 4).map((x) => `${x.zh} (${x.vi})`).join(", ")}` : ""
        ].filter(Boolean),
        speak: ch,
        hanziChar: ch
      });
    }
  }

  // Sắp xếp điểm khớp cao nhất, khử trùng tiêu đề quá giống nhau và lấy tối đa 3 câu trả lời chất lượng nhất
  hits.sort((a, b) => b.score - a.score);
  const dedup = [];
  const seenKey = new Set();
  for (const h of hits) {
    const k = `${h.tag}|${h.title}`;
    if (seenKey.has(k)) continue;
    seenKey.add(k);
    dedup.push(h);
    if (dedup.length >= 3) break;
  }

  if (!dedup.length) {
    return {
      found: false,
      message: "Nội dung bạn hỏi hiện chưa có trong kho kiến thức đã tải lên website. Mình chỉ giải đáp các kiến thức thuộc 3 giáo trình HSK 4上–4下–5上, QUYỂN 4 (50 bài) và 7 Trạm nâng cao. Bạn thử gõ chính xác chữ Hán, Pinyin hoặc tên cấu trúc ngữ pháp trong bài nhé!"
    };
  }

  return {
    found: true,
    items: dedup
  };
}

/**
 * Gắn giao diện Trợ lý Hỏi Đáp kiến thức trên web vào Bảng Trợ lý Trang chủ
 */
export function mountStudyQaWidget(hostEl, { onInspectHanzi = null } = {}) {
  if (!hostEl) return;

  const history = []; // { q, res }
  const SUGGESTIONS = [
    "Phân biệt 适合 và 合适",
    "Cách dùng câu chữ 把",
    "Chữ đa âm 好",
    "尽管 khác 虽然 thế nào?",
    "Thành ngữ 半途而废",
    "Số nét chữ 爱"
  ];

  function submitQuery(raw) {
    const q = (raw || "").trim();
    if (!q) return;
    const res = answerFromWebsiteKnowledge(q);
    history.unshift({ q, res });
    if (history.length > 6) history.pop();
    render();
  }

  function render() {
    hostEl.innerHTML = `
      <div class="muted-sm" style="font-size:0.8rem; margin-bottom:8px;">
        Chỉ trả lời từ <strong>kiến thức đã tải lên web</strong> (38 bài HSK 4–5, 1.000 từ QUYỂN 4, 7 Trạm nâng cao & 1.492 chữ Hán).
      </div>

      <form id="qaAskForm" style="display:flex; gap:6px; margin-bottom:8px;">
        <input type="text" id="qaAskInput" class="text-input" placeholder="Hỏi từ vựng, ngữ pháp, cận nghĩa, đa âm..." style="flex:1; min-width:0; padding:8px 10px; font-size:0.86rem;" autocomplete="off" />
        <button type="submit" class="btn btn-sm btn-primary" style="flex-shrink:0;">Hỏi</button>
      </form>

      ${!history.length ? `
        <div style="margin-bottom:6px;">
          <div class="muted-sm" style="font-size:0.76rem; margin-bottom:5px;">💡 Gợi ý hỏi thử:</div>
          <div style="display:flex; gap:5px; flex-wrap:wrap;">
            ${SUGGESTIONS.map((s) => `
              <button type="button" class="btn-chip" data-qa-suggest="${escapeHtml(s)}" style="padding:3px 8px; font-size:0.75rem;">${escapeHtml(s)}</button>
            `).join("")}
          </div>
        </div>
      ` : `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span class="muted-sm" style="font-size:0.76rem;">Kết quả từ kho kiến thức web:</span>
          <button type="button" class="btn-chip" id="qaClearBtn" style="padding:2px 8px; font-size:0.72rem;">Xóa lịch sử</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${history.map((entry) => `
            <div style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:10px;">
              <div style="font-size:0.8rem; color:var(--green-700); font-weight:700; margin-bottom:6px;">🙋 ${escapeHtml(entry.q)}</div>
              ${!entry.res.found ? `
                <div class="muted-sm" style="font-size:0.82rem; background:var(--yellow-50); padding:8px; border-radius:8px; color:#7c4a03;">
                  ${escapeHtml(entry.res.message)}
                </div>
              ` : entry.res.items.map((it, idx) => `
                <div style="${idx > 0 ? "margin-top:8px; padding-top:8px; border-top:1px dashed var(--border);" : ""}">
                  <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
                    <span class="badge badge-mint" style="font-size:0.7rem;">${escapeHtml(it.tag)}</span>
                    ${it.speak ? `<button type="button" class="icon-btn" style="width:24px; height:24px; font-size:0.74rem;" data-qa-speak="${escapeHtml(it.speak)}" title="Nghe (TTS)">🔊</button>` : ""}
                  </div>
                  <div class="zh" style="font-weight:700; font-size:0.92rem; color:var(--green-800); margin:4px 0 2px;">${escapeHtml(it.title)}</div>
                  ${it.summary ? `<div style="font-size:0.83rem; font-weight:500; margin-bottom:4px;">${escapeHtml(it.summary)}</div>` : ""}
                  ${(it.details || []).map((d) => `<div class="muted-sm" style="font-size:0.8rem; margin-top:2px; line-height:1.4;">${escapeHtml(d)}</div>`).join("")}
                  <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
                    ${it.linkHash ? `<a href="${it.linkHash}" class="btn-chip" style="padding:2px 9px; font-size:0.74rem;">${escapeHtml(it.linkLabel || "Xem chi tiết →")}</a>` : ""}
                    ${it.hanziChar ? `<button type="button" class="btn-chip" data-qa-hanzi="${escapeHtml(it.hanziChar)}" style="padding:2px 9px; font-size:0.74rem;">✍️ Xem hình động nét viết</button>` : ""}
                  </div>
                </div>
              `).join("")}
            </div>
          `).join("")}
        </div>
      `}
    `;

    hostEl.querySelector("#qaAskForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      submitQuery(hostEl.querySelector("#qaAskInput")?.value);
    });
    hostEl.querySelector("#qaClearBtn")?.addEventListener("click", () => {
      history.length = 0;
      render();
    });
    hostEl.querySelectorAll("[data-qa-suggest]").forEach((btn) => {
      btn.addEventListener("click", () => submitQuery(btn.dataset.qaSuggest));
    });
    hostEl.querySelectorAll("[data-qa-speak]").forEach((btn) => {
      btn.addEventListener("click", () => audioManager.speak(btn.dataset.qaSpeak));
    });
    hostEl.querySelectorAll("[data-qa-hanzi]").forEach((btn) => {
      btn.addEventListener("click", () => onInspectHanzi?.(btn.dataset.qaHanzi));
    });
  }

  render();
}
