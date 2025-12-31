const tg = window.Telegram.WebApp;
const SUPABASE_URL = "https://cgdeaibhadwsxqebohcj.supabase.co";
// Вставьте ваш ACTUAL ANON KEY из настроек Supabase (Settings -> API)
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGVhaWJoYWR3c3hxZWJvaGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzQ0OTYsImV4cCI6MjA4MjI1MDQ5Nn0._JQQBh9JVswhMoxmthN2U1l-Bvs65-bSSsNdv51sPvQ"; 
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userRole = 'candidate';
let selectedVacancy = null;
let currentSkills = [];
const userId = tg.initDataUnsafe?.user?.id || 1205293207; // 1205293207 для тестов в браузере

async function init() {
    tg.expand();
    tg.ready();
    
    // 1. Проверяем роль пользователя в таблице profiles
    const { data: profile } = await client.from('profiles').select('role').eq('user_id', userId).single();
    if (profile) userRole = profile.role;
    
    renderHeader();
    loadMarket();
}

// Рендерим кнопки в шапке в зависимости от роли
function renderHeader() {
    const actions = document.getElementById('header-actions');
    if (userRole === 'hr') {
        actions.innerHTML = `<button onclick="showPage('page-post-vacancy')" class="bg-primary text-black px-4 py-1.5 rounded-full text-xs font-black shadow-lg">СОЗДАТЬ ВАКАНСИЮ</button>`;
    } else {
        actions.innerHTML = `<button onclick="showPage('page-profile')" class="text-primary font-bold italic underline">МОИ РОЛИ</button>`;
    }
}

// --- ЛОГИКА МАРКЕТПЛЕЙСА ---
async function loadMarket() {
    const list = document.getElementById('vacancies-list');
    list.innerHTML = `<p class='text-center py-10 opacity-50 italic'>Загрузка вакансий...</p>`;
    
    // Подгружаем все поля из новой структуры
    const { data, error } = await client
        .from('vacancies')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        list.innerHTML = `<p class='text-center py-10 text-red-400'>Ошибка: ${error.message}</p>`;
        return;
    }

    if (data && data.length > 0) {
        list.innerHTML = data.map(v => {
            // Форматируем отображение зарплаты
            const salaryText = v.salary_min 
                ? `${v.salary_min.toLocaleString()}${v.salary_max ? ' — ' + v.salary_max.toLocaleString() : ''}`
                : 'З/П не указана';

            // Генерируем HTML для стека технологий (tech_stack — это массив в SQL)
            const stackHtml = (v.tech_stack || [])
                .map(s => `<span class="bg-white/5 px-2 py-0.5 rounded text-[9px] border border-white/10">${s}</span>`)
                .join('');

            return `
                <div onclick="openVacancyDetails('${v.id}')" class="bg-surface-dark p-5 rounded-2xl border border-border-dark active:scale-[0.98] transition-all mb-4">
                    <div class="flex justify-between items-start mb-2">
                        <span class="px-2 py-1 bg-primary/10 text-primary text-[10px] rounded-lg uppercase font-black">
                            ${v.level || 'Middle'}
                        </span>
                        <span class="text-[10px] opacity-40 uppercase tracking-tighter">${v.format || 'Full-time'}</span>
                    </div>

                    <h3 class="text-xl font-bold italic leading-tight mb-2">${v.title}</h3>

                    <div class="flex flex-wrap gap-1 mb-4">
                        ${stackHtml}
                    </div>

                    <div class="flex justify-between items-end border-t border-white/5 pt-3">
                        <div class="text-[10px] text-gray-400 uppercase tracking-widest flex flex-col">
                            <span class="opacity-50">Локация</span>
                            <span class="text-gray-200 mt-1">📍 ${v.city || 'Удаленно'}</span>
                        </div>
                        <div class="text-right flex flex-col">
                            <span class="text-[10px] text-primary uppercase font-bold tracking-widest opacity-50">Оплата</span>
                            <span class="text-primary font-black text-sm mt-1">${salaryText} ${v.currency || '₽'}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        list.innerHTML = `<p class='text-center py-10 opacity-30 italic'>Вакансий пока нет...</p>`;
    }
}

async function openVacancyDetails(id) {
    const { data: v } = await client.from('vacancies').select('*').eq('id', id).single();
    if (v) {
        selectedVacancy = v;
        document.getElementById('v-details-content').innerHTML = `
            <div class="p-8 text-center bg-surface-dark mb-4 border-b border-border-dark">
                <h2 class="text-2xl font-bold italic">${v.title}</h2>
                <p class="text-primary font-bold mt-1 uppercase text-xs tracking-tighter">${v.city} • ${v.salary_min} ₽</p>
            </div>
            <div class="px-6 space-y-4">
                <p class="text-gray-300 leading-relaxed">${v.description || 'Без описания'}</p>
            </div>
        `;
        showPage('page-vacancy-details');
    }
}

// --- ЛОГИКА ОТКЛИКА (ACTIO) ---
async function openRoleSheet() {
    const container = document.getElementById('roles-list-container');
    container.innerHTML = "<p class='text-center opacity-50'>Загрузка ваших ролей...</p>";
    
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('role-sheet').classList.add('active');

    // Если вы переименовали client в supabase в начале файла, используйте supabase.from
    const { data: roles } = await client.from('user_roles').select('*').eq('user_id', userId);

    if (roles && roles.length > 0) {
        container.innerHTML = roles.map(r => `
            <label class="block relative cursor-pointer">
                <input type="radio" name="selected-role" value="${r.role_name}" class="peer hidden">
                <div class="p-4 bg-surface-dark border border-border-dark rounded-xl peer-checked:border-primary peer-checked:bg-primary/10">
                    <div class="font-bold">${r.role_name}</div>
                    <div class="text-xs opacity-40">${r.skills?.join(', ') || 'Навыки не указаны'}</div>
                </div>
            </label>
        `).join('');
    } else {
        container.innerHTML = `<div class="text-center p-4">
            <p class="text-red-400 mb-2">У вас нет созданных ролей!</p>
            <button onclick="showPage('page-profile'); closeRoleSheet();" class="text-primary text-sm underline">Создать роль сейчас</button>
        </div>`;
    }
}

async function confirmApply() {
    const selectedRadio = document.querySelector('input[name="selected-role"]:checked');
    if (!selectedRadio) return tg.showAlert("Выберите роль!");

    const { error } = await client.from('applications').insert([{
        candidate_name: tg.initDataUnsafe?.user?.first_name || "Кандидат",
        role: selectedRadio.value,
        hr_id: selectedVacancy.hr_id,
        status: 'pending'
    }]);

    if (!error) {
        tg.showAlert("Отклик отправлен! HR получит уведомление.");
        closeRoleSheet();
        showPage('page-market');
    } else {
        tg.showAlert("Ошибка: " + error.message);
    }
}

// --- СОЗДАНИЕ ВАКАНСИИ (HR) ---
async function publishVacancy() {
    const title = document.getElementById('vac-title').value;
    const city = document.getElementById('vac-city').value;
    const level = document.getElementById('vac-level').value; // junior/middle/senior
    const format = document.getElementById('vac-format').value; // remote/office
    const salaryMin = document.getElementById('vac-salary-min').value;
    const salaryMax = document.getElementById('vac-salary-max').value;
    const techStack = document.getElementById('vac-stack').value; // "JS, Node, Postgres"
    const description = document.getElementById('vac-desc').value;

    if(!title) return alert("Введите название вакансии");

    const { error } = await supabase.from('vacancies').insert({
        hr_id: userId,
        title: title,
        city: city,
        level: level,
        format: format,
        salary_min: parseInt(salaryMin) || 0,
        salary_max: parseInt(salaryMax) || 0,
        currency: '₽',
        tech_stack: techStack.split(',').map(s => s.trim()).filter(s => s !== ""),
        description: description
    });

    if (!error) {
        alert("Вакансия опубликована!");
        showPage('page-hr');
        loadMyVacancies();
    } else {
        alert("Ошибка: " + error.message);
    }
}

// --- УПРАВЛЕНИЕ РОЛЯМИ И НАВЫКАМИ ---
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
        <div class="flex items-center bg-primary/10 border border-primary/20 px-3 py-1 rounded-lg">
            <span class="text-xs font-medium mr-2">${s}</span>
            <button onclick="removeSkill(${i})" class="material-symbols-outlined text-sm">close</button>
        </div>
    `).join('');
}

function removeSkill(i) {
    currentSkills.splice(i, 1);
    renderSkills();
}

async function saveRole() {
    const name = document.getElementById('role-name').value.trim();
    const exp = document.getElementById('experience').value.trim();
    if (!name) return tg.showAlert("Введите название роли!");

    const { error } = await client.from('user_roles').insert([{
        user_id: userId,
        role_name: name,
        skills: currentSkills,
        experience: exp
    }]);

    if (!error) {
        tg.showAlert("Роль сохранена!");
        showPage('page-market');
    }
}

// --- НАВИГАЦИЯ ---
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function closeRoleSheet() {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('role-sheet').classList.remove('active');
}

init();