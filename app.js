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
    
    const { data: profile } = await client.from('profiles').select('role').eq('user_id', userId).single();
    if (profile) {
        userRole = profile.role;
        console.log("ACTIO: Роль определена как", userRole);
    }
    
    renderHeader();
    loadMarket();
}

function renderHeader() {
    const actions = document.getElementById('header-actions');
    if (userRole === 'hr') {
        actions.innerHTML = `<button onclick="showPage('page-post-vacancy')" class="bg-primary px-4 py-1.5 rounded-full text-xs font-bold shadow-lg">+ Вакансия</button>`;
    } else {
        actions.innerHTML = `<button onclick="showPage('page-profile')" class="text-primary font-bold">Профиль</button>`;
    }
}

async function publishVacancy() {
    const title = document.getElementById('v-title').value;
    const city = document.getElementById('v-city').value;
    const desc = document.getElementById('v-desc').value;
    const level = document.querySelector('input[name="level"]:checked').value;
    const sMin = parseInt(document.getElementById('v-salary-min').value) || 0;

    if (!title) return tg.showAlert("Напишите название вакансии!");

    const { error } = await client.from('vacancies').insert([{
        hr_id: tg.initDataUnsafe?.user?.id,
        title, city, level, description: desc, salary_min: sMin
    }]);

    if (!error) { tg.showAlert("Вакансия на рынке!"); showPage('page-market'); loadMarket(); }
}

async function loadMarket() {
    const list = document.getElementById('vacancies-list');
    list.innerHTML = `<p class='text-center py-10 opacity-50 italic'>Синхронизация...</p>`;
    const { data } = await client.from('vacancies').select('*').order('created_at', { ascending: false });
    if (data) {
        list.innerHTML = data.map(v => `
            <div onclick="openVacancy('${v.id}')" class="bg-surface-dark p-5 rounded-2xl border border-border-dark">
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
            <div class="p-8 text-center bg-surface-dark mb-4">
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

// Конструктор ролей
function addSkill() {
    const val = document.getElementById('skill-input').value.trim();
    if (val && !currentSkills.includes(val)) {
        currentSkills.push(val);
        document.getElementById('skill-input').value = '';
        renderSkills();
    }
}
function renderSkills() {
    const container = document.getElementById('skills-container');
    container.innerHTML = currentSkills.map((s, i) => `
        <div class="flex items-center h-8 px-3 rounded-lg bg-primary/10 border border-primary/20">
            <span class="text-sm mr-1 font-medium">${s}</span>
            <span onclick="removeSkill(${i})" class="material-symbols-outlined text-xs cursor-pointer">close</span>
        </div>
    `).join('');
}
function removeSkill(i) { currentSkills.splice(i, 1); renderSkills(); }

async function saveRole() {
    const name = document.getElementById('role-name').value;
    const exp = document.getElementById('experience').value;
    if (!name) return tg.showAlert("Введите название!");
    const { error } = await client.from('user_roles').insert([{ user_id: tg.initDataUnsafe?.user?.id, role_name: name, skills: currentSkills, experience: exp }]);
    if (!error) { tg.showAlert("Роль сохранена!"); showPage('page-market'); }
}

// Отклик
async function openRoleSheet() {
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('role-sheet').classList.add('active');
    const { data } = await client.from('user_roles').select('*').eq('user_id', tg.initDataUnsafe?.user?.id);
    const list = document.getElementById('roles-list-container');
    if (data && data.length > 0) {
        list.innerHTML = data.map(r => `
            <label class="flex items-center justify-between p-4 rounded-xl border border-border-dark bg-surface-dark">
                <span class="font-bold">${r.role_name}</span>
                <input type="radio" name="r_sel" value="${r.role_name}" onchange="selectedRoleName='${r.role_name}'" class="w-6 h-6 text-primary">
            </label>
        `).join('');
    } else {
        list.innerHTML = `<p class="text-center text-gray-500">Сначала создайте роль в профиле.</p>`;
    }
}

async function confirmApply() {
    if (!selectedRoleName) return tg.showAlert("Выберите роль!");
    const { error } = await client.from('applications').insert([{ hr_id: selectedVacancy.hr_id, role: `${selectedVacancy.title} (как ${selectedRoleName})`, status: 'pending' }]);
    if (!error) {
        tg.sendData(JSON.stringify({ action: 'new_apply', hr_id: selectedVacancy.hr_id, role: selectedVacancy.title }));
        tg.close();
    }
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}
function closeRoleSheet() { document.getElementById('overlay').classList.add('hidden'); document.getElementById('role-sheet').classList.remove('active'); }

init();