const tg = window.Telegram.WebApp;
const SUPABASE_URL = "https://cgdeaibhadwsxqebohcj.supabase.co";
// ANON KEY (публичный ключ)
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGVhaWJoYWR3c3hxZWJvaGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzQ0OTYsImV4cCI6MjA4MjI1MDQ5Nn0._JQQBh9JVswhMoxmthN2U1l-Bvs65-bSSsNdv51sPvQ"; 

// Инициализация клиента (исправлено с supabase на client)
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userRole = 'candidate';
let selectedVacancy = null;
let currentSkills = [];
const userId = tg.initDataUnsafe?.user?.id || 1205293207;

async function init() {
    tg.expand();
    tg.ready();
    
    // 1. Проверяем роль пользователя в таблице profiles
    const { data: profile } = await client.from('profiles').select('role').eq('user_id', userId).single();
    
    if (profile) {
        userRole = profile.role;
        // Если пользователь HR, показываем кнопку в нижней навигации
        if (userRole === 'hr') {
            document.getElementById('nav-hr-btn').classList.remove('hidden');
        }
    }
    
    loadMarket();
    loadMyApplications(); // Подгружаем отклики для профиля
}

// --- НАВИГАЦИЯ ---
function showPage(id) {
    // Скрываем все страницы
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Показываем нужную
    const target = document.getElementById(id);
    if(target) target.classList.add('active');

    // Стилизуем кнопки навигации (эффект активности)
    document.querySelectorAll('.nav-btn').forEach(btn => btn.style.opacity = "0.4");
    // Находим кнопку, которая ведет на эту страницу и делаем её яркой
    // (упрощенная логика для примера)

    // Вибрация при переключении
    tg.HapticFeedback.impactOccurred('light');

    // Авто-загрузка данных при переходе
    if (id === 'page-market') loadMarket();
    if (id === 'page-profile') {
        loadMyApplications();
        loadUserRoles();
    }
    if (id === 'page-hr') loadMyVacancies();
}

// --- ЛОГИКА МАРКЕТПЛЕЙСА ---
async function loadMarket() {
    const list = document.getElementById('vacancies-list');
    list.innerHTML = `<p class='text-center py-10 opacity-50 italic'>Сигналы загружаются...</p>`;
    
    const { data, error } = await client
        .from('vacancies')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        list.innerHTML = `<p class='text-center py-10 text-red-400'>Ошибка связи</p>`;
        return;
    }

    list.innerHTML = data.map(v => `
        <div onclick="openVacancyDetails('${v.id}')" class="bg-surface-dark p-5 rounded-2xl border border-border-dark active:scale-[0.98] transition-all mb-4">
            <div class="flex justify-between items-start mb-2">
                <span class="px-2 py-1 bg-primary/10 text-primary text-[10px] rounded-lg uppercase font-black">${v.level || 'Middle'}</span>
                <span class="text-[10px] opacity-40 uppercase tracking-tighter">📍 ${v.city || 'Remote'}</span>
            </div>
            <h3 class="text-xl font-bold italic leading-tight mb-2">${v.title}</h3>
            <div class="flex flex-wrap gap-1 mb-4">
                ${(v.tech_stack || []).map(s => `<span class="bg-white/5 px-2 py-0.5 rounded text-[9px] border border-white/10">${s}</span>`).join('')}
            </div>
            <div class="text-primary font-black text-sm">${v.salary_min?.toLocaleString() || '---'} ₽</div>
        </div>
    `).join('');
}

async function openVacancyDetails(id) {
    const { data: v } = await client.from('vacancies').select('*').eq('id', id).single();
    if (v) {
        selectedVacancy = v;
        const salaryText = v.salary_min ? `${v.salary_min.toLocaleString()} - ${v.salary_max?.toLocaleString()} ₽` : 'З/П по результатам';
        
        document.getElementById('v-details-content').innerHTML = `
            <div class="p-6 bg-surface-dark rounded-3xl border border-border-dark shadow-2xl">
                <span class="text-primary text-[10px] font-black uppercase tracking-widest">${v.level} • ${v.city}</span>
                <h2 class="text-3xl font-black italic mt-2 leading-tight">${v.title}</h2>
                <div class="text-xl font-bold text-white mt-2 mb-6">${salaryText}</div>
                
                <div class="space-y-6">
                    <div>
                        <h4 class="text-[10px] uppercase text-gray-500 font-black mb-3 tracking-widest">Стек технологий</h4>
                        <div class="flex flex-wrap gap-2">
                            ${(v.tech_stack || []).map(s => `<span class="px-3 py-1 bg-white/5 rounded-lg text-xs border border-white/10">${s}</span>`).join('')}
                        </div>
                    </div>
                    <div>
                        <h4 class="text-[10px] uppercase text-gray-500 font-black mb-2 tracking-widest">Описание сигнала</h4>
                        <p class="text-gray-300 leading-relaxed text-sm">${v.description || 'Детали не указаны'}</p>
                    </div>
                </div>
            </div>
        `;
        showPage('page-vacancy-details');
    }
}

// --- ЛОГИКА ОТКЛИКА ---
async function openRoleSheet() {
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('role-sheet').classList.add('active');

    const container = document.getElementById('roles-list-container');
    container.innerHTML = "<p class='text-center opacity-50 py-4'>Загрузка ролей...</p>";

    const { data: roles } = await client.from('user_roles').select('*').eq('user_id', userId);

    if (roles && roles.length > 0) {
        container.innerHTML = roles.map(r => `
            <label class="flex items-center justify-between p-4 bg-background-dark border border-border-dark rounded-2xl cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all">
                <div>
                    <div class="font-bold text-sm">${r.role_name}</div>
                    <div class="text-[10px] opacity-40 mt-1">${r.skills?.join(', ') || ''}</div>
                </div>
                <input type="radio" name="selected-role" value="${r.role_name}" class="hidden peer">
                <div class="w-5 h-5 rounded-full border-2 border-border-dark peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center">
                    <span class="material-symbols-outlined text-white text-xs scale-0 peer-checked:scale-100 transition-transform">check</span>
                </div>
            </label>
        `).join('');
        // Добавляем обработчик на кнопку подтверждения в шторке
        document.getElementById('confirm-apply-btn').onclick = () => confirmApply();
    } else {
        container.innerHTML = `<div class="text-center p-4"><p class="text-red-400 text-sm mb-2">У вас нет ролей!</p></div>`;
    }
}

async function confirmApply() {
    const selectedRadio = document.querySelector('input[name="selected-role"]:checked');
    if (!selectedRadio) return tg.showAlert("Сначала выберите роль!");

    const { error } = await client.from('applications').insert([{
        candidate_name: tg.initDataUnsafe?.user?.first_name || "Кандидат",
        role: selectedRadio.value,
        hr_id: selectedVacancy.hr_id,
        status: 'pending'
    }]);

    if (!error) {
        tg.HapticFeedback.notificationOccurred('success');
        tg.showAlert("Сигнал отправлен!");
        closeRoleSheet();
        showPage('page-market');
    }
}

// --- ЛОГИКА ПРОФИЛЯ ---
async function loadUserRoles() {
    const container = document.getElementById('user-roles-list');
    const { data } = await client.from('user_roles').select('*').eq('user_id', userId);
    
    if (data && data.length > 0) {
        container.innerHTML = data.map(r => `
            <div class="p-4 bg-surface-dark border border-border-dark rounded-xl">
                <div class="font-bold text-sm">${r.role_name}</div>
                <div class="text-[10px] opacity-40 mt-1">${r.skills?.join(', ') || 'Навыки не указаны'}</div>
            </div>
        `).join('');
    } else {
        container.innerHTML = `<p class="text-xs opacity-30 text-center py-4">У вас пока нет ролей</p>`;
    }
}

async function loadMyApplications() {
    const container = document.getElementById('my-applications-list');
    const { data } = await client.from('applications').select('*').eq('candidate_name', tg.initDataUnsafe?.user?.first_name || "Кандидат");
    
    if (data && data.length > 0) {
        container.innerHTML = data.map(a => {
            const statusMap = { 'pending': 'В ОЖИДАНИИ', 'accepted': 'ПРИНЯТ', 'rejected': 'ОТКЛОНЕН' };
            const colorMap = { 'pending': 'text-yellow-500', 'accepted': 'text-green-500', 'rejected': 'text-red-500' };
            return `
                <div class="p-4 bg-surface-dark border border-border-dark rounded-xl flex justify-between items-center">
                    <div class="text-sm font-bold">${a.role}</div>
                    <div class="text-[9px] font-black ${colorMap[a.status]} uppercase">${statusMap[a.status]}</div>
                </div>
            `;
        }).join('');
    }
}

// --- HR ПАНЕЛЬ ---
async function publishVacancy() {
    const title = document.getElementById('v-title').value;
    const city = document.getElementById('v-city').value;
    const level = document.getElementById('v-level').value;
    const sMin = document.getElementById('v-salary-min').value;
    const sMax = document.getElementById('v-salary-max').value;
    const stack = document.getElementById('v-stack').value;
    const desc = document.getElementById('v-desc').value;

    if(!title) return tg.showAlert("Введите название!");

    const { error } = await client.from('vacancies').insert({
        hr_id: userId,
        title: title,
        city: city || 'Удаленно',
        level: level,
        salary_min: parseInt(sMin) || 0,
        salary_max: parseInt(sMax) || 0,
        tech_stack: stack.split(',').map(s => s.trim()).filter(s => s !== ""),
        description: desc
    });

    if (!error) {
        tg.showAlert("Сигнал опубликован!");
        showPage('page-market');
    }
}

async function saveRole() {
    const name = document.getElementById('role-name').value.trim();
    const skillsInput = document.getElementById('skill-input').value;
    const exp = document.getElementById('experience').value.trim();
    
    if (!name) return tg.showAlert("Введите название роли!");

    const { error } = await client.from('user_roles').insert([{
        user_id: userId,
        role_name: name,
        skills: skillsInput.split(',').map(s => s.trim()).filter(s => s !== ""),
        experience: exp
    }]);

    if (!error) {
        tg.showAlert("Роль сохранена!");
        showPage('page-profile');
    }
}

async function loadMyVacancies() {
    const container = document.getElementById('hr-vacancies-list');
    const { data } = await client.from('vacancies').select('*').eq('hr_id', userId);
    if(data) {
        container.innerHTML = data.map(v => `
            <div class="p-4 bg-white/5 border border-white/10 rounded-xl flex justify-between items-center">
                <div class="text-sm font-bold">${v.title}</div>
                <div class="text-[10px] opacity-40 uppercase">${v.city}</div>
            </div>
        `).join('');
    }
}

function closeRoleSheet() {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('role-sheet').classList.remove('active');
}

// Запуск
init();