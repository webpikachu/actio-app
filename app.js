const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log("🧠 [Actio]", ...args);
}

function errorLog(...args) {
  console.error("❌ [Actio]", ...args);
}

/* ==============================
   TELEGRAM INIT
================================ */
const tg = window.Telegram.WebApp;
tg.expand();

/* ==============================
   SUPABASE CONFIG
   (ЗАМЕНИ НА СВОИ ДАННЫЕ)
================================ */
const SUPABASE_URL = "https://cgdeaibhadwsxqebohcj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGVhaWJoYWR3c3hxZWJvaGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzQ0OTYsImV4cCI6MjA4MjI1MDQ5Nn0._JQQBh9JVswhMoxmthN2U1l-Bvs65-bSSsNdv51sPvQ";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
log("Supabase URL:", SUPABASE_URL);
log("Supabase client initialized");

/* ==============================
   USER CONTEXT
================================ */
const currentUserId = tg.initDataUnsafe?.user?.id;

/* ==============================
   UI ELEMENTS
================================ */
const feedContainer = document.getElementById("vacancy-feed");
const createBtn = document.getElementById("nav-create-btn");
const roleBadge = document.getElementById("user-role-badge");

/* ==============================
   APP BOOTSTRAP
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  log("App loaded");

  log("Telegram initData:", tg.initDataUnsafe);

  if (!currentUserId) {
    errorLog("No Telegram user ID");
    if (roleBadge) roleBadge.innerText = "Не в Telegram";
    return;
  }

  log("Current user ID:", currentUserId);

  await checkUserRole(currentUserId);

  if (feedContainer) {
    log("Loading vacancies…");
    loadVacancies();
  }
});


/* ==============================
   ROLE CHECK
================================ */
async function checkUserRole(userId) {
  log("Checking user role for:", userId);

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error) {
    errorLog("Role check error:", error);
    if (roleBadge) roleBadge.innerText = "Ошибка профиля";
    return;
  }

  log("User profile:", profile);

  if (!profile) {
    log("Profile not found");
    if (roleBadge) roleBadge.innerText = "Гость";
    return;
  }

  if (roleBadge) {
    roleBadge.innerText = profile.role === "hr" ? "Рекрутер" : "Соискатель";
  }

  if (profile.role === "hr" && createBtn) {
    log("HR detected, showing create button");
    createBtn.classList.remove("hidden");
  }
}


/* ==============================
   LOAD VACANCIES
================================ */
async function loadVacancies() {
  if (!feedContainer) return;

  feedContainer.innerHTML =
    '<div class="text-center mt-10 text-gray-500">Загрузка вакансий…</div>';

  log("Requesting vacancies from Supabase");

  const { data, error } = await supabaseClient
    .from("vacancies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    errorLog("Vacancies load error:", error);
    feedContainer.innerHTML = `
      <div class="text-center mt-10 text-red-500">
        ❌ Ошибка загрузки вакансий<br/>
        <span class="text-xs">${error.message}</span>
      </div>`;
    return;
  }

  log("Vacancies response:", data);

  if (!data || data.length === 0) {
    log("Vacancies list is empty");
    feedContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center h-64 text-gray-400">
        <span class="text-4xl mb-2">📭</span>
        <p>Вакансий пока нет</p>
      </div>`;
    return;
  }

  feedContainer.innerHTML = data.map(v => `
    <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
      <h3 class="font-bold text-lg">${v.title}</h3>
      <div class="text-sm text-gray-500 mt-1">
        ${v.city || "Удаленно"}
      </div>
      <button
        onclick="openVacancy('${v.id}')"
        class="mt-3 w-full bg-blue-600 text-white py-2 rounded-lg"
      >
        Подробнее
      </button>
    </div>
  `).join("");
}


/* ==============================
   OPEN ROLES SELECTOR
================================ */
function openRolesForVacancy(vacancyId) {
  window.location.href = `roles.html?vacancy_id=${encodeURIComponent(
    vacancyId
  )}`;
}

/* ==============================
   APPLY WITH ROLE + SNAPSHOT
================================ */
async function applyForVacancyWithRole(vacancyId, roleId) {
  tg.MainButton.showProgress();

  const { data: vacancy } = await supabaseClient
    .from("vacancies")
    .select("id, hr_id, response_promise_minutes")
    .eq("id", vacancyId)
    .single();

  const { data: role } = await supabaseClient
    .from("user_roles")
    .select("id, role_name")
    .eq("id", roleId)
    .single();

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("resume_url")
    .eq("user_id", currentUserId)
    .single();

  if (!vacancy || !role) {
    tg.MainButton.hideProgress();
    return tg.showAlert("Ошибка отклика");
  }

  const promiseMin = vacancy.response_promise_minutes || 1440;
  const deadlineAt = new Date(
    Date.now() + promiseMin * 60 * 1000
  ).toISOString();

  const candidateName =
    (tg.initDataUnsafe?.user?.first_name || "Кандидат") +
    " " +
    (tg.initDataUnsafe?.user?.username || "");

  const { error } = await supabaseClient.from("applications").insert([
    {
      vacancy_id: vacancy.id,
      hr_id: vacancy.hr_id,
      candidate_id: currentUserId,
      candidate_name: candidateName,
      role_id: role.id,
      role: role.role_name,
      resume_url: profile?.resume_url || null,
      promise_minutes: promiseMin,
      deadline_at: deadlineAt,
      status: "pending",
    },
  ]);

  tg.MainButton.hideProgress();

  if (error) {
    tg.showAlert("Ошибка: " + error.message);
  } else {
    tg.showAlert("✅ Отклик отправлен. Таймер запущен.");
  }
}

/* ==============================
   ACTIVITY TRACKER
================================ */
async function showActivity() {
  if (!feedContainer) return;

  const { data, error } = await supabaseClient
    .from("applications")
    .select("role, status, created_at, deadline_at")
    .eq("candidate_id", currentUserId)
    .order("created_at", { ascending: false });

  if (error) {
    feedContainer.innerText = "Ошибка: " + error.message;
    return;
  }

  if (!data || data.length === 0) {
    feedContainer.innerHTML =
      '<div class="text-center mt-10 text-gray-500">Откликов нет</div>';
    return;
  }

  feedContainer.innerHTML = data
    .map((a) => {
      const left = a.deadline_at
        ? formatLeft(new Date(a.deadline_at) - Date.now())
        : "—";

      return `
      <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
        <div class="flex justify-between">
          <div class="font-semibold">${escapeHtml(a.role)}</div>
          <span class="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">
            ${escapeHtml(a.status)}
          </span>
        </div>
        <div class="text-sm text-gray-500 mt-2">
          ⏳ До дедлайна: <b>${left}</b>
        </div>
      </div>`;
    })
    .join("");
}

/* ==============================
   PDF RESUME UPLOAD
================================ */
async function uploadResumePdf(file) {
  const maxMB = 3;
  if (!file || file.size > maxMB * 1024 * 1024)
    throw new Error("PDF до 3MB");

  const path = `${currentUserId}/resume.pdf`;

  await supabaseClient.storage
    .from("resumes")
    .upload(path, file, { upsert: true });

  const { data } = supabaseClient.storage
    .from("resumes")
    .getPublicUrl(path);

  await supabaseClient.from("profiles").upsert({
    user_id: currentUserId,
    resume_url: data.publicUrl,
    resume_updated_at: new Date().toISOString(),
  });

  return data.publicUrl;
}

/* ==============================
   HELPERS
================================ */
function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

function formatLeft(ms) {
  if (ms <= 0) return "0:00 (просрочено)";
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(
    2,
    "0"
  )}:${String(s).padStart(2, "0")}`;
}

window.addEventListener("error", (e) => {
  errorLog("Global JS error:", e.message, e.filename, e.lineno);
});

window.addEventListener("unhandledrejection", (e) => {
  errorLog("Unhandled promise rejection:", e.reason);
});
