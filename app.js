const tg = window.Telegram.WebApp;
const SUPABASE_URL = "https://cgdeaibhadwsxqebohcj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGVhaWJoYWR3c3hxZWJvaGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzQ0OTYsImV4cCI6MjA4MjI1MDQ5Nn0._JQQBh9JVswhMoxmthN2U1l-Bvs65-bSSsNdv51sPvQ"; 
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userRole = 'candidate';
let selectedVacancy = null;
let selectedRoleName = "";

async function init() {
    try {
        tg.expand();
        tg.ready();
        const userId = tg.initDataUnsafe?.user?.id || 1205293207; 
        
        const { data: profile } = await client.from('profiles').select('role').eq('user_id', userId).single();
        if (profile) userRole = profile.role;
        
        renderHeader();
        loadMarket();
    } catch (e) { console.error(e); renderHeader(); loadMarket(); }
}

function renderHeader() {
    const actions = document.getElementById('header-actions');
    if (userRole === 'hr') {
        actions.innerHTML = `<button onclick="showPage('page-post-vacancy')" class="bg-primary px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">+ Вакансия</button>`;
    } else {
        actions.innerHTML = `<button onclick="showPage('page-profile')" class="text-primary font-bold">Профиль</button>`;
    }
}

async function publishVacancy() {
    const btn = document.getElementById('publish-btn');
    const title = document.getElementById('v-title').value;
    const city = document.getElementById('v-city').value;
    const desc = document.getElementById('v-desc').value;
    const level = document.querySelector('input[name="level"]:checked').value;
    const sMin = parseInt(document.getElementById('v-salary-min').value) || 0;
    const sMax = parseInt(document.getElementById('v-salary-max').value) || 0;

    if (!title) return tg.showAlert("Введите название!");
    btn.disabled = true;

    const { error } = await client.from('vacancies').insert([{
        hr_id: tg.initDataUnsafe?.user?.id,
        title, city, level, description: desc, salary_min: sMin, salary_max: sMax
    }]);

    if (!error) { tg.showAlert("Опубликовано!"); showPage('page-market'); loadMarket(); }
    btn.disabled = false;
}

async function loadMarket() {
    const list = document.getElementById('vacancies-list');
    list.innerHTML = `<p class='text-center py-10 opacity-50 italic'>Загрузка рынка...</p>`;
    const { data } = await client.from('vacancies').select('*').order('created_at', { ascending: false });
    if (data) {
        list.innerHTML = data.map(v => `
            <div onclick="viewVacancy('${v.id}')" class="bg-[#1c1c1e] p-5 rounded-2xl border border-[#3a3a3c] active:scale-[0.98] transition-all">
                <h3 class="text-lg font-bold">${v.title}</h3>
                <p class="text-xs text-gray-500 mt-1 uppercase">${v.city || 'Удаленно'} • ${v.salary_min}₽</p>
            </div>
        `).join('');
    }
}

async function viewVacancy(id) {
    const { data } = await client.from('vacancies').select('*').eq('id', id).single();
    if (data) {
        selectedVacancy = data;
        document.getElementById('v-details-content').innerHTML = `
            <div class="p-8 text-center bg-[#1c1c1e] mb-4 border-b border-[#3a3a3c]">
                <h2 class="text-2xl font-bold mb-2">${data.title}</h2>
                <div class="text-primary font-bold">${data.city} • ${data.level}</div>
            </div>
            <div class="p-6">
                <h3 class="font-bold mb-2 text-gray-500 uppercase text-xs tracking-widest">Описание</h3>
                <p class="text-gray-300 leading-relaxed">${data.description || 'Нет описания'}</p>
            </div>
        `;
        showPage('page-vacancy-details');
    }
}

function openRoleSheet() {
    document.getElementById('overlay').classList.add('active');
    document.getElementById('role-sheet').classList.add('active');
    loadRoles();
}

async function loadRoles() {
    const { data } = await client.from('user_roles').select('*').eq('user_id', tg.initDataUnsafe?.user?.id);
    const list = document.getElementById('roles-list-container');
    if (data && data.length > 0) {
        list.innerHTML = data.map(r => `
            <label class="flex items-center justify-between p-4 rounded-xl border border-[#3a3a3c] bg-[#2c2c2e]">
                <span class="font-bold">${r.role_name}</span>
                <input type="radio" name="r_sel" value="${r.role_name}" onchange="selectedRoleName='${r.role_name}'" class="w-6 h-6 text-primary">
            </label>
        `).join('');
    }
}

async function confirmApply() {
    if (!selectedRoleName) return tg.showAlert("Выберите роль!");
    const { error } = await client.from('applications').insert([{
        hr_id: selectedVacancy.hr_id,
        role: `${selectedVacancy.title} (как ${selectedRoleName})`,
        status: 'pending', candidate_name: tg.initDataUnsafe?.user?.first_name || "Lailo"
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

function closeRoleSheet() {
    document.getElementById('overlay').classList.remove('active');
    document.getElementById('role-sheet').classList.remove('active');
}

init();