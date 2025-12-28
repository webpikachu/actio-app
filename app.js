const tg = window.Telegram.WebApp;
const SUPABASE_URL = "https://cgdeaibhadwsxqebohcj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGVhaWJoYWR3c3hxZWJvaGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzQ0OTYsImV4cCI6MjA4MjI1MDQ5Nn0._JQQBh9JVswhMoxmthN2U1l-Bvs65-bSSsNdv51sPvQ"; 
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userRole = 'candidate';
let selectedVacancy = null;
let currentSkills = [];
let selectedRoleName = "";

async function init() {
    tg.expand();
    tg.ready();
    const userId = tg.initDataUnsafe?.user?.id || 1205293207; 
    
    // Получаем роль из базы profiles
    const { data: profile } = await client.from('profiles').select('role').eq('user_id', userId).single();
    if (profile) userRole = profile.role;
    
    renderHeader();
    loadMarket();
}

function renderHeader() {
    const actions = document.getElementById('header-actions');
    if (userRole === 'hr') {
        actions.innerHTML = `<button onclick="showPage('page-post-vacancy')" class="bg-primary px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">+ Вакансия</button>`;
    } else {
        actions.innerHTML = `<button onclick="showPage('page-profile')" class="text-primary font-bold">Профиль</button>`;
    }
}

// --- ЛОГИКА HR (ВАКАНСИИ) ---
async function publishVacancy() {
    const title = document.getElementById('v-title').value;
    const city = document.getElementById('v-city').value;
    const desc = document.getElementById('v-desc').value;
    const level = document.querySelector('input[name="level"]:checked').value;
    const sMin = parseInt(document.getElementById('v-salary-min').value) || 0;
    const sMax = parseInt(document.getElementById('v-salary-max').value) || 0;

    if (!title) return tg.showAlert("Введите название!");

    const { error } = await client.from('vacancies').insert([{
        hr_id: tg.initDataUnsafe?.user?.id,
        title, city, level, description: desc, salary_min: sMin, salary_max: sMax
    }]);

    if (!error) {
        tg.showAlert("Вакансия опубликована!");
        showPage('page-market');
        loadMarket();
    }
}

async function loadMarket() {
    const list = document.getElementById('vacancies-list');
    list.innerHTML = `<p class='text-center py-10 opacity-50 italic'>Синхронизация с рынком...</p>`;
    const { data } = await client.from('vacancies').select('*').order('created_at', { ascending: false });
    
    if (data) {
        list.innerHTML = data.map(v => `
            <div onclick="openVacancyDetails('${v.id}')" class="bg-surface-dark p-5 rounded-2xl border border-border-dark active:scale-[0.98] transition-all">
                <h3 class="text-lg font-bold">${v.title}</h3>
                <div class="flex gap-2 text-[10px] text-text-secondary mt-2 uppercase font-bold tracking-widest">
                    <span>${v.city || 'Удаленно'}</span> • <span>${v.salary_min} - ${v.salary_max} ₽</span>
                </div>
            </div>
        `).join('');
    }
}

async function openVacancyDetails(id) {
    const { data: v } = await client.from('vacancies').select('*').eq('id', id).single();
    if (v) {
        selectedVacancy = v;
        const content = document.getElementById('v-details-content');
        content.innerHTML = `
            <div class="px-4 pt-8 pb-4 text-center space-y-4">
                <div class="size-20 bg-primary/10 rounded-2xl mx-auto flex items-center justify-center border border-primary/20">
                    <span class="material-symbols-outlined text-primary text-4xl font-light tracking-tighter italic">Actio</span>
                </div>
                <div>
                    <h2 class="text-2xl font-bold">${v.title}</h2>
                    <p class="text-primary font-medium mt-1">TechFlow • ${v.city}</p>
                </div>
            </div>
            <div class="px-4 py-4 flex flex-wrap justify-center gap-2">
                <div class="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-bold text-primary">${v.salary_min}-${v.salary_max} ₽</div>
                <div class="px-3 py-1.5 rounded-lg bg-border-dark/30 text-xs font-bold text-gray-400 uppercase">${v.level}</div>
            </div>
            <div class="px-4 py-6 space-y-3">
                <h3 class="text-lg font-bold">О вакансии</h3>
                <p class="text-gray-400 leading-relaxed">${v.description || 'Описание отсутствует'}</p>
            </div>
        `;
        showPage('page-vacancy-details');
    }
}

// --- ЛОГИКА СОИСКАТЕЛЯ (РОЛИ) ---
function addSkill() {
    const input = document.getElementById('skill-input');
    const val = input.value.trim();
    if (val && !currentSkills.includes(val)) {
        currentSkills.push(val);
        input.value = '';
        renderSkills();
    }
}

function renderSkills() {
    const container = document.getElementById('skills-container');
    container.innerHTML = currentSkills.map((s, i) => `
        <div class="flex items-center h-8 px-3 rounded-lg bg-primary/10 border border-primary/20">
            <span class="text-sm font-medium mr-1">${s}</span>
            <span onclick="removeSkill(${i})" class="material-symbols-outlined text-xs cursor-pointer">close</span>
        </div>
    `).join('');
}

function removeSkill(i) { currentSkills.splice(i, 1); renderSkills(); }

async function saveRole() {
    const name = document.getElementById('role-name').value;
    const exp = document.getElementById('experience').value;
    if (!name) return tg.showAlert("Введите название!");

    const { error } = await client.from('user_roles').insert([{
        user_id: tg.initDataUnsafe?.user?.id,
        role_name: name, skills: currentSkills, experience: exp
    }]);

    if (!error) {
        tg.showAlert("Роль сохранена!");
        showPage('page-market');
    }
}

// --- ОТКЛИК (ШТОРКА) ---
async function openRoleSheet() {
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('role-sheet').classList.add('active');
    const { data } = await client.from('user_roles').select('*').eq('user_id', tg.initDataUnsafe?.user?.id);
    const container = document.getElementById('roles-list-container');
    if (data && data.length > 0) {
        container.innerHTML = data.map(r => `
            <label class="flex items-center justify-between p-4 rounded-xl border border-border-dark bg-surface-dark cursor-pointer">
                <span class="font-bold">${r.role_name}</span>
                <input type="radio" name="r_sel" value="${r.role_name}" onchange="selectedRoleName='${r.role_name}'" class="w-6 h-6 text-primary">
            </label>
        `).join('');
    } else {
        container.innerHTML = `<p class="text-center py-4 text-gray-500">У вас нет созданных ролей.</p>`;
    }
}

function closeRoleSheet() {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('role-sheet').classList.remove('active');
}

async function confirmApply() {
    if (!selectedRoleName) return tg.showAlert("Выберите роль!");
    const { error } = await client.from('applications').insert([{
        hr_id: selectedVacancy.hr_id,
        role: `${selectedVacancy.title} (как ${selectedRoleName})`,
        status: 'pending'
    }]);
    if (!error) {
        tg.sendData(JSON.stringify({ action: 'new_apply', hr_id: selectedVacancy.hr_id, role: selectedVacancy.title }));
        tg.close();
    }
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

init();