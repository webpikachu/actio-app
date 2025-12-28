const tg = window.Telegram.WebApp;
const SUPABASE_URL = "https://cgdeaibhadwsxqebohcj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGVhaWJoYWR3c3hxZWJvaGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzQ0OTYsImV4cCI6MjA4MjI1MDQ5Nn0._JQQBh9JVswhMoxmthN2U1l-Bvs65-bSSsNdv51sPvQ"; 
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userRole = 'candidate';

async function init() {
    tg.expand();
    const userId = tg.initDataUnsafe?.user?.id || 0;
    
    // Получаем актуальную роль из базы
    const { data: profile, error } = await client.from('profiles').select('role').eq('user_id', userId).single();
    
    if (profile) {
        userRole = profile.role;
        console.log("Ваша роль в базе:", userRole);
    } else {
        console.log("Профиль не найден, создаем запись...");
        await client.from('profiles').insert([{ user_id: userId, role: 'candidate' }]);
    }
    
    renderHeader();
    loadMarket();
}

function renderHeader() {
    const actions = document.getElementById('header-actions');
    // ЕСЛИ В БАЗЕ HR - РИСУЕМ СИНЮЮ КНОПКУ
    if (userRole === 'hr') {
        actions.innerHTML = `
            <button onclick="showPage('page-post-vacancy')" class="bg-primary px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                + Вакансия
            </button>
        `;
    } else {
        actions.innerHTML = `<button onclick="showPage('page-profile')" class="text-primary font-bold">Профиль</button>`;
    }
}

async function publishVacancy() {
    const title = document.getElementById('v-title').value;
    const city = document.getElementById('v-city').value;
    const desc = document.getElementById('v-desc').value;
    const level = document.querySelector('input[name="level"]:checked').value;

    if (!title) return tg.showAlert("Введите название!");

    const { error } = await client.from('vacancies').insert([{
        hr_id: tg.initDataUnsafe?.user?.id,
        title, city, level, description: desc
    }]);

    if (!error) {
        tg.showAlert("Успешно опубликовано!");
        showPage('page-market');
        loadMarket();
    }
}

async function loadMarket() {
    const list = document.getElementById('vacancies-list');
    list.innerHTML = `<p class='text-center py-10 opacity-50 italic font-medium'>Загрузка рынка...</p>`;
    const { data } = await client.from('vacancies').select('*').order('created_at', { ascending: false });
    if (data) {
        list.innerHTML = data.map(v => `
            <div class="bg-[#1c1c1e] p-5 rounded-2xl border border-[#3a3a3c] shadow-lg">
                <h3 class="text-lg font-bold">${v.title}</h3>
                <p class="text-xs text-gray-500 uppercase mt-1">${v.city || 'Удаленно'} • ${v.level}</p>
            </div>
        `).join('');
    }
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

init();