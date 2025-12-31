const tg = window.Telegram.WebApp;
const SUPABASE_URL = "https://cgdeaibhadwsxqebohcj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGVhaWJoYWR3c3hxZWJvaGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzQ0OTYsImV4cCI6MjA4MjI1MDQ5Nn0._JQQBh9JVswhMoxmthN2U1l-Bvs65-bSSsNdv51sPvQ"; 

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userRole = 'candidate';
let selectedVacancy = null;
let currentSkills = []; // Массив для навыков в создании роли
const userId = tg.initDataUnsafe?.user?.id || 1205293207;

async function init() {
    tg.expand();
    tg.ready();
    
    const { data: profile } = await client.from('profiles').select('role').eq('user_id', userId).single();
    if (profile) {
        userRole = profile.role;
        if (userRole === 'hr') document.getElementById('nav-hr-btn').classList.remove('hidden');
    }
    
    loadMarket();
}

// --- УЛУЧШЕННАЯ НАВИГАЦИЯ ---
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');

    // Активность кнопок навигации
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.add('opacity-40');
        btn.classList.remove('text-primary');
    });
    
    // Подсветка кнопки (упрощенно)
    if (id === 'page-market') loadMarket();
    if (id === 'page-profile') { loadUserRoles(); loadMyApplications(); }
    if (id === 'page-hr') loadMyVacancies();

    tg.HapticFeedback.impactOccurred('light');
}

// --- МАРКЕТ ---
async function loadMarket() {
    const list = document.getElementById('vacancies-list');
    list.innerHTML = `<p class='text-center py-20 opacity-30 italic animate-pulse uppercase text-xs font-black tracking-widest'>Поиск сигналов...</p>`;
    
    const { data, error } = await client.from('vacancies').select('*').order('created_at', { ascending: false });
    
    if (data) {
        list.innerHTML = data.map(v => `
            <div onclick="openVacancyDetails('${v.id}')" class="bg-surface-dark p-6 rounded-[24px] border border-border-dark active:scale-[0.97] transition-all shadow-xl">
                <div class="flex justify-between items-start mb-3">
                    <span class="px-2 py-1 bg-primary/10 text-primary text-[9px] rounded-lg uppercase font-black tracking-tighter border border-primary/20">${v.level || 'Middle'}</span>
                    <span class="text-[9px] opacity-40 uppercase font-bold tracking-widest">📍 ${v.city || 'Remote'}</span>
                </div>
                <h3 class="text-xl font-black italic leading-tight text-white mb-3 uppercase tracking-tighter">${v.title}</h3>
                <div class="flex flex-wrap gap-1 mb-5">
                    ${(v.tech_stack || []).slice(0, 3).map(s => `<span class="bg-white/5 px-2 py-0.5 rounded text-[8px] border border-white/5 opacity-60 font-bold">${s}</span>`).join('')}
                    ${v.tech_stack?.length > 3 ? `<span class="text-[8px] opacity-30 font-bold ml-1">+${v.tech_stack.length - 3}</span>` : ''}
                </div>
                <div class="flex justify-between items-center border-t border-white/5 pt-4">
                    <span class="text-primary font-black text-sm">${v.salary_min?.toLocaleString()} ₽</span>
                    <span class="material-symbols-outlined text-primary opacity-50">arrow_forward_ios</span>
                </div>
            </div>
        `).join('');
    }
}

// --- ДЕТАЛИ ---
async function openVacancyDetails(id) {
    const { data: v } = await client.from('vacancies').select('*').eq('id', id).single();
    if (v) {
        selectedVacancy = v;
        document.getElementById('v-details-content').innerHTML = `
            <div class="bg-surface-dark rounded-[32px] p-8 border border-border-dark shadow-2xl">
                <div class="text-center">
                    <span class="text-primary text-[10px] font-black uppercase tracking-[0.3em] opacity-60">${v.level} • ${v.city}</span>
                    <h2 class="text-3xl font-black italic mt-3 leading-tight uppercase tracking-tighter">${v.title}</h2>
                    <div class="inline-block mt-4 px-6 py-2 bg-primary text-white rounded-full font-black text-lg shadow-lg shadow-blue-500/20">${v.salary_min?.toLocaleString()} ₽</div>
                </div>
                
                <div class="mt-10 space-y-8">
                    <div>
                        <h4 class="text-[10px] uppercase text-gray-500 font-black mb-4 tracking-[0.2em]">Технологический стек</h4>
                        <div class="flex flex-wrap gap-2">
                            ${(v.tech_stack || []).map(s => `<span class="px-4 py-1.5 bg-white/5 rounded-xl text-xs border border-white/10 font-bold text-gray-300">${s}</span>`).join('')}
                        </div>
                    </div>
                    <div>
                        <h4 class="text-[10px] uppercase text-gray-500 font-black mb-3 tracking-[0.2em]">Описание вакансии</h4>
                        <p class="text-gray-400 leading-relaxed text-sm italic font-medium">${v.description || 'Детали сигнала отсутствуют.'}</p>
                    </div>
                </div>
            </div>
        `;
        showPage('page-vacancy-details');
    }
}

// --- ЛОГИКА ТЕГОВ (НАВЫКОВ) ---
function addSkill() {
    const input = document.getElementById('skill-input');
    const skill = input.value.trim();
    if (skill && !currentSkills.includes(skill)) {
        currentSkills.push(skill);
        renderSkills();
        input.value = '';
    }
}

let vacancyTechStack = []; // Массив для хранения тегов вакансии

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
    container.innerHTML = vacancyTechStack.map((t, i) => `
        <div class="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl">
            <span class="text-xs font-black text-gray-300 uppercase">${t}</span>
            <button onclick="removeTechTag(${i})" class="material-symbols-outlined text-sm text-white/30 hover:text-white">close</button>
        </div>
    `).join('');
}

function removeTechTag(index) {
    vacancyTechStack.splice(index, 1);
    renderTechTags();
}

function renderSkills() {
    const container = document.getElementById('skills-container');
    container.innerHTML = currentSkills.map((s, i) => `
        <div class="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-xl">
            <span class="text-xs font-black text-primary uppercase">${s}</span>
            <button onclick="removeSkill(${i})" class="material-symbols-outlined text-sm text-primary/50 hover:text-primary">close</button>
        </div>
    `).join('');
}

function removeSkill(index) {
    currentSkills.splice(index, 1);
    renderSkills();
}

// --- СОХРАНЕНИЕ РОЛИ ---
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
        tg.HapticFeedback.notificationOccurred('success');
        tg.showAlert("Профиль успешно сохранен!");
        currentSkills = [];
        showPage('page-profile');
    }
}

// --- ОТКЛИК (BOTTOM SHEET) ---
async function openRoleSheet() {
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('role-sheet').classList.add('active');
    const container = document.getElementById('roles-list-container');
    container.innerHTML = "<p class='text-center py-6 opacity-40 text-xs font-bold uppercase tracking-widest animate-pulse'>Загрузка ваших ролей...</p>";

    const { data: roles } = await client.from('user_roles').select('*').eq('user_id', userId);

    if (roles?.length > 0) {
        container.innerHTML = roles.map(r => `
            <label class="flex items-center justify-between p-5 bg-background-dark border border-border-dark rounded-2xl cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all">
                <div class="flex flex-col">
                    <span class="font-black italic text-sm uppercase tracking-tighter">${r.role_name}</span>
                    <span class="text-[9px] text-gray-500 font-bold uppercase mt-1 tracking-widest">${r.skills?.slice(0, 3).join(', ') || '---'}</span>
                </div>
                <input type="radio" name="selected-role" value="${r.role_name}" class="hidden peer">
                <div class="w-6 h-6 rounded-full border-2 border-border-dark peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center transition-all">
                    <span class="material-symbols-outlined text-white text-xs scale-0 peer-checked:scale-100 font-black">check</span>
                </div>
            </label>
        `).join('');
        document.getElementById('confirm-apply-btn').onclick = () => confirmApply();
    } else {
        container.innerHTML = `<div class="text-center p-6 border border-dashed border-border-dark rounded-2xl">
            <p class="text-red-400 text-[10px] font-black uppercase mb-3">У вас нет созданных ролей!</p>
            <button onclick="closeRoleSheet(); showPage('page-role-create');" class="text-primary text-xs font-black underline">СОЗДАТЬ СЕЙЧАС</button>
        </div>`;
    }
}

async function confirmApply() {
    const selectedRadio = document.querySelector('input[name="selected-role"]:checked');
    if (!selectedRadio) return tg.showAlert("Выберите роль для отклика!");

    const { error } = await client.from('applications').insert([{
        candidate_name: tg.initDataUnsafe?.user?.first_name || "Кандидат",
        role: selectedRadio.value,
        hr_id: selectedVacancy.hr_id,
        status: 'pending'
    }]);

    if (!error) {
        tg.HapticFeedback.notificationOccurred('success');
        tg.showAlert("Сигнал успешно отправлен!");
        closeRoleSheet();
        showPage('page-market');
    }
}

// --- ВСПОМОГАТЕЛЬНЫЕ ---
async function loadUserRoles() {
    const container = document.getElementById('user-roles-list');
    const { data } = await client.from('user_roles').select('*').eq('user_id', userId);
    if (data) {
        container.innerHTML = data.map(r => `
            <div class="p-5 bg-surface-dark border border-border-dark rounded-2xl shadow-lg">
                <div class="font-black italic uppercase tracking-tighter text-sm mb-1">${r.role_name}</div>
                <div class="text-[9px] opacity-40 font-bold uppercase tracking-widest">${(r.skills || []).join(', ')}</div>
            </div>
        `).join('');
    }
}

async function loadMyApplications() {
    const container = document.getElementById('my-applications-list');
    const { data } = await client.from('applications').select('*').eq('candidate_name', tg.initDataUnsafe?.user?.first_name || "Кандидат");
    if (data) {
        container.innerHTML = data.map(a => {
            const statusMap = { 'pending': 'Ожидание', 'accepted': 'Принят', 'rejected': 'Отклонен' };
            const statusStyle = { 'pending': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', 'accepted': 'bg-green-500/10 text-green-500 border-green-500/20', 'rejected': 'bg-red-500/10 text-red-500 border-red-500/20' };
            return `
                <div class="p-4 bg-surface-dark border border-border-dark rounded-2xl flex justify-between items-center shadow-md">
                    <div class="text-xs font-black uppercase tracking-tighter">${a.role}</div>
                    <div class="px-3 py-1 rounded-lg border text-[8px] font-black uppercase ${statusStyle[a.status]}">${statusMap[a.status]}</div>
                </div>
            `;
        }).join('');
    }
}

async function loadMyVacancies() {
    const container = document.getElementById('hr-vacancies-list');
    const { data } = await client.from('vacancies').select('*').eq('hr_id', userId);
    if (data) {
        container.innerHTML = data.map(v => `
            <div class="p-4 bg-white/5 border border-white/10 rounded-2xl flex justify-between items-center">
                <div class="text-[10px] font-black uppercase tracking-widest">${v.title}</div>
                <span class="material-symbols-outlined text-primary opacity-30">bar_chart</span>
            </div>
        `).join('');
    }
}

async function publishVacancy() {
    const title = document.getElementById('v-title').value;
    const city = document.getElementById('v-city').value;
    const level = document.getElementById('v-level').value;
    const sMin = document.getElementById('v-salary-min').value;
    const sMax = document.getElementById('v-salary-max').value;
    const desc = document.getElementById('v-desc').value;

    if(!title) return tg.showAlert("Введите название позиции!");
    if(vacancyTechStack.length === 0) return tg.showAlert("Добавьте хотя бы один навык в стек!");

    const { error } = await client.from('vacancies').insert({
        hr_id: userId,
        title: title,
        city: city || 'Remote',
        level: level,
        salary_min: parseInt(sMin) || 0,
        salary_max: parseInt(sMax) || 0,
        tech_stack: vacancyTechStack, // Используем массив тегов
        description: desc,
        currency: '₽'
    });

    if (!error) {
        tg.HapticFeedback.notificationOccurred('success');
        tg.showAlert("Сигнал успешно опубликован в ACTIO!");
        
        // Очищаем форму
        vacancyTechStack = [];
        document.getElementById('v-title').value = '';
        document.getElementById('v-desc').value = '';
        renderTechTags();
        
        showPage('page-market');
    } else {
        console.error(error);
        tg.showAlert("Ошибка базы данных: " + error.message);
    }
}

function closeRoleSheet() {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('role-sheet').classList.remove('active');
}

init();