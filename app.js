const tg = window.Telegram.WebApp;
const SUPABASE_URL = "https://cgdeaibhadwsxqebohcj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGVhaWJoYWR3c3hxZWJvaGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzQ0OTYsImV4cCI6MjA4MjI1MDQ5Nn0._JQQBh9JVswhMoxmthN2U1l-Bvs65-bSSsNdv51sPvQ"; 
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userRole = 'candidate';
let selectedVacancy = null;
let currentSkills = []; // Массив для хранения навыков
let selectedRoleName = "";

// --- 1. ИНИЦИАЛИЗАЦИЯ ---
async function init() {
    try {
        tg.expand();
        tg.ready();
        const userId = tg.initDataUnsafe?.user?.id || 1205293207; 
        
        const { data: profile } = await client.from('profiles').select('role').eq('user_id', userId).single();
        if (profile) userRole = profile.role;
        
        renderHeader();
        loadMarket();
    } catch (e) { 
        console.error("Init Error:", e); 
        renderHeader(); 
        loadMarket(); 
    }
}

// --- 2. КОНСТРУКТОР РОЛЕЙ (ПРОФИЛЬ) ---

// Функция добавления навыка
function addSkill() {
    const input = document.getElementById('skill-input');
    const val = input.value.trim();
    if (val && !currentSkills.includes(val)) {
        currentSkills.push(val);
        input.value = '';
        renderSkills();
    }
}

// Функция удаления навыка
function removeSkill(index) {
    currentSkills.splice(index, 1);
    renderSkills();
}

// Отрисовка чипсов навыков
function renderSkills() {
    const container = document.getElementById('skills-container');
    if (!container) return;
    container.innerHTML = currentSkills.map((s, i) => `
        <div class="flex items-center h-8 px-3 rounded-lg bg-primary/10 border border-primary/20">
            <span class="text-sm mr-1 font-medium">${s}</span>
            <span onclick="removeSkill(${i})" class="material-symbols-outlined text-[16px] cursor-pointer hover:text-red-500">close</span>
        </div>
    `).join('');
}

// ФУНКЦИЯ СОХРАНЕНИЯ РОЛИ (ФИКС)
async function saveRole() {
    const nameInput = document.getElementById('role-name');
    const expInput = document.getElementById('experience');
    const btn = document.getElementById('save-role-btn');

    const name = nameInput.value.trim();
    const exp = expInput.value.trim();

    if (!name) return tg.showAlert("Введите название роли!");

    // Визуальный фидбек
    btn.disabled = true;
    btn.innerText = "Сохранение...";

    try {
        const userId = tg.initDataUnsafe?.user?.id || 1205293207;

        const { error } = await client.from('user_roles').insert([{
            user_id: userId,
            role_name: name,
            skills: currentSkills,
            experience: exp
        }]);

        if (error) throw error;

        tg.showAlert("Роль успешно сохранена!");
        
        // Очистка формы
        nameInput.value = '';
        expInput.value = '';
        currentSkills = [];
        renderSkills();
        
        // Переход на маркет
        showPage('page-market');
    } catch (err) {
        console.error("Save Error:", err.message);
        tg.showAlert("Ошибка сохранения: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Сохранить Роль";
    }
}

// --- 3. ОСТАЛЬНАЯ ЛОГИКА (HR И МАРКЕТ) ---

function renderHeader() {
    const actions = document.getElementById('header-actions');
    if (userRole === 'hr') {
        actions.innerHTML = `<button onclick="showPage('page-post-vacancy')" class="bg-primary px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">+ Вакансия</button>`;
    } else {
        actions.innerHTML = `<button onclick="showPage('page-profile')" class="text-primary font-bold italic">Мои Роли</button>`;
    }
}

async function publishVacancy() {
    const title = document.getElementById('v-title').value;
    const city = document.getElementById('v-city').value;
    const desc = document.getElementById('v-desc').value;
    const level = document.querySelector('input[name="level"]:checked')?.value || 'middle';
    const sMin = parseInt(document.getElementById('v-salary-min').value) || 0;
    const sMax = parseInt(document.getElementById('v-salary-max').value) || 0;

    if (!title) return tg.showAlert("Введите название!");

    const { error } = await client.from('vacancies').insert([{
        hr_id: tg.initDataUnsafe?.user?.id,
        title, city, level, description: desc, salary_min: sMin, salary_max: sMax
    }]);

    if (!error) {
        tg.showAlert("Вакансия на рынке!");
        showPage('page-market');
        loadMarket();
    }
}

async function loadMarket() {
    const list = document.getElementById('vacancies-list');
    list.innerHTML = `<p class='text-center py-10 opacity-50 italic'>Синхронизация...</p>`;
    const { data } = await client.from('vacancies').select('*').order('created_at', { ascending: false });
    if (data) {
        list.innerHTML = data.map(v => `
            <div onclick="openVacancy('${v.id}')" class="bg-surface-dark p-5 rounded-2xl border border-border-dark active:scale-[0.98] transition-all">
                <h3 class="text-lg font-bold italic">${v.title}</h3>
                <p class="text-[10px] text-gray-500 uppercase font-bold mt-2">${v.city || 'Удаленно'} • ${v.salary_min} ₽</p>
            </div>
        `).join('');
    }
}

async function openVacancy(id) {
    const { data: v } = await client.from('vacancies').select('*').eq('id', id).single();
    if (v) {
        selectedVacancy = v;
        document.getElementById('v-details-content').innerHTML = `
            <div class="p-8 text-center bg-surface-dark mb-4 border-b border-border-dark">
                <h2 class="text-2xl font-bold italic">${v.title}</h2>
                <p class="text-primary font-bold mt-1 uppercase text-xs">${v.city} • ${v.level}</p>
            </div>
            <div class="px-6 space-y-4">
                <h3 class="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Описание</h3>
                <p class="text-gray-300 leading-relaxed">${v.description || 'Описание отсутствует'}</p>
            </div>
        `;
        showPage('page-vacancy-details');
    }
}

async function openRoleSheet() {
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('role-sheet').classList.add('active');
    const { data } = await client.from('user_roles').select('*').eq('user_id', tg.initDataUnsafe?.user?.id);
    const container = document.getElementById('roles-list-container');
    if (data && data.length > 0) {
        container.innerHTML = data.map(r => `
            <label class="flex items-center justify-between p-4 rounded-xl border border-border-dark bg-surface-dark">
                <span class="font-bold">${r.role_name}</span>
                <input type="radio" name="r_sel" value="${r.role_name}" onchange="selectedRoleName='${r.role_name}'" class="w-6 h-6 text-primary">
            </label>
        `).join('');
    } else {
        container.innerHTML = `<p class="text-center py-4 text-gray-500">У вас нет созданных ролей.</p>`;
    }
}

function confirmApply() {
    if (!selectedRoleName) return tg.showAlert("Выберите роль!");
    tg.sendData(JSON.stringify({ action: 'new_apply', hr_id: selectedVacancy.hr_id, role: selectedVacancy.title }));
    tg.close();
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function closeRoleSheet() {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('role-sheet').classList.remove('active');
}

init();