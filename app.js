const tg = window.Telegram.WebApp;

// 1. ИСПРАВЛЕНИЕ: Используйте 'client', чтобы не перекрывать глобальный объект 'supabase'
const SUPABASE_URL = "https://cgdeaibhadwsxqebohcj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGVhaWJoYWR3c3hxZWJvaGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzQ0OTYsImV4cCI6MjA4MjI1MDQ5Nn0._JQQBh9JVswhMoxmthN2U1l-Bvs65-bSSsNdv51sPvQ"; 
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userRole = 'candidate';
let selectedVacancy = null;
let currentSkills = []; // Для создания роли соискателя
let vacancyTechStack = []; // Для создания вакансии HR
const userId = tg.initDataUnsafe?.user?.id || 1205293207;

async function init() {
    console.log("🚀 Инициализация Actio для ID:", userId);
    tg.expand();
    tg.ready();
    
    try {
        // Проверяем роль в базе
        const { data: profile, error } = await client
            .from('profiles')
            .select('role')
            .eq('user_id', userId)
            .single();
        
        if (error) {
            console.warn("⚠️ Профиль не найден или ошибка:", error.message);
        }

        if (profile) {
            userRole = profile.role;
            console.log("✅ Роль из базы подтверждена:", userRole);
        }

        // Обновляем видимость элементов интерфейса в зависимости от роли
        updateUIByRole();
        
        // Загружаем стартовую страницу
        showPage('page-market');

    } catch (e) {
        console.error("❌ Критическая ошибка инициализации:", e);
    }
}

function updateUIByRole() {
    const navHrBtn = document.getElementById('nav-hr-btn');
    const createRoleBtn = document.querySelector('[onclick="showPage(\'page-role-create\')"]');

    if (userRole === 'hr') {
        console.log("💼 Режим HR активен");
        if (navHrBtn) navHrBtn.classList.remove('hidden');
        // Прячем функционал соискателя от рекрутера, чтобы он не создавал лишних ролей
        if (createRoleBtn) createRoleBtn.classList.add('hidden');
    } else {
        console.log("👤 Режим Соискателя активен");
        if (navHrBtn) navHrBtn.classList.add('hidden');
        if (createRoleBtn) createRoleBtn.classList.remove('hidden');
    }
}

// --- НАВИГАЦИЯ ---
function showPage(id) {
    console.log("📂 Переход на страницу:", id);
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');

    // Сброс прозрачности кнопок навигации
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.add('opacity-40'));

    // Авто-загрузка данных
    if (id === 'page-market') loadMarket();
    if (id === 'page-profile') { loadUserRoles(); loadMyApplications(); }
    if (id === 'page-hr') loadMyVacancies();

    tg.HapticFeedback.impactOccurred('light');
}

// --- ЛОГИКА HR (ВАКАНСИИ) ---
function addTechTag() {
    const input = document.getElementById('v-stack-input');
    const tag = input.value.trim();
    if (tag && !vacancyTechStack.includes(tag)) {
        vacancyTechStack.push(tag);
        renderTechTags();
        input.value = '';
    }
}

function renderTechTags() {
    const container = document.getElementById('v-tech-list');
    if (!container) return;
    container.innerHTML = vacancyTechStack.map((t, i) => `
        <div class="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-xl">
            <span class="text-[10px] font-black text-primary uppercase">${t}</span>
            <button onclick="removeTechTag(${i})" class="material-symbols-outlined text-sm">close</button>
        </div>
    `).join('');
}

function removeTechTag(index) {
    vacancyTechStack.splice(index, 1);
    renderTechTags();
}

async function publishVacancy() {
    console.log("📡 Попытка публикации вакансии...");
    
    // Проверка роли перед отправкой (защита)
    if (userRole !== 'hr') {
        return tg.showAlert("Ошибка: Только рекрутеры могут создавать вакансии!");
    }

    const title = document.getElementById('v-title').value.trim();
    const city = document.getElementById('v-city').value.trim();
    const level = document.getElementById('v-level').value;
    const sMin = document.getElementById('v-salary-min').value;
    const sMax = document.getElementById('v-salary-max').value;
    const desc = document.getElementById('v-desc').value.trim();

    if (!title) return tg.showAlert("Введите название позиции!");
    if (vacancyTechStack.length === 0) return tg.showAlert("Укажите хотя бы один навык в стеке!");

    const { data, error } = await client.from('vacancies').insert([{
        hr_id: userId,
        title: title,
        city: city || 'Remote',
        level: level,
        salary_min: parseInt(sMin) || 0,
        salary_max: parseInt(sMax) || 0,
        tech_stack: vacancyTechStack,
        description: desc,
        currency: '₽'
    }]);

    if (error) {
        console.error("❌ Ошибка Supabase при вставке:", error);
        tg.showAlert("Ошибка базы данных: " + error.message);
    } else {
        console.log("✅ Вакансия создана!");
        tg.HapticFeedback.notificationOccurred('success');
        tg.showAlert("Сигнал успешно отправлен в маркет!");
        
        // Очистка
        vacancyTechStack = [];
        document.getElementById('v-title').value = '';
        document.getElementById('v-desc').value = '';
        renderTechTags();
        showPage('page-market');
    }
}

// --- ЛОГИКА СОИСКАТЕЛЯ (РОЛИ) ---
async function loadUserRoles() {
    const container = document.getElementById('user-roles-list');
    // ВАЖНО: фильтруем строго по userId, чтобы соискатель видел только СВОИ роли
    const { data, error } = await client
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);
    
    if (data) {
        container.innerHTML = data.map(r => `
            <div class="p-5 bg-surface-dark border border-border-dark rounded-2xl shadow-lg mb-3">
                <div class="font-black italic uppercase tracking-tighter text-sm mb-1">${r.role_name}</div>
                <div class="text-[9px] opacity-40 font-bold uppercase tracking-widest">${(r.skills || []).join(', ')}</div>
            </div>
        `).join('');
    } else {
        container.innerHTML = `<p class="text-xs opacity-20 text-center py-4">У вас пока нет созданных ролей</p>`;
    }
}

// ... (остальные функции loadMarket, loadMyApplications, loadMyVacancies оставить как есть, но убедиться в использовании 'client' вместо 'supabase')

async function saveRole() {
    const name = document.getElementById('role-name').value.trim();
    // ... логика сохранения роли ...
    // Обязательно добавьте .eq('user_id', userId) в фильтры
}

init();