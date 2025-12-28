const tg = window.Telegram.WebApp;
const SUPABASE_URL = "https://cgdeaibhadwsxqebohcj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGVhaWJoYWR3c3hxZWJvaGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzQ0OTYsImV4cCI6MjA4MjI1MDQ5Nn0._JQQBh9JVswhMoxmthN2U1l-Bvs65-bSSsNdv51sPvQ"; 
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userRole = 'candidate';
let selectedVacancy = null;
let currentSkills = [];

// --- ИНИЦИАЛИЗАЦИЯ ---
async function init() {
    tg.expand();
    tg.ready();
    const userId = tg.initDataUnsafe?.user?.id || 1205293207; 
    
    const { data: profile } = await client.from('profiles').select('role').eq('user_id', userId).single();
    if (profile) userRole = profile.role;
    
    renderHeader();
    loadMarket();
}

function renderHeader() {
    const actions = document.getElementById('header-actions');
    if (userRole === 'hr') {
        actions.innerHTML = `<button onclick="showPage('page-post-vacancy')" class="bg-primary px-4 py-1.5 rounded-full text-xs font-bold shadow-lg">+ Вакансия</button>`;
    } else {
        actions.innerHTML = `<button onclick="showPage('page-profile')" class="text-primary font-bold italic">Мои Роли</button>`;
    }
}

// --- ФУНКЦИИ КОНСТРУКТОРА РОЛЕЙ ---
function addSkill() {
    console.log("ACTIO: Нажата кнопка добавить навык");
    const input = document.getElementById('skill-input');
    const val = input.value.trim();
    if (val && !currentSkills.includes(val)) {
        currentSkills.push(val);
        input.value = '';
        renderSkills();
    }
}

function removeSkill(index) {
    currentSkills.splice(index, 1);
    renderSkills();
}

function renderSkills() {
    const container = document.getElementById('skills-container');
    container.innerHTML = currentSkills.map((s, i) => `
        <div class="flex items-center h-8 px-3 rounded-lg bg-primary/10 border border-primary/20">
            <span class="text-sm mr-1 font-medium">${s}</span>
            <span onclick="removeSkill(${i})" class="material-symbols-outlined text-[16px] cursor-pointer">close</span>
        </div>
    `).join('');
}

async function saveRole() {
    console.log("ACTIO: Нажата кнопка Сохранить Роль");
    const btn = document.getElementById('save-role-btn');
    const name = document.getElementById('role-name').value.trim();
    const exp = document.getElementById('experience').value.trim();

    if (!name) return tg.showAlert("Введите название роли!");

    btn.disabled = true;
    btn.innerText = "Сохранение...";

    const userId = tg.initDataUnsafe?.user?.id || 1205293207;

    const { error } = await client.from('user_roles').insert([{
        user_id: userId,
        role_name: name,
        skills: currentSkills,
        experience: exp
    }]);

    if (!error) {
        tg.showAlert("Успешно сохранено!");
        showPage('page-market');
    } else {
        tg.showAlert("Ошибка: " + error.message);
    }
    btn.disabled = false;
    btn.innerText = "Сохранить Роль";
}

// --- ЛОГИКА МАРКЕТА ---
async function loadMarket() {
    const list = document.getElementById('vacancies-list');
    list.innerHTML = `<p class='text-center py-10 opacity-50 italic'>Загрузка...</p>`;
    const { data } = await client.from('vacancies').select('*').order('created_at', { ascending: false });
    if (data) {
        list.innerHTML = data.map(v => `
            <div onclick="openVacancy('${v.id}')" class="bg-surface-dark p-5 rounded-2xl border border-border-dark active:scale-[0.98] transition-all">
                <h3 class="text-lg font-bold italic">${v.title}</h3>
                <p class="text-[10px] text-gray-400 mt-2">${v.city || 'Удаленно'} • ${v.salary_min} ₽</p>
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
                <p class="text-primary font-bold mt-1 uppercase text-xs">${v.city}</p>
            </div>
            <div class="px-6 space-y-4">
                <p class="text-gray-300 leading-relaxed">${v.description || 'Описание отсутствует'}</p>
            </div>
        `;
        showPage('page-vacancy-details');
    }
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'page-profile') renderSkills();
}

function openRoleSheet() {
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('role-sheet').classList.add('active');
}

function closeRoleSheet() {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('role-sheet').classList.remove('active');
}

init();