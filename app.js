const tg = window.Telegram.WebApp;
tg.expand(); // Раскрыть на весь экран

// --- НАСТРОЙКИ (ВСТАВЬ СВОИ ДАННЫЕ!) ---
const SUPABASE_URL = "https://твоя-ссылка.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGVhaWJoYWR3c3hxZWJvaGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzQ0OTYsImV4cCI6MjA4MjI1MDQ5Nn0._JQQBh9JVswhMoxmthN2U1l-Bvs65-bSSsNdv51sPvQ";
// ---------------------------------------

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const currentUserId = tg.initDataUnsafe?.user?.id; 

// Элементы интерфейса
const feedContainer = document.getElementById('vacancy-feed');
const createBtn = document.getElementById('nav-create-btn');
const roleBadge = document.getElementById('user-role-badge');

// --- ЗАПУСК ПРИЛОЖЕНИЯ ---
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Проверка окружения
    if (!currentUserId) {
        if(roleBadge) roleBadge.innerText = "Не в Telegram";
        // Для тестов в браузере раскомментируй строку ниже и вставь свой ID:
        // checkUserRole(123456789); 
        return;
    }

    // 2. Проверка роли пользователя
    await checkUserRole(currentUserId);

    // 3. Загрузка ленты вакансий
    // (Если мы на главной странице)
    if (feedContainer) {
        loadVacancies();
    }
});

// --- ФУНКЦИЯ ПРОВЕРКИ РОЛИ ---
async function checkUserRole(userId) {
    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('user_id', userId)
            .single();

        if (error || !profile) {
            console.warn("Профиль не найден или ошибка", error);
            if(roleBadge) roleBadge.innerText = "Гость";
            return;
        }

        // Обновляем бейдж
        if(roleBadge) roleBadge.innerText = profile.role === 'hr' ? "Рекрутер" : "Соискатель";

        // ГЛАВНОЕ: Если HR, показываем кнопку создания
        if (profile.role === 'hr' && createBtn) {
            createBtn.classList.remove('hidden');
        }

    } catch (err) {
        console.error("Ошибка проверки роли:", err);
    }
}

// --- ЗАГРУЗКА ВАКАНСИЙ (ДЛЯ INDEX.HTML) ---
async function loadVacancies() {
    if (!feedContainer) return;

    feedContainer.innerHTML = '<div class="text-center mt-10 text-gray-500">Обновление...</div>';

    const { data: vacancies, error } = await supabaseClient
        .from('vacancies')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        feedContainer.innerText = "Ошибка загрузки: " + error.message;
        return;
    }

    if (!vacancies || vacancies.length === 0) {
        feedContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-gray-400">
                <span class="text-4xl mb-2">📭</span>
                <p>Ваши вакансии будут здесь</p>
            </div>`;
        return;
    }

    // Рендеринг списка
    feedContainer.innerHTML = vacancies.map(v => `
        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
            <h3 class="font-bold text-lg text-gray-900 dark:text-white">${v.title}</h3>
            
            <div class="flex justify-between text-sm text-gray-500 mt-1">
                <span>📍 ${v.city || 'Удаленно'}</span>
                <span class="font-semibold text-green-600">${v.salary_min ? v.salary_min : '$$$'} ${v.currency}</span>
            </div>

            <div class="mt-3 flex flex-wrap gap-2">
                ${(v.tech_stack || []).map(tag => 
                    `<span class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs rounded-md">${tag}</span>`
                ).join('')}
            </div>

            <button onclick="applyForVacancy('${v.id}', '${v.title}', '${v.hr_id}')" class="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition active:scale-95">
                Откликнуться
            </button>
        </div>
    `).join('');
}

// --- ОТКЛИК НА ВАКАНСИЮ ---
async function applyForVacancy(vacancyId, vacancyTitle, hrId) {
    if (!confirm(`Отправить отклик на "${vacancyTitle}"?`)) return;

    tg.MainButton.showProgress();

    // Берем имя из Телеграм
    const candidateName = (tg.initDataUnsafe?.user?.first_name || "Кандидат") + " " + (tg.initDataUnsafe?.user?.username || "");

    const { error } = await supabaseClient
        .from('applications')
        .insert([{
            vacancy_id: vacancyId,
            hr_id: hrId,
            candidate_id: currentUserId,
            candidate_name: candidateName,
            role: vacancyTitle,
            status: 'pending'
        }]);

    tg.MainButton.hideProgress();

    if (error) {
        tg.showAlert("Ошибка: " + error.message);
    } else {
        tg.showAlert("✅ Отклик отправлен! Рекрутер получит уведомление.");
    }
}

// --- ПУБЛИКАЦИЯ ВАКАНСИИ (ДЛЯ PUBLISH.HTML) ---
// Эту функцию вызывать из publish.html
async function publishVacancyGlobal() {
    const title = document.getElementById('v-title').value;
    const city = document.getElementById('v-city').value;
    const desc = document.getElementById('v-desc').value;
    // Предполагаем, что стек собирается в глобальную переменную vacancyTechStack (из прошлого кода)
    // Для простоты здесь берем хардкод или нужно добавить логику инпута
    
    if(!title) return tg.showAlert("Нужен заголовок!");

    tg.MainButton.showProgress();

    const { error } = await supabaseClient.from('vacancies').insert([{
        hr_id: currentUserId,
        title: title,
        city: city,
        description: desc,
        tech_stack: window.vacancyTechStack || ['General'], // Защита от пустого массива
        salary_min: document.getElementById('v-salary-min')?.value || 0,
        currency: '₽'
    }]);

    tg.MainButton.hideProgress();

    if (error) {
        tg.showAlert("Ошибка: " + error.message);
    } else {
        tg.showAlert("Вакансия опубликована!");
        window.location.href = 'index.html';
    }
}