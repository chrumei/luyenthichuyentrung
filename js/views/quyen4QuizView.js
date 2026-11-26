// PHÒNG LUYỆN & KIỂM TRA TỪ VỰNG QUYỂN 4 (HSK 3.0 Cấp 4 – 50 Bài / 1.000 từ)
// Thao tác trực tiếp 100% trên web, hỗ trợ chọn số lượng bài, chọn từng bài và trộn nhiều dạng bài!

import { store } from "../store.js";
import { audioManager } from "../audio.js";
import { escapeHtml, makeClickableHanzi, showToast } from "../mascots.js";

const QUIZ_TYPES = [
  { id: "vi_to_zh_mc", label: "Nghĩa Việt → Chọn Chữ Hán", icon: "🔤", desc: "Nhìn nghĩa Việt & từ loại, bấm chọn 1 trong 4 chữ Hán" },
  { id: "zh_to_vi_mc", label: "Chữ Hán / Audio → Chọn Nghĩa", icon: "🔊", desc: "Nhìn chữ Hán (hoặc nghe đọc TTS), chọn nghĩa tiếng Việt đúng" },
  { id: "context_cloze", label: "Điền từ vào câu ngữ cảnh", icon: "📝", desc: "Ẩn từ mục tiêu trong câu ví dụ sách QUYỂN 4, chọn từ điền đúng" },
  { id: "match_pairs", label: "Nối cặp Từ ↔ Nghĩa (5 cặp)", icon: "🔗", desc: "Click ghép đôi 5 chữ Hán với 5 nghĩa Việt như bài 速练 trong sách" },
  { id: "type_pinyin", label: "Gõ Pinyin / Chữ Hán nhanh", icon: "⌨️", desc: "Gõ Pinyin (chấp nhận không dấu) hoặc chữ Hán trực tiếp trên web" }
];

function stripPinyinTones(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/\/\//g, "")
    .replace(/[āáǎà]/g, "a")
    .replace(/[ēéěè]/g, "e")
    .replace(/[īíǐì]/g, "i")
    .replace(/[ōóǒò]/g, "o")
    .replace(/[ūúǔù]/g, "u")
    .replace(/[ǖǘǚǜü]/g, "v")
    .replace(/[^a-zv0-9]/g, "");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getWordMeaning(w) {
  return w.lesson_usage?.meaning || w.meaning || "";
}

function getWordPos(w) {
  return w.lesson_usage?.part_of_speech || w.pos || "";
}

function getWordExample(w) {
  return w.lesson_usage?.example?.chinese || w.example_zh || "";
}

function getWordExampleVi(w) {
  return w.lesson_usage?.example?.vietnamese || w.example_vi || "";
}

function makeClozePrompt(w) {
  const ex = getWordExample(w);
  const hz = (w.hanzi || "").trim();
  if (!ex || !hz) return null;
  if (ex.includes(hz)) {
    return ex.replace(hz, "______");
  }
  // Xử lý từ ly hợp (VD: 办事 -> 办几件事)
  if (hz.length === 2 && ex.includes(hz[0]) && ex.includes(hz[1])) {
    const idx1 = ex.indexOf(hz[0]);
    const idx2 = ex.indexOf(hz[1], idx1 + 1);
    if (idx1 >= 0 && idx2 > idx1 && idx2 - idx1 <= 5) {
      return ex.slice(0, idx1) + "______" + ex.slice(idx2 + 1);
    }
  }
  return null;
}

function pickDistractors(target, pool, allVocab, count = 3) {
  const samePosPool = pool.filter((x) => x.id !== target.id && getWordPos(x) === getWordPos(target));
  const otherPool = pool.filter((x) => x.id !== target.id && getWordPos(x) !== getWordPos(target));
  const fallback = allVocab.filter((x) => x.id !== target.id && x.hanzi !== target.hanzi);

  const chosen = [];
  const usedHanzi = new Set([target.hanzi]);
  const usedMeanings = new Set([getWordMeaning(target)]);

  for (const src of [shuffle(samePosPool), shuffle(otherPool), shuffle(fallback)]) {
    for (const cand of src) {
      if (chosen.length >= count) break;
      const m = getWordMeaning(cand);
      if (usedHanzi.has(cand.hanzi) || usedMeanings.has(m)) continue;
      usedHanzi.add(cand.hanzi);
      usedMeanings.add(m);
      chosen.push(cand);
    }
    if (chosen.length >= count) break;
  }
  return chosen;
}

export function renderQuyen4QuizView(container) {
  const allVocab = store.getHsk30L4Vocab();
  if (!allVocab.length) {
    container.innerHTML = `
      <div class="card card-yellow">
        <h3>📘 Chưa nạp dữ liệu từ vựng QUYỂN 4</h3>
        <p class="muted-sm">Hệ thống chưa tìm thấy tệp <code>data/hsk30_l4_vocab.json</code>. Hãy kiểm tra lại tệp dữ liệu và tải lại trang.</p>
      </div>
    `;
    return;
  }

  // Nhóm từ theo từng bài (1..50)
  const unitsMap = new Map();
  for (const w of allVocab) {
    const u = Number(w.lesson || w.unit || 1);
    if (!unitsMap.has(u)) unitsMap.set(u, []);
    unitsMap.get(u).push(w);
  }
  const availableUnits = Array.from(unitsMap.keys()).sort((a, b) => a - b);

  const config = {
    selectMode: "by_count", // by_count | range | pick
    startUnit: availableUnits[0] || 1,
    unitCount: 1,
    rangeFrom: availableUnits[0] || 1,
    rangeTo: Math.min(availableUnits[availableUnits.length - 1] || 1, (availableUnits[0] || 1) + 2),
    pickedUnits: new Set([availableUnits[0] || 1]),
    questionCount: 20, // 10 | 20 | 30 | 50 | 0 (all)
    enabledTypes: new Set(["vi_to_zh_mc", "zh_to_vi_mc", "context_cloze", "match_pairs"]),
    audioHiddenMode: false,
    showVocabPreview: false
  };

  let phase = "setup"; // setup | running | results
  let questions = [];
  let currentIdx = 0;
  let score = 0;
  let answeredLog = []; // { q, isCorrect, userAnswerText }

  function getSelectedUnits() {
    if (config.selectMode === "by_count") {
      const startIdx = Math.max(0, availableUnits.indexOf(Number(config.startUnit)));
      return availableUnits.slice(startIdx, startIdx + Math.max(1, Number(config.unitCount)));
    }
    if (config.selectMode === "range") {
      const lo = Math.min(Number(config.rangeFrom), Number(config.rangeTo));
      const hi = Math.max(Number(config.rangeFrom), Number(config.rangeTo));
      return availableUnits.filter((u) => u >= lo && u <= hi);
    }
    return availableUnits.filter((u) => config.pickedUnits.has(u));
  }

  function getSelectedWords() {
    const units = getSelectedUnits();
    const list = [];
    for (const u of units) {
      list.push(...(unitsMap.get(u) || []));
    }
    return list;
  }

  function buildQuestions(customWords = null) {
    const pool = customWords || getSelectedWords();
    if (!pool.length) return [];

    const types = Array.from(config.enabledTypes);
    if (!types.length) types.push("vi_to_zh_mc");

    const shuffledPool = shuffle(pool);
    const targetCount = config.questionCount === 0
      ? shuffledPool.length
      : Math.min(config.questionCount, shuffledPool.length);
    const chosenWords = shuffledPool.slice(0, targetCount);

    const qs = [];
    const hasMatch = types.includes("match_pairs");
    const nonMatchTypes = types.filter((t) => t !== "match_pairs");

    // Nếu người dùng chọn Nối cặp, tách mỗi nhóm 5 từ thành 1 lượt nối cặp siêu trực quan
    let matchGroupsCount = 0;
    let remainingWords = [...chosenWords];

    if (hasMatch && remainingWords.length >= 4) {
      if (!nonMatchTypes.length) {
        // Chỉ nối cặp: chia toàn bộ từ thành từng lượt 5 cặp
        while (remainingWords.length >= 2) {
          const chunk = remainingWords.splice(0, Math.min(5, remainingWords.length));
          qs.push({
            type: "match_pairs",
            words: chunk,
            left: shuffle(chunk.map((w) => ({ id: w.id, hanzi: w.hanzi, pinyin: w.pinyin, unit: w.lesson }))),
            right: shuffle(chunk.map((w) => ({ id: w.id, meaning: getWordMeaning(w), pos: getWordPos(w) }))),
            matchedIds: new Set(),
            wrongAttempts: 0,
            selectedLeft: null,
            selectedRight: null,
            done: false
          });
        }
      } else {
        // Trộn nhiều dạng: lấy khoảng 1 lượt nối cặp cho mỗi 10–15 câu (tối đa 3 lượt)
        matchGroupsCount = Math.min(3, Math.max(1, Math.floor(chosenWords.length / 10)));
        for (let g = 0; g < matchGroupsCount && remainingWords.length >= 5; g++) {
          const chunk = remainingWords.splice(0, 5);
          qs.push({
            type: "match_pairs",
            words: chunk,
            left: shuffle(chunk.map((w) => ({ id: w.id, hanzi: w.hanzi, pinyin: w.pinyin, unit: w.lesson }))),
            right: shuffle(chunk.map((w) => ({ id: w.id, meaning: getWordMeaning(w), pos: getWordPos(w) }))),
            matchedIds: new Set(),
            wrongAttempts: 0,
            selectedLeft: null,
            selectedRight: null,
            done: false
          });
        }
      }
    }

    // Các từ còn lại chia đều sang các dạng đơn câu
    const activeTypes = nonMatchTypes.length ? nonMatchTypes : ["vi_to_zh_mc"];
    remainingWords.forEach((w, idx) => {
      let t = activeTypes[idx % activeTypes.length];
      let clozeText = null;
      if (t === "context_cloze") {
        clozeText = makeClozePrompt(w);
        if (!clozeText) {
          // Nếu câu ví dụ không thay được bằng chỗ trống, fallback sang trắc nghiệm nghĩa -> chữ
          t = "vi_to_zh_mc";
        }
      }

      if (t === "vi_to_zh_mc" || t === "context_cloze") {
        const dist = pickDistractors(w, pool, allVocab, 3);
        const options = shuffle([w, ...dist]).map((item) => ({
          id: item.id,
          label: item.hanzi,
          sub: item.pinyin,
          isCorrect: item.id === w.id
        }));
        qs.push({
          type: t,
          word: w,
          clozeText,
          options,
          answered: false,
          selectedId: null,
          isCorrect: false
        });
      } else if (t === "zh_to_vi_mc") {
        const dist = pickDistractors(w, pool, allVocab, 3);
        const options = shuffle([w, ...dist]).map((item) => ({
          id: item.id,
          label: getWordMeaning(item),
          sub: getWordPos(item),
          isCorrect: item.id === w.id
        }));
        qs.push({
          type: t,
          word: w,
          options,
          answered: false,
          selectedId: null,
          isCorrect: false
        });
      } else if (t === "type_pinyin") {
        qs.push({
          type: t,
          word: w,
          answered: false,
          userInput: "",
          hintUsed: false,
          isCorrect: false
        });
      }
    });

    return shuffle(qs);
  }

  function startQuiz(customWords = null) {
    const built = buildQuestions(customWords);
    if (!built.length) {
      showToast("Hãy chọn ít nhất 1 bài học và 1 dạng kiểm tra nhé!");
      return;
    }
    questions = built;
    currentIdx = 0;
    score = 0;
    answeredLog = [];
    phase = "running";
    renderRunning();
  }

  function recordWrongWord(w, qDesc, userAns) {
    store.setVocabStatus(w.id, "needs_review");
    store.recordMistake({
      question: qDesc,
      userAnswer: userAns || "(Sai / Chưa nhớ)",
      correctAnswer: `${w.hanzi} (${w.pinyin}) — ${getWordMeaning(w)}`,
      explanation: getWordExample(w) ? `Ví dụ QUYỂN 4 (Bài ${w.lesson}): ${getWordExample(w)}` : `Thuộc QUYỂN 4 – Bài ${w.lesson}`,
      category: "Từ vựng QUYỂN 4",
      sourceRef: `QUYỂN 4 – Bài ${w.lesson}`
    });
  }

  function finishQuiz() {
    phase = "results";
    const units = getSelectedUnits();
    const unitLabel = units.length === 1 ? `Bài ${units[0]}` : `${units.length} bài (${units[0]}..${units[units.length - 1]})`;
    store.recordTestResult({
      type: "quyen4_web_quiz",
      title: `QUYỂN 4 (Trực tiếp trên web · ${unitLabel})`,
      score,
      total: questions.length
    });
    renderResults();
  }

  function renderSetup() {
    const selectedUnits = getSelectedUnits();
    const selectedWords = getSelectedWords();

    container.innerHTML = `
      <div class="card card-mint">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
          <div>
            <h2>🎯 LUYỆN & KIỂM TRA TỪ VỰNG QUYỂN 4 <span class="zh">词汇速记速练（四级）</span></h2>
            <p class="muted-sm">
              Thao tác <strong>trực tiếp 100% trên website</strong> (chấm điểm tức thì, không cần viết ra giấy) theo đúng từng bài trong sách <em>QUYỂN 4 – HSK 3.0 Cấp 4</em> (<strong>${availableUnits.length} bài / ${allVocab.length} từ</strong>, TS. Nguyễn Thị Minh Hồng dịch).
            </p>
          </div>
          <span class="badge badge-mint" style="font-size:0.86rem;">📚 ${availableUnits.length} Bài · ${allVocab.length} từ</span>
        </div>
      </div>

      <div class="card">
        <h3>1. Chọn bài & số lượng bài muốn kiểm tra</h3>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
          <button type="button" class="btn-chip ${config.selectMode === "by_count" ? "active" : ""}" data-q4-selmode="by_count">📌 Chọn số lượng bài liên tiếp</button>
          <button type="button" class="btn-chip ${config.selectMode === "range" ? "active" : ""}" data-q4-selmode="range">🔢 Chọn khoảng Bài X → Y</button>
          <button type="button" class="btn-chip ${config.selectMode === "pick" ? "active" : ""}" data-q4-selmode="pick">☑️ Tick chọn từng bài lẻ</button>
        </div>

        <div style="background:var(--bg-soft); padding:14px; border-radius:14px; border:1px solid var(--border); margin-bottom:14px;">
          ${config.selectMode === "by_count" ? `
            <div style="display:flex; gap:14px; flex-wrap:wrap; align-items:center;">
              <div>
                <label class="muted-sm"><strong>Bắt đầu từ:</strong></label>
                <select class="select-input" id="q4StartUnit" style="margin-left:6px;">
                  ${availableUnits.map((u) => {
                    const words = unitsMap.get(u) || [];
                    const first = words[0]?.hanzi || "";
                    const last = words[words.length - 1]?.hanzi || "";
                    return `<option value="${u}" ${Number(config.startUnit) === u ? "selected" : ""}>Bài ${u} (${first} … ${last} · ${words.length} từ)</option>`;
                  }).join("")}
                </select>
              </div>
              <div>
                <label class="muted-sm"><strong>Số lượng bài kiểm tra:</strong></label>
                <div style="display:inline-flex; gap:6px; flex-wrap:wrap; margin-left:6px; vertical-align:middle;">
                  ${[1, 2, 3, 5, 10].map((n) => `
                    <button type="button" class="btn-chip ${Number(config.unitCount) === n ? "active" : ""}" data-q4-ucount="${n}">${n} bài</button>
                  `).join("")}
                  <input type="number" class="text-input" id="q4UnitCountInput" value="${config.unitCount}" min="1" max="${availableUnits.length}" style="width:72px;" title="Nhập số bài bất kỳ" />
                </div>
              </div>
            </div>
          ` : config.selectMode === "range" ? `
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:10px;">
              <span>Từ <strong>Bài</strong></span>
              <input type="number" class="text-input" id="q4RangeFrom" value="${config.rangeFrom}" min="${availableUnits[0]}" max="${availableUnits[availableUnits.length - 1]}" style="width:76px;" />
              <span>đến <strong>Bài</strong></span>
              <input type="number" class="text-input" id="q4RangeTo" value="${config.rangeTo}" min="${availableUnits[0]}" max="${availableUnits[availableUnits.length - 1]}" style="width:76px;" />
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <span class="muted-sm" style="align-self:center;">Chọn nhanh cụm:</span>
              ${[[1,10],[11,20],[21,30],[31,40],[41,50],[1,50]].map(([a,b]) => `
                <button type="button" class="btn-chip" data-q4-quickrange="${a}-${b}">${a === 1 && b === 50 ? "Tất cả 50 bài" : `Bài ${a}–${b}`}</button>
              `).join("")}
            </div>
          ` : `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
              <span class="muted-sm">Nhấp vào từng bài bên dưới để chọn hoặc bỏ chọn:</span>
              <div style="display:flex; gap:6px;">
                <button type="button" class="btn btn-sm btn-outline" id="q4SelectAllUnits">Chọn hết (${availableUnits.length})</button>
                <button type="button" class="btn btn-sm btn-outline" id="q4ClearAllUnits">Bỏ chọn</button>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(112px, 1fr)); gap:6px; max-height:220px; overflow-y:auto; padding:4px;">
              ${availableUnits.map((u) => {
                const checked = config.pickedUnits.has(u);
                const w0 = (unitsMap.get(u) || [])[0]?.hanzi || "";
                return `
                  <button type="button" class="btn-chip ${checked ? "active" : ""}" data-q4-pickunit="${u}" style="justify-content:center; padding:6px 8px; font-size:0.82rem;">
                    Bài ${u} <span class="zh" style="opacity:0.8;">(${escapeHtml(w0)})</span>
                  </button>
                `;
              }).join("")}
            </div>
          `}

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:12px; padding-top:10px; border-top:1px dashed var(--border);">
            <div class="muted-sm">
              📦 Đã chọn: <strong>${selectedUnits.length} bài</strong> (${selectedUnits.length <= 6 ? selectedUnits.map((u) => `Bài ${u}`).join(", ") : `Bài ${selectedUnits[0]} … Bài ${selectedUnits[selectedUnits.length - 1]}`}) · <strong>${selectedWords.length} từ vựng</strong>
            </div>
            <button type="button" class="btn btn-sm btn-outline" id="q4TogglePreview">
              ${config.showVocabPreview ? "🙈 Ẩn danh sách từ" : "👀 Xem nhanh từ của bài đã chọn"}
            </button>
          </div>

          ${config.showVocabPreview && selectedWords.length ? `
            <div style="margin-top:12px; max-height:260px; overflow-y:auto; background:#fff; border-radius:12px; border:1px solid var(--border); padding:10px;">
              <table class="data-table" style="font-size:0.86rem;">
                <thead><tr><th>Bài</th><th>Chữ Hán</th><th>Pinyin</th><th>Từ loại & Nghĩa Việt</th><th>Nghe</th></tr></thead>
                <tbody>
                  ${selectedWords.slice(0, 120).map((w) => `
                    <tr>
                      <td><span class="badge badge-gray">Bài ${w.lesson}</span></td>
                      <td><strong class="zh" style="font-size:1.1rem;">${makeClickableHanzi(w.hanzi)}</strong></td>
                      <td class="pinyin">${escapeHtml(w.pinyin)}</td>
                      <td><span class="badge badge-mint">${escapeHtml(getWordPos(w))}</span> ${escapeHtml(getWordMeaning(w))}</td>
                      <td><button type="button" class="icon-btn" style="width:26px; height:26px;" data-speak="${escapeHtml(w.hanzi)}">🔊</button></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
              ${selectedWords.length > 120 ? `<div class="muted-sm" style="margin-top:6px;">… và còn ${selectedWords.length - 120} từ khác trong phạm vi đã chọn.</div>` : ""}
            </div>
          ` : ""}
        </div>

        <div class="grid-2" style="gap:16px;">
          <div>
            <h4>2. Chọn dạng bài kiểm tra (chọn 1 hoặc trộn nhiều dạng)</h4>
            <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
              ${QUIZ_TYPES.map((qt) => {
                const active = config.enabledTypes.has(qt.id);
                return `
                  <label style="display:flex; align-items:flex-start; gap:10px; padding:10px 12px; border-radius:12px; border:1.5px solid ${active ? "var(--green-500)" : "var(--border)"}; background:${active ? "var(--mint-50)" : "#fff"}; cursor:pointer;">
                    <input type="checkbox" data-q4-qtype="${qt.id}" ${active ? "checked" : ""} style="margin-top:3px;" />
                    <div>
                      <div style="font-weight:600; font-size:0.92rem;">${qt.icon} ${escapeHtml(qt.label)}</div>
                      <div class="muted-sm" style="font-size:0.8rem;">${escapeHtml(qt.desc)}</div>
                    </div>
                  </label>
                `;
              }).join("")}
            </div>
          </div>

          <div>
            <h4>3. Số lượng từ / câu hỏi trong lượt này</h4>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
              ${[10, 20, 30, 50, 0].map((n) => `
                <button type="button" class="btn-chip ${config.questionCount === n ? "active" : ""}" data-q4-qcount="${n}">
                  ${n === 0 ? `Tất cả (${selectedWords.length} từ)` : `${n} từ`}
                </button>
              `).join("")}
            </div>

            <div class="card card-cream" style="margin-top:14px; padding:12px;">
              <strong>🎧 Tùy chọn thêm:</strong>
              <label style="display:flex; align-items:center; gap:8px; margin-top:8px; font-size:0.88rem; cursor:pointer;">
                <input type="checkbox" id="q4AudioHidden" ${config.audioHiddenMode ? "checked" : ""} />
                <span>Ở dạng <em>Chữ Hán / Audio → Nghĩa</em>: ẩn chữ Hán để luyện <strong>Nghe hiểu phản xạ</strong></span>
              </label>
              <div class="muted-sm" style="margin-top:8px; font-size:0.82rem;">
                💡 Mọi từ trả lời sai sẽ tự động được lưu vào <strong>Sổ ôn tập cá nhân</strong> để ôn lại sau!
              </div>
            </div>

            <div style="margin-top:18px; text-align:center;">
              <button type="button" class="btn btn-primary" id="btnStartQ4Quiz" style="padding:13px 28px; font-size:1.04rem; width:100%;">
                🚀 Bắt đầu kiểm tra ngay trên web
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind events
    container.querySelectorAll("[data-q4-selmode]").forEach((b) => {
      b.addEventListener("click", () => { config.selectMode = b.dataset.q4Selmode; renderSetup(); });
    });
    container.querySelector("#q4StartUnit")?.addEventListener("change", (e) => {
      config.startUnit = Number(e.target.value);
      renderSetup();
    });
    container.querySelectorAll("[data-q4-ucount]").forEach((b) => {
      b.addEventListener("click", () => { config.unitCount = Number(b.dataset.q4Ucount); renderSetup(); });
    });
    container.querySelector("#q4UnitCountInput")?.addEventListener("change", (e) => {
      config.unitCount = Math.max(1, Math.min(availableUnits.length, Number(e.target.value) || 1));
      renderSetup();
    });
    container.querySelector("#q4RangeFrom")?.addEventListener("change", (e) => {
      config.rangeFrom = Number(e.target.value) || 1;
      renderSetup();
    });
    container.querySelector("#q4RangeTo")?.addEventListener("change", (e) => {
      config.rangeTo = Number(e.target.value) || 1;
      renderSetup();
    });
    container.querySelectorAll("[data-q4-quickrange]").forEach((b) => {
      b.addEventListener("click", () => {
        const [a, c] = b.dataset.q4Quickrange.split("-").map(Number);
        config.rangeFrom = a;
        config.rangeTo = c;
        renderSetup();
      });
    });
    container.querySelectorAll("[data-q4-pickunit]").forEach((b) => {
      b.addEventListener("click", () => {
        const u = Number(b.dataset.q4Pickunit);
        if (config.pickedUnits.has(u)) config.pickedUnits.delete(u);
        else config.pickedUnits.add(u);
        renderSetup();
      });
    });
    container.querySelector("#q4SelectAllUnits")?.addEventListener("click", () => {
      config.pickedUnits = new Set(availableUnits);
      renderSetup();
    });
    container.querySelector("#q4ClearAllUnits")?.addEventListener("click", () => {
      config.pickedUnits = new Set();
      renderSetup();
    });
    container.querySelector("#q4TogglePreview")?.addEventListener("click", () => {
      config.showVocabPreview = !config.showVocabPreview;
      renderSetup();
    });
    container.querySelectorAll("[data-speak]").forEach((btn) => {
      btn.addEventListener("click", () => audioManager.speak(btn.dataset.speak));
    });
    container.querySelectorAll("[data-q4-qtype]").forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) config.enabledTypes.add(cb.dataset.q4Qtype);
        else config.enabledTypes.delete(cb.dataset.q4Qtype);
        renderSetup();
      });
    });
    container.querySelectorAll("[data-q4-qcount]").forEach((b) => {
      b.addEventListener("click", () => { config.questionCount = Number(b.dataset.q4Qcount); renderSetup(); });
    });
    container.querySelector("#q4AudioHidden")?.addEventListener("change", (e) => {
      config.audioHiddenMode = e.target.checked;
    });
    container.querySelector("#btnStartQ4Quiz")?.addEventListener("click", () => startQuiz());
  }

  function renderRunning() {
    const q = questions[currentIdx];
    const progressPct = Math.round(((currentIdx + 1) / questions.length) * 100);
    const typeInfo = QUIZ_TYPES.find((t) => t.id === q.type) || QUIZ_TYPES[0];

    let bodyHtml = "";

    if (q.type === "vi_to_zh_mc" || q.type === "context_cloze" || q.type === "zh_to_vi_mc") {
      const w = q.word;
      let promptBlock = "";
      if (q.type === "vi_to_zh_mc") {
        promptBlock = `
          <div class="muted-sm">Chọn chữ Hán đúng với nghĩa tiếng Việt sau (<strong>Bài ${w.lesson}</strong>):</div>
          <div style="font-size:1.45rem; font-weight:700; color:var(--green-800); margin:10px 0 6px;">${escapeHtml(getWordMeaning(w))}</div>
          <span class="badge badge-mint">${escapeHtml(getWordPos(w))}</span>
        `;
      } else if (q.type === "context_cloze") {
        promptBlock = `
          <div class="muted-sm">Chọn từ đúng để điền vào chỗ trống (Câu ví dụ <strong>Bài ${w.lesson}</strong>):</div>
          <div class="zh" style="font-size:1.35rem; font-weight:600; color:var(--green-800); margin:12px 0; line-height:1.7;">${escapeHtml(q.clozeText)}</div>
          ${getWordExampleVi(w) ? `<div class="muted-sm">💡 Gợi ý nghĩa câu: <em>${escapeHtml(getWordExampleVi(w))}</em></div>` : ""}
        `;
      } else {
        promptBlock = `
          <div class="muted-sm">Chọn nghĩa tiếng Việt đúng cho từ sau (<strong>Bài ${w.lesson}</strong>):</div>
          ${config.audioHiddenMode && !q.answered
            ? `<div style="font-size:1.3rem; font-weight:700; margin:12px 0;">🎧 Nhấn nghe và chọn nghĩa đúng</div>`
            : `<div class="zh" style="font-size:2.4rem; font-weight:700; color:var(--green-800); margin:10px 0 4px;">${escapeHtml(w.hanzi)}</div>`
          }
          <button type="button" class="btn btn-sm btn-outline" id="q4SpeakCurrent">🔊 Nghe phát âm (TTS)</button>
        `;
      }

      bodyHtml = `
        <div class="card card-cream" style="text-align:center; padding:18px; margin-bottom:14px;">
          ${promptBlock}
        </div>
        <div class="grid-2" style="gap:10px;">
          ${q.options.map((opt, idx) => {
            let cls = "option-btn";
            if (q.answered) {
              if (opt.isCorrect) cls += " correct";
              else if (opt.id === q.selectedId) cls += " wrong";
            }
            const isZh = q.type !== "zh_to_vi_mc";
            return `
              <button type="button" class="${cls}" data-q4-opt="${opt.id}" ${q.answered ? "disabled" : ""} style="text-align:left; padding:14px 16px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div>
                  <span class="badge badge-gray" style="margin-right:8px;">${String.fromCharCode(65 + idx)}</span>
                  <span class="${isZh ? "zh" : ""}" style="font-size:${isZh ? "1.35rem" : "1rem"}; font-weight:600;">${escapeHtml(opt.label)}</span>
                  ${q.answered && opt.sub ? `<div class="muted-sm" style="margin-top:3px; margin-left:30px;">${escapeHtml(opt.sub)}</div>` : ""}
                </div>
                ${q.answered && opt.isCorrect ? "<span>✅</span>" : q.answered && opt.id === q.selectedId ? "<span>❌</span>" : ""}
              </button>
            `;
          }).join("")}
        </div>
        ${q.answered ? renderAnswerExplainBox(w, q.isCorrect) : ""}
      `;
    } else if (q.type === "type_pinyin") {
      const w = q.word;
      bodyHtml = `
        <div class="card card-cream" style="text-align:center; padding:18px; margin-bottom:14px;">
          <div class="muted-sm">Gõ <strong>Pinyin</strong> (có dấu hoặc không dấu đều được) HOẶC <strong>Chữ Hán</strong> (<strong>Bài ${w.lesson}</strong>):</div>
          <div style="font-size:1.45rem; font-weight:700; color:var(--green-800); margin:10px 0 6px;">${escapeHtml(getWordMeaning(w))}</div>
          <span class="badge badge-mint">${escapeHtml(getWordPos(w))}</span>
          <button type="button" class="btn btn-sm btn-outline" id="q4SpeakCurrent" style="margin-left:8px;">🔊 Nghe gợi ý âm</button>
          ${q.hintUsed ? `<div class="muted-sm" style="margin-top:8px;">💡 Gợi ý: Chữ đầu <strong>${escapeHtml(w.hanzi[0])}…</strong> · Pinyin bắt đầu bằng <strong>${escapeHtml(stripPinyinTones(w.pinyin).slice(0, 2))}…</strong> (${w.hanzi.length} chữ)</div>` : ""}
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <input type="text" class="text-input" id="q4TypeInput" value="${escapeHtml(q.userInput)}" placeholder="Ví dụ: anshi hoặc 按时" ${q.answered ? "disabled" : ""} style="flex:1; min-width:220px; font-size:1.1rem; padding:12px;" autocomplete="off" />
          ${!q.answered ? `
            <button type="button" class="btn btn-outline" id="q4HintBtn">💡 Gợi ý</button>
            <button type="button" class="btn btn-primary" id="q4CheckTypeBtn">✓ Kiểm tra</button>
          ` : ""}
        </div>
        ${q.answered ? renderAnswerExplainBox(w, q.isCorrect) : ""}
      `;
    } else if (q.type === "match_pairs") {
      bodyHtml = `
        <div class="card card-cream" style="padding:14px; margin-bottom:12px;">
          <strong>🔗 Ghép 5 cặp Từ Hán ↔ Nghĩa Việt đúng:</strong>
          <span class="muted-sm" style="margin-left:6px;">Bấm 1 thẻ bên trái rồi bấm nghĩa tương ứng bên phải (${q.matchedIds.size}/${q.words.length} cặp đã ghép · Sai: ${q.wrongAttempts} lần).</span>
        </div>
        <div class="grid-2" style="gap:12px;">
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${q.left.map((item) => {
              const matched = q.matchedIds.has(item.id);
              const selected = q.selectedLeft === item.id;
              return `
                <button type="button" class="option-btn ${matched ? "correct" : selected ? "active" : ""}" data-match-left="${item.id}" ${matched ? "disabled" : ""} style="padding:12px 14px; display:flex; justify-content:space-between; align-items:center; ${selected ? "border-color:var(--green-600); background:var(--mint-100);" : ""}">
                  <div>
                    <strong class="zh" style="font-size:1.3rem;">${escapeHtml(item.hanzi)}</strong>
                    ${matched ? `<span class="pinyin" style="margin-left:8px; font-size:0.86rem;">${escapeHtml(item.pinyin)}</span>` : ""}
                  </div>
                  <span class="badge badge-gray">Bài ${item.unit}</span>
                </button>
              `;
            }).join("")}
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${q.right.map((item) => {
              const matched = q.matchedIds.has(item.id);
              const selected = q.selectedRight === item.id;
              return `
                <button type="button" class="option-btn ${matched ? "correct" : selected ? "active" : ""}" data-match-right="${item.id}" ${matched ? "disabled" : ""} style="padding:12px 14px; text-align:left; ${selected ? "border-color:var(--green-600); background:var(--mint-100);" : ""}">
                  <span class="badge badge-mint" style="margin-right:6px;">${escapeHtml(item.pos)}</span>
                  <span>${escapeHtml(item.meaning)}</span>
                </button>
              `;
            }).join("")}
          </div>
        </div>
        ${q.done ? `
          <div class="feedback-box ${q.wrongAttempts === 0 ? "feedback-ok" : "feedback-warn"}" style="margin-top:12px;">
            <strong>${q.wrongAttempts === 0 ? "🎉 Tuyệt vời! Ghép chuẩn 100% không sai lần nào!" : `✅ Đã hoàn thành ghép cặp (${q.wrongAttempts} lần bấm nhầm).`}</strong>
          </div>
        ` : ""}
      `;
    }

    const canNext = q.type === "match_pairs" ? q.done : q.answered;

    container.innerHTML = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
          <div>
            <strong>Câu ${currentIdx + 1} / ${questions.length}</strong>
            <span class="badge badge-mint" style="margin-left:8px;">${typeInfo.icon} ${escapeHtml(typeInfo.label)}</span>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <span class="badge badge-yellow">Điểm hiện tại: ${score}/${questions.length}</span>
            <button type="button" class="btn btn-sm btn-outline" id="q4QuitBtn">✕ Đổi bài</button>
          </div>
        </div>
        <div class="progress-track" style="margin-bottom:16px;"><div class="progress-fill" style="width:${progressPct}%"></div></div>

        ${bodyHtml}

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          ${canNext ? `
            <button type="button" class="btn btn-primary" id="q4NextBtn" style="padding:10px 24px;">
              ${currentIdx + 1 < questions.length ? "Câu tiếp theo →" : "🏆 Xem bảng kết quả"}
            </button>
          ` : `<span class="muted-sm">Hãy hoàn thành câu hiện tại để chuyển tiếp.</span>`}
        </div>
      </div>
    `;

    // Auto speak if audioHiddenMode on zh_to_vi_mc
    if (q.type === "zh_to_vi_mc" && config.audioHiddenMode && !q.answered) {
      audioManager.speak(q.word.hanzi);
    }

    container.querySelector("#q4QuitBtn")?.addEventListener("click", () => {
      phase = "setup";
      renderSetup();
    });
    container.querySelector("#q4SpeakCurrent")?.addEventListener("click", () => {
      audioManager.speak(q.word.hanzi);
    });
    container.querySelectorAll("[data-speak]").forEach((b) => {
      b.addEventListener("click", () => audioManager.speak(b.dataset.speak));
    });

    // MC choice click
    container.querySelectorAll("[data-q4-opt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (q.answered) return;
        const chosenId = btn.dataset.q4Opt;
        const chosenOpt = q.options.find((o) => o.id === chosenId);
        q.answered = true;
        q.selectedId = chosenId;
        q.isCorrect = Boolean(chosenOpt?.isCorrect);
        if (q.isCorrect) {
          score += 1;
          store.setVocabStatus(q.word.id, "mastered");
        } else {
          recordWrongWord(
            q.word,
            q.type === "context_cloze" ? `[QUYỂN 4 – Bài ${q.word.lesson}] ${q.clozeText}` : `[QUYỂN 4 – Bài ${q.word.lesson}] ${q.word.hanzi} — ${getWordMeaning(q.word)}`,
            chosenOpt?.label || ""
          );
        }
        answeredLog.push({ q, isCorrect: q.isCorrect, words: [q.word], userAnswerText: chosenOpt?.label || "" });
        audioManager.speak(q.word.hanzi);
        renderRunning();
      });
    });

    // Type pinyin / hanzi
    const typeInput = container.querySelector("#q4TypeInput");
    if (typeInput && !q.answered) {
      typeInput.focus();
      typeInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") container.querySelector("#q4CheckTypeBtn")?.click();
      });
    }
    container.querySelector("#q4HintBtn")?.addEventListener("click", () => {
      q.hintUsed = true;
      q.userInput = typeInput?.value || "";
      renderRunning();
    });
    container.querySelector("#q4CheckTypeBtn")?.addEventListener("click", () => {
      if (q.answered) return;
      const val = (typeInput?.value || "").trim();
      if (!val) {
        showToast("Bạn hãy nhập Pinyin hoặc chữ Hán trước khi kiểm tra nhé!");
        return;
      }
      q.userInput = val;
      q.answered = true;
      const normUser = stripPinyinTones(val);
      const normAns = stripPinyinTones(q.word.pinyin);
      q.isCorrect = (val === q.word.hanzi) || (normUser.length > 0 && normUser === normAns);
      if (q.isCorrect) {
        score += 1;
        store.setVocabStatus(q.word.id, "mastered");
      } else {
        recordWrongWord(q.word, `[Gõ nhanh · QUYỂN 4 Bài ${q.word.lesson}] ${getWordMeaning(q.word)}`, val);
      }
      answeredLog.push({ q, isCorrect: q.isCorrect, words: [q.word], userAnswerText: val });
      audioManager.speak(q.word.hanzi);
      renderRunning();
    });

    // Match pairs click
    function tryMatchPair() {
      if (!q.selectedLeft || !q.selectedRight) return;
      if (q.selectedLeft === q.selectedRight) {
        q.matchedIds.add(q.selectedLeft);
        const matchedWord = q.words.find((w) => w.id === q.selectedLeft);
        if (matchedWord) audioManager.speak(matchedWord.hanzi);
        q.selectedLeft = null;
        q.selectedRight = null;
        if (q.matchedIds.size === q.words.length) {
          q.done = true;
          const perfect = q.wrongAttempts === 0;
          if (perfect) score += 1;
          answeredLog.push({ q, isCorrect: perfect, words: q.words, userAnswerText: `${q.words.length}/${q.words.length} cặp (nhầm ${q.wrongAttempts} lần)` });
        }
      } else {
        q.wrongAttempts += 1;
        const leftWord = q.words.find((w) => w.id === q.selectedLeft);
        if (leftWord) {
          recordWrongWord(leftWord, `[Nối cặp · QUYỂN 4 Bài ${leftWord.lesson}] ${leftWord.hanzi}`, "Nối nhầm nghĩa");
        }
        showToast("Chưa khớp rồi, thử ghép lại cặp này nhé!");
        q.selectedLeft = null;
        q.selectedRight = null;
      }
      renderRunning();
    }

    container.querySelectorAll("[data-match-left]").forEach((btn) => {
      btn.addEventListener("click", () => {
        q.selectedLeft = btn.dataset.matchLeft;
        tryMatchPair();
        if (!q.selectedRight) renderRunning();
      });
    });
    container.querySelectorAll("[data-match-right]").forEach((btn) => {
      btn.addEventListener("click", () => {
        q.selectedRight = btn.dataset.matchRight;
        tryMatchPair();
        if (!q.selectedLeft) renderRunning();
      });
    });

    // Next button
    container.querySelector("#q4NextBtn")?.addEventListener("click", () => {
      if (currentIdx + 1 < questions.length) {
        currentIdx += 1;
        renderRunning();
      } else {
        finishQuiz();
      }
    });
  }

  function renderAnswerExplainBox(w, isCorrect) {
    const colls = (w.collocations || []).slice(0, 4).join(" · ");
    const exZh = getWordExample(w);
    const exVi = getWordExampleVi(w);
    return `
      <div class="feedback-box ${isCorrect ? "feedback-ok" : "feedback-err"}" style="margin-top:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <strong>${isCorrect ? "✅ Chính xác!" : "❌ Chưa đúng — đã tự lưu vào Sổ ôn tập cá nhân!"}</strong>
          <button type="button" class="btn btn-sm btn-outline" data-speak="${escapeHtml(w.hanzi)}">🔊 Nghe lại</button>
        </div>
        <div style="margin-top:6px;">
          <strong class="zh" style="font-size:1.25rem;">${makeClickableHanzi(w.hanzi)}</strong>
          <span class="pinyin" style="margin-left:6px;">${escapeHtml(w.pinyin)}</span>
          <span class="badge badge-mint" style="margin-left:6px;">${escapeHtml(getWordPos(w))}</span>
          — <strong>${escapeHtml(getWordMeaning(w))}</strong>
        </div>
        ${colls ? `<div class="muted-sm" style="margin-top:4px;"><strong>Kết hợp từ (搭配):</strong> <span class="zh">${escapeHtml(colls)}</span></div>` : ""}
        ${exZh ? `<div class="muted-sm" style="margin-top:4px;"><strong>Ví dụ sách QUYỂN 4:</strong> <span class="zh">${escapeHtml(exZh)}</span>${exVi ? ` — <em>${escapeHtml(exVi)}</em>` : ""}</div>` : ""}
      </div>
    `;
  }

  function renderResults() {
    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
    const wrongWordsMap = new Map();
    for (const log of answeredLog) {
      if (!log.isCorrect) {
        for (const w of log.words) wrongWordsMap.set(w.id, w);
      }
    }
    const wrongWords = Array.from(wrongWordsMap.values());

    container.innerHTML = `
      <div class="card card-mint">
        <div class="section-header">
          <div>
            <h2>🏆 Hoàn thành kiểm tra QUYỂN 4: ${score} / ${questions.length} (${pct}%)</h2>
            <p class="muted-sm">
              ${pct >= 90 ? "Xuất sắc! Bạn nắm rất vững các từ trong phạm vi vừa kiểm tra!" : pct >= 70 ? "Làm rất tốt! Hãy ôn lại nhanh vài từ còn nhầm bên dưới nhé." : "Cố lên nhé! Mọi từ sai đã được tự động lưu vào Sổ ôn tập cá nhân."}
            </p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${wrongWords.length ? `<button type="button" class="btn btn-yellow" id="q4RetryWrong">🔁 Kiểm tra lại ${wrongWords.length} từ sai</button>` : ""}
            <button type="button" class="btn btn-primary" id="q4NewRound">↻ Chọn bài / Làm lượt mới</button>
            <a href="#review" class="btn btn-outline">🔖 Sổ ôn tập cá nhân</a>
          </div>
        </div>
      </div>

      <div class="card" style="overflow-x:auto;">
        <h3>Chi tiết kết quả từng câu</h3>
        <table class="data-table">
          <thead>
            <tr><th>#</th><th>Dạng</th><th>Từ vựng (Bài)</th><th>Nghĩa tiếng Việt</th><th>Kết quả</th><th>Nghe</th></tr>
          </thead>
          <tbody>
            ${answeredLog.map((log, i) => {
              const typeInfo = QUIZ_TYPES.find((t) => t.id === log.q.type) || QUIZ_TYPES[0];
              const w = log.words[0];
              return `
                <tr>
                  <td>${i + 1}</td>
                  <td><span class="badge badge-gray">${typeInfo.icon} ${escapeHtml(typeInfo.label)}</span></td>
                  <td>
                    ${log.words.map((item) => `<strong class="zh">${makeClickableHanzi(item.hanzi)}</strong> <span class="pinyin" style="font-size:0.8rem;">(${escapeHtml(item.pinyin)})</span> <span class="muted-sm">[B${item.lesson}]</span>`).join("<br/>")}
                  </td>
                  <td>${log.words.map((item) => escapeHtml(getWordMeaning(item))).join("<br/>")}</td>
                  <td>${log.isCorrect ? `<span class="badge badge-mint">✓ Đúng</span>` : `<span class="badge badge-coral">✗ Nhầm (${escapeHtml(log.userAnswerText)})</span>`}</td>
                  <td><button type="button" class="icon-btn" style="width:26px; height:26px;" data-speak="${escapeHtml(w.hanzi)}">🔊</button></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelector("#q4RetryWrong")?.addEventListener("click", () => startQuiz(wrongWords));
    container.querySelector("#q4NewRound")?.addEventListener("click", () => { phase = "setup"; renderSetup(); });
    container.querySelectorAll("[data-speak]").forEach((b) => {
      b.addEventListener("click", () => audioManager.speak(b.dataset.speak));
    });
  }

  renderSetup();
}
