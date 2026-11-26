// Khởi động ứng dụng, định tuyến (Router) và sự kiện toàn cục

import { store } from "./store.js";
import { audioManager } from "./audio.js";
import { ENCOURAGEMENTS, escapeHtml } from "./mascots.js";
import { renderDefaultSidePanel, showHanziAnalysis, closeMobileDrawer } from "./hanziPanel.js";
import { renderHomeView } from "./views/homeView.js";
import { renderBasicsView } from "./views/basicsView.js";
import { renderLessonView } from "./views/lessonView.js";
import { renderAdvancedHubView, renderStationDetailView } from "./views/advancedView.js";
import { renderSpeedTestView, cleanupSpeedTestTimer } from "./views/speedTestView.js";
import { renderReviewView } from "./views/reviewView.js";
import { openTutorModal } from "./views/tutorModal.js";
import { openGlobalSearchModal } from "./globalSearch.js";

let encourageIdx = 0;
let nudgeShownThisSession = false;

function renderEncouragement() {
  const item = ENCOURAGEMENTS[encourageIdx % ENCOURAGEMENTS.length];
  const mascot = document.getElementById("encourageMascot");
  const text = document.getElementById("encourageText");
  if (mascot) mascot.textContent = item.icon;
  if (text) text.innerHTML = `<strong class="zh">${escapeHtml(item.zh)}</strong> — ${escapeHtml(item.vi)}`;
}

function setActiveNav(routeKey) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === routeKey);
  });
}

async function handleRoute() {
  cleanupSpeedTestTimer();
  audioManager.stop();
  closeMobileDrawer();

  const mainView = document.getElementById("mainView");
  const hash = (location.hash || "#home").replace(/^#/, "");
  const [route, param, subParam] = hash.split("/");

  // Đóng menu mobile khi chuyển trang
  document.getElementById("mainNav")?.classList.remove("open");

  if (route === "basics") {
    setActiveNav("basics");
    renderBasicsView(mainView);
  } else if (route === "lesson" && param) {
    setActiveNav("basics");
    await renderLessonView(mainView, param, subParam || null);
  } else if (route === "advanced") {
    setActiveNav("advanced");
    renderAdvancedHubView(mainView);
  } else if (route === "station" && param) {
    setActiveNav("advanced");
    renderStationDetailView(mainView, param, subParam || null);
  } else if (route === "speedtest") {
    setActiveNav("speedtest");
    renderSpeedTestView(mainView, "paper");
  } else if (route === "quyen4") {
    setActiveNav("speedtest");
    renderSpeedTestView(mainView, "quyen4");
  } else if (route === "review") {
    setActiveNav("review");
    renderReviewView(mainView);
  } else {
    setActiveNav("home");
    renderHomeView(mainView);
  }

  renderDefaultSidePanel();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Thỉnh thoảng (tối đa 1 lần mỗi phiên, không gây phiền) nhắc ôn nhanh 1 câu hỏi đa dạng (Từ vựng / Ngữ pháp / Cận nghĩa / Đa âm / Sửa lỗi)
 */
function maybeScheduleGentleNudge() {
  // Chức năng Trợ lý học tập & hỏi bài nhanh nay chỉ tập trung gọn tại Trang chủ để tránh gây phân tâm ở các trang học/làm bài.
  return;
}

function setupGlobalEvents() {
  // Nhấp vào bất kỳ chữ Hán nào có class .hanzi-char -> Mở bảng Phân tích chữ Hán
  document.addEventListener("click", (e) => {
    if (e.target.closest("#sideCloseBtn")) {
      e.stopPropagation();
      closeMobileDrawer();
      return;
    }
    const target = e.target.closest(".hanzi-char");
    if (target && target.dataset.hanzi) {
      // Nếu nằm trong span .text-vocab-hl mà không giữ Alt thì để handler của text-vocab-hl xử lý trước
      if (target.closest(".text-vocab-hl") && !e.altKey) return;
      showHanziAnalysis(target.dataset.hanzi);
      return;
    }
    // Nếu bảng phụ đang mở tạm (temp-open) ở trang ngoài Trang chủ và người dùng click ra ngoài bảng -> tự đóng gọn
    const sp = document.getElementById("sidePanel");
    if (sp?.classList.contains("temp-open") && !e.target.closest("#sidePanel") && !e.target.closest("[data-vocab-detail]") && !e.target.closest(".text-vocab-hl")) {
      closeMobileDrawer();
    }
  });

  document.getElementById("nextEncourageBtn")?.addEventListener("click", () => {
    encourageIdx = (encourageIdx + 1) % ENCOURAGEMENTS.length;
    renderEncouragement();
  });

  document.getElementById("mobileMenuBtn")?.addEventListener("click", () => {
    document.getElementById("mainNav")?.classList.toggle("open");
  });

  document.getElementById("sideCloseBtn")?.addEventListener("click", closeMobileDrawer);
  document.getElementById("drawerBackdrop")?.addEventListener("click", closeMobileDrawer);

  document.getElementById("openSearchBtn")?.addEventListener("click", () => {
    openGlobalSearchModal();
  });
  document.getElementById("closeSearchModal")?.addEventListener("click", () => {
    const m = document.getElementById("globalSearchModal");
    if (m) m.hidden = true;
  });
  document.getElementById("globalSearchModal")?.addEventListener("click", (e) => {
    if (e.target.id === "globalSearchModal") e.target.hidden = true;
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openGlobalSearchModal();
    } else if (e.key === "Escape") {
      const sm = document.getElementById("globalSearchModal");
      if (sm && !sm.hidden) sm.hidden = true;
      const tm = document.getElementById("tutorModal");
      if (tm && !tm.hidden) tm.hidden = true;
      closeMobileDrawer();
    }
  });

  document.getElementById("openTutorBtn")?.addEventListener("click", () => {
    openTutorModal(() => handleRoute());
  });
  document.getElementById("closeTutorModal")?.addEventListener("click", () => {
    const m = document.getElementById("tutorModal");
    if (m) m.hidden = true;
  });
  document.getElementById("tutorModal")?.addEventListener("click", (e) => {
    if (e.target.id === "tutorModal") e.target.hidden = true;
  });

  document.querySelectorAll(".nav-link, .brand").forEach((link) => {
    link.addEventListener("click", (e) => {
      const targetRoute = link.dataset.route;
      if (!targetRoute) return;
      e.preventDefault();
      const targetHash = `#${targetRoute}`;
      if (location.hash !== targetHash) {
        location.hash = targetHash;
      } else {
        handleRoute();
      }
    });
  });

  window.addEventListener("hashchange", handleRoute);
}

async function boot() {
  renderEncouragement();
  setupGlobalEvents();
  try {
    await store.init();
    await handleRoute();
    maybeScheduleGentleNudge();
  } catch (err) {
    const mainView = document.getElementById("mainView");
    if (mainView) {
      mainView.innerHTML = `
        <div class="card card-yellow">
          <h3>⚠ Không thể tải dữ liệu JSON</h3>
          <p>${escapeHtml(err.message)}</p>
          <p class="muted-sm">Hãy chắc chắn bạn mở website bằng cách nhấp đúp tệp <strong>Mo_Website.bat</strong> (chạy qua <code>http://localhost:8080</code>) thay vì mở trực tiếp tệp <code>index.html</code> nhé!</p>
        </div>
      `;
    }
  }
}

boot();
