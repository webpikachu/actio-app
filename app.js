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
    tg.expand();
    tg.ready();
    
    const { data: profile } = await client.from('profiles').select('role').eq('user_id', userId).single();
    
    if (profile) {
        userRole = profile.role;
    }

    updateUIByRole();
    showPage('page-market');
}

function updateUIByRole() {
    const navHrBtn = document.getElementById('nav-hr-btn'); // Кнопка "Сигналы" в меню
    const profileTab = document.querySelector('[onclick="showPage(\'page-profile\')"]'); // Вкладка Профиль

    if (userRole === 'hr') {
        if (navHrBtn) navHrBtn.classList.remove('hidden');
        // Если ты HR, тебе не нужно создавать карточки соискателя
        // Мы можем скрыть кнопку "Добавить роль" на странице профиля
        const addBtn = document.querySelector('button[onclick*="page-role-create"]');
        if (addBtn) addBtn.style.display = 'none';
    } else {
        if (navHrBtn) navHrBtn.classList.add('hidden');
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
    const title = document.getElementById('v-title').value.trim();
    const city = document.getElementById('v-city').value.trim();
    const level = document.getElementById('v-level').value;
    const sMin = document.getElementById('v-salary-min').value;
    const sMax = document.getElementById('v-salary-max').value;
    const desc = document.getElementById('v-desc').value.trim();
    const stackInput = document.getElementById('v-stack-input').value.trim();

    // 1. ПРОВЕРКА РОЛИ (Самое важное!)
    if (userRole !== 'hr') {
        console.error("Ошибка прав: Текущая роль -", userRole);
        return tg.showAlert("Ошибка доступа: В базе вы не числитесь как HR. Нажмите /start в боте и выберите 'Рекрутер'");
    }

    if (!title) return tg.showAlert("Введите название позиции!");

    // 2. АВТО-СТЕК: если массив пуст, берем текст из инпута
    let finalStack = vacancyTechStack;
    if (finalStack.length === 0 && stackInput) {
        finalStack = stackInput.split(',').map(s => s.trim());
    }
    
    if (finalStack.length === 0) return tg.showAlert("Укажите стек технологий!");

    // 3. ОТПРАВКА (Используем client!)
    const { data, error } = await client.from('vacancies').insert([{
        hr_id: userId,
        title: title,
        city: city || 'Remote',
        level: level,
        salary_min: parseInt(sMin) || 0,
        salary_max: parseInt(sMax) || 0,
        tech_stack: finalStack,
        description: desc,
        currency: '₽'
    }]).select();

    if (error) {
        console.error("Supabase Error:", error);
        tg.showAlert("Ошибка базы: " + error.message);
    } else {
        tg.HapticFeedback.notificationOccurred('success');
        tg.showAlert("🚀 Сигнал опубликован!");
        vacancyTechStack = [];
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