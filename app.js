const tg = window.Telegram.WebApp;

// --- НАСТРОЙКИ ---
// Вставьте сюда ваши реальные данные из настроек Supabase
const SUPABASE_URL = "https://cgdeaibhadwsxqebohcj.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZGVhaWJoYWR3c3hxZWJvaGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzQ0OTYsImV4cCI6MjA4MjI1MDQ5Nn0._JQQBh9JVswhMoxmthN2U1l-Bvs65-bSSsNdv51sPvQ"; // ⚠️ Вставьте сюда ANON public key

// Инициализация
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const userId = tg.initDataUnsafe?.user?.id; // Берем ID реального юзера

// Глобальное состояние
let currentUserRole = null;
let vacancyTechStack = [];

// --- СТАРТ ПРИЛОЖЕНИЯ ---
async function init() {
    tg.expand();
    
    // Проверка, запущен ли апп внутри Телеграм
    if (!userId) {
        alert("Пожалуйста, откройте приложение через Telegram!");
        return;
    }

    // Загружаем профиль
    const { data: profile, error } = await client
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .single();

    if (error || !profile) {
        alert("Профиль не найден. Перезапустите бота через /start");
        return;
    }

    currentUserRole = profile.role;
    console.log("Роль пользователя:", currentUserRole);

    // Настраиваем интерфейс (скрываем лишнее)
    if (currentUserRole === 'hr') {
        // Логика для HR (если нужно что-то скрыть/показать)
    } else {
        // Логика для Кандидата
    }
}

// --- ЛОГИКА ПУБЛИКАЦИИ ВАКАНСИИ (HR) ---

// Добавление тега
function addTechTag() {
    const input = document.getElementById('v-tech-input');
    if (!input) return;
    
    const tag = input.value.trim();
    if (tag && !vacancyTechStack.includes(tag)) {
        vacancyTechStack.push(tag);
        renderTechTags();
        input.value = '';
    }
}

// Удаление тега
function removeTechTag(index) {
    vacancyTechStack.splice(index, 1);
    renderTechTags();
}

// Отрисовка тегов
function renderTechTags() {
    const container = document.getElementById('v-tech-list');
    if (!container) return;

    container.innerHTML = vacancyTechStack.map((t, i) => `
        <span class="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            ${t}
            <button onclick="removeTechTag(${i})" class="ml-1 hover:text-red-500">✕</button>
        </span>
    `).join('');
}

// Отправка формы в базу
async function publishVacancy() {
    // 1. Собираем данные
    const title = document.getElementById('v-title').value.trim();
    const city = document.getElementById('v-city').value.trim();
    const desc = document.getElementById('v-desc').value.trim();
    
    // Получаем значение радио-кнопки
    const levelEl = document.querySelector('input[name="level"]:checked');
    const level = levelEl ? levelEl.value : 'Middle';

    const sMin = document.getElementById('v-salary-min').value;
    const sMax = document.getElementById('v-salary-max').value;
    const currency = document.getElementById('v-currency').value;

    // 2. Валидация
    if (!title) return tg.showAlert("Введите название вакансии!");
    if (vacancyTechStack.length === 0) return tg.showAlert("Добавьте хотя бы один тег стека!");

    // 3. Отправка
    tg.MainButton.showProgress();
    
    const { error } = await client.from('vacancies').insert([{
        hr_id: userId, // ВАЖНО: ID текущего юзера
        title: title,
        city: city,
        level: level,
        salary_min: sMin ? parseInt(sMin) : null,
        salary_max: sMax ? parseInt(sMax) : null,
        currency: currency,
        tech_stack: vacancyTechStack,
        description: desc
    }]);

    tg.MainButton.hideProgress();

    if (error) {
        console.error(error);
        tg.showAlert("Ошибка при создании: " + error.message);
    } else {
        tg.showAlert("✅ Вакансия успешно опубликована!");
        // Очистка формы
        document.getElementById('v-title').value = "";
        document.getElementById('v-desc').value = "";
        vacancyTechStack = [];
        renderTechTags();
        // Можно добавить редирект: window.location.href = 'index.html';
    }
}

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', init);