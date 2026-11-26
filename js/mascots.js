// Cute SVG mascots, bilingual encouragements & shared UI helpers

export const ENCOURAGEMENTS = [
  { icon: "🐰", zh: "今天也要加油！", vi: "Hôm nay cũng cố gắng nhé!" },
  { icon: "🐻", zh: "一步一步来，别着急。", vi: "Cứ từng bước một, đừng vội nhé." },
  { icon: "🐱", zh: "你一定可以的！", vi: "Bạn nhất định làm được!" },
  { icon: "🌱", zh: "每天进步一点点。", vi: "Mỗi ngày tiến bộ thêm một chút." },
  { icon: "📚", zh: "坚持就是胜利！", vi: "Kiên trì chính là chiến thắng!" },
  { icon: "🍵", zh: "用心去学，快乐复习。", vi: "Học bằng cả trái tim, ôn tập thật vui." }
];

export const MASCOT_SVGS = {
  bunny: `
    <svg viewBox="0 0 120 120" width="96" height="96" aria-hidden="true">
      <ellipse cx="44" cy="30" rx="10" ry="25" fill="#fff" stroke="#2D6A4F" stroke-width="2.5"/>
      <ellipse cx="44" cy="32" rx="5" ry="16" fill="#FDE2E2"/>
      <ellipse cx="76" cy="30" rx="10" ry="25" fill="#fff" stroke="#2D6A4F" stroke-width="2.5"/>
      <ellipse cx="76" cy="32" rx="5" ry="16" fill="#FDE2E2"/>
      <circle cx="60" cy="68" r="32" fill="#fff" stroke="#2D6A4F" stroke-width="2.5"/>
      <circle cx="48" cy="64" r="3.5" fill="#1B4332"/>
      <circle cx="72" cy="64" r="3.5" fill="#1B4332"/>
      <ellipse cx="40" cy="72" rx="5" ry="3" fill="#FDE2E2"/>
      <ellipse cx="80" cy="72" rx="5" ry="3" fill="#FDE2E2"/>
      <path d="M55 72 Q60 77 65 72" fill="none" stroke="#2D6A4F" stroke-width="2.2" stroke-linecap="round"/>
      <rect x="36" y="88" width="48" height="22" rx="6" fill="#B7E4C7" stroke="#2D6A4F" stroke-width="2.2"/>
      <line x1="60" y1="88" x2="60" y2="110" stroke="#2D6A4F" stroke-width="2"/>
      <text x="48" y="103" font-size="11" fill="#1B4332" font-weight="bold" text-anchor="middle">汉</text>
      <text x="72" y="103" font-size="11" fill="#1B4332" font-weight="bold" text-anchor="middle">语</text>
    </svg>
  `,
  bear: `
    <svg viewBox="0 0 110 110" width="76" height="76" aria-hidden="true">
      <circle cx="32" cy="34" r="12" fill="#E9D8B4" stroke="#2D6A4F" stroke-width="2.4"/>
      <circle cx="78" cy="34" r="12" fill="#E9D8B4" stroke="#2D6A4F" stroke-width="2.4"/>
      <circle cx="55" cy="58" r="30" fill="#F3E6C8" stroke="#2D6A4F" stroke-width="2.4"/>
      <ellipse cx="55" cy="66" rx="13" ry="10" fill="#FFFDF7"/>
      <circle cx="44" cy="53" r="3.2" fill="#1B4332"/>
      <circle cx="66" cy="53" r="3.2" fill="#1B4332"/>
      <ellipse cx="55" cy="62" rx="4" ry="2.6" fill="#2D6A4F"/>
      <path d="M50 69 Q55 73 60 69" fill="none" stroke="#2D6A4F" stroke-width="2" stroke-linecap="round"/>
      <path d="M55 24 C50 18 46 18 48 13 C52 13 55 17 55 24 Z" fill="#52B788" stroke="#2D6A4F" stroke-width="1.6"/>
      <path d="M55 24 C60 18 64 18 62 13 C58 13 55 17 55 24 Z" fill="#74C69D" stroke="#2D6A4F" stroke-width="1.6"/>
    </svg>
  `,
  cat: `
    <svg viewBox="0 0 110 110" width="76" height="76" aria-hidden="true">
      <polygon points="30,44 36,18 52,36" fill="#FFF8E7" stroke="#2D6A4F" stroke-width="2.4" stroke-linejoin="round"/>
      <polygon points="80,44 74,18 58,36" fill="#FFF8E7" stroke="#2D6A4F" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="55" cy="60" r="29" fill="#FFF8E7" stroke="#2D6A4F" stroke-width="2.4"/>
      <circle cx="44" cy="56" r="3.2" fill="#1B4332"/>
      <circle cx="66" cy="56" r="3.2" fill="#1B4332"/>
      <path d="M51 64 Q55 68 59 64" fill="none" stroke="#2D6A4F" stroke-width="2" stroke-linecap="round"/>
      <line x1="25" y1="60" x2="36" y2="62" stroke="#2D6A4F" stroke-width="1.8"/>
      <line x1="25" y1="67" x2="36" y2="67" stroke="#2D6A4F" stroke-width="1.8"/>
      <line x1="85" y1="60" x2="74" y2="62" stroke="#2D6A4F" stroke-width="1.8"/>
      <line x1="85" y1="67" x2="74" y2="67" stroke="#2D6A4F" stroke-width="1.8"/>
    </svg>
  `
};

export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isChineseChar(ch) {
  return /[\u4e00-\u9fff]/.test(ch);
}

/**
 * Biến từng chữ Hán trong chuỗi thành span có thể nhấp để mở Phân tích chữ Hán
 */
export function makeClickableHanzi(text = "") {
  return Array.from(text).map((ch) => {
    if (isChineseChar(ch)) {
      return `<span class="hanzi-char" data-hanzi="${ch}" title="Nhấp để phân tích chữ ${ch}">${ch}</span>`;
    }
    return escapeHtml(ch);
  }).join("");
}

/**
 * Tô nổi bật các từ vựng thuộc bài học trong câu bài khóa, đồng thời giữ từng chữ Hán có thể phân tích
 */
export function highlightVocabInText(chineseText, vocabList = []) {
  if (!chineseText) return "";
  const sorted = [...vocabList]
    .filter((v) => v.hanzi && v.hanzi.length > 0)
    .sort((a, b) => b.hanzi.length - a.hanzi.length);

  if (!sorted.length) return makeClickableHanzi(chineseText);

  let result = "";
  let i = 0;
  while (i < chineseText.length) {
    let matched = null;
    for (const v of sorted) {
      if (chineseText.startsWith(v.hanzi, i)) {
        matched = v;
        break;
      }
    }
    if (matched) {
      result += `<span class="text-vocab-hl" data-vocab-id="${escapeHtml(matched.id)}" title="${escapeHtml(matched.hanzi)} (${escapeHtml(matched.pinyin)}): ${escapeHtml(matched.lesson_usage?.meaning || "")}">${makeClickableHanzi(matched.hanzi)}</span>`;
      i += matched.hanzi.length;
    } else {
      const ch = chineseText[i];
      result += isChineseChar(ch)
        ? `<span class="hanzi-char" data-hanzi="${ch}" title="Nhấp để phân tích chữ ${ch}">${ch}</span>`
        : escapeHtml(ch);
      i += 1;
    }
  }
  return result;
}

export function showToast(message, duration = 2600) {
  const box = document.getElementById("toastContainer");
  if (!box) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.25s";
    setTimeout(() => el.remove(), 260);
  }, duration);
}

export const LESSON_STATUS_LABELS = {
  not_started: "Chưa học",
  in_progress: "Đang học",
  completed: "Đã hoàn thành",
  needs_review: "Cần ôn tập"
};

export const VOCAB_STATUS_LABELS = {
  unlearned: "Chưa thuộc",
  learning: "Đang học",
  mastered: "Đã nhớ",
  needs_review: "Cần ôn tập"
};

export const SOURCE_STATUS_META = {
  verified_textbook: { label: "Chính thức từ giáo trình (docs/)", cls: "badge-mint" },
  verified_source: { label: "Đã xác minh nguồn học thuật", cls: "badge-mint" },
  synthesized: { label: "Tổng hợp từ nguồn uy tín", cls: "badge-blue" },
  authored_linguistics: { label: "Biên soạn dựa trên ngôn ngữ học", cls: "badge-yellow" },
  unverified: { label: "Chưa xác minh đầy đủ", cls: "badge-gray" },
  demo: { label: "Dữ liệu mẫu", cls: "badge-gray" }
};
