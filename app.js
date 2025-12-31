const tg = window.Telegram.WebApp;
tg.expand();

// --- ВСТАВЬ СВОИ ДАННЫЕ НИЖЕ ---
const SUPABASE_URL = "https://твоя-ссылка.supabase.co"; 
const SUPABASE_KEY = "твой-anon-ключ";
// -------------------------------

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const userId = tg.initDataUnsafe?.user?.id; // Telegram ID

// Элементы UI
const statusEl = document.getElementById('user-status');
const createBtn = document.getElementById('btn-create');
const feedEl = document.getElementById('vacancy-feed');

async function init() {
    // 1. Если открыто не в Telegram
    if (!userId) {
        statusEl.innerText = "⚠️ Открой в Telegram";
        statusEl.classList.add('text-red-500');
        return;
    }

    statusEl.innerText = `ID: ${userId} (Проверка...)`;

    // 2. Получаем роль из базы
    const { data: profile, error } = await client
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .single();

    if (error) {
        console.error("Ошибка профиля:", error);
        statusEl.innerText = `Ошибка: ${error.message}`;
        // Для ТЕСТА: Если профиля нет, покажем кнопку все равно (чтобы ты увидел её)
        // createBtn.classList.remove('hide'); 
        return;
    }

    // 3. Логика отображения
    if (profile && profile.role === 'hr') {
        statusEl.innerText = "✅ Роль: Рекрутер";
        statusEl.classList.add('text-green-500');
        createBtn.classList.remove('hide'); // ПОКАЗЫВАЕМ КНОПКУ "+"
    } else {
        statusEl.innerText = "👤 Роль: Соискатель";
        createBtn.classList.add('hide');
    }

    // 4. Загружаем вакансии
    loadVacancies();
}

async function loadVacancies() {
    feedEl.innerHTML = '<div class="text-center text-gray-500 mt-10">Загрузка...</div>';
    
    const { data: vacancies, error } = await client
        .from('vacancies')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !vacancies.length) {
        feedEl.innerHTML = '<div class="text-center text-gray-500 mt-10">Вакансий пока нет</div>';
        return;
    }

    feedEl.innerHTML = vacancies.map(v => `
        <div class="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <h3 class="font-bold text-lg">${v.title}</h3>
            <div class="text-sm text-gray-500 flex justify-between mt-1">
                <span>${v.city || 'Remote'}</span>
                <span class="text-blue-500 font-semibold">${v.salary_min ? v.salary_min : ''} ${v.currency || ''}</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
                ${(v.tech_stack || []).map(tag => `<span class="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded text-xs">${tag}</span>`).join('')}
            </div>
            <button onclick="tg.showAlert('Отклик пока в разработке')" class="mt-4 w-full bg-gray-100 dark:bg-gray-800 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                Откликнуться
            </button>
        </div>
    `).join('');
}

// Запуск
document.addEventListener('DOMContentLoaded', init);