require('dotenv').config();
const { Bot, InlineKeyboard } = require("grammy");
const { createClient } = require('@supabase/supabase-js');

// Проверка переменных окружения
if (!process.env.BOT_TOKEN || !process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error("❌ ОШИБКА: Не заполнен .env файл!");
    process.exit(1);
}

const bot = new Bot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// --- ЛОГИКА REALTIME (СЛУШАЕМ БАЗУ) ---
const listenToApplications = () => {
    console.log("🔔 Подключение к Realtime Supabase...");
    
    supabase
        .channel('applications-tracker')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'applications' }, 
            async (payload) => {
                const app = payload.new;
                console.log("🚀 Новый отклик:", app);

                if (!app.hr_id) return console.error("❌ В отклике нет HR_ID!");

                try {
                    await bot.api.sendMessage(app.hr_id, 
                        `🔔 <b>НОВЫЙ ОТКЛИК!</b>\n\n` +
                        `👤 <b>Кандидат:</b> ${app.candidate_name || 'Не указан'}\n` +
                        `💼 <b>На позицию:</b> ${app.role || 'Не указана'}\n` + 
                        `📅 <b>Дата:</b> ${new Date().toLocaleString('ru-RU')}`,
                        {
                            parse_mode: "HTML", 
                            reply_markup: new InlineKeyboard()
                                .text("✅ Принять", `decision_accept_${app.id}`)
                                .text("❌ Отклонить", `decision_reject_${app.id}`)
                        }
                    );
                } catch (e) {
                    console.error(`❌ Не удалось отправить сообщение HR (${app.hr_id}):`, e.message);
                }
            }
        )
        .subscribe((status) => {
            console.log("Статус подписки Realtime:", status);
        });
};

// --- ОБРАБОТКА КНОПОК ---
bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    // Решение по отклику
    if (data.startsWith("decision_")) {
        const parts = data.split("_"); // decision, accept, uuid
        const action = parts[1];
        const appId = parts[2];
        const status = action === 'accept' ? 'accepted' : 'rejected';

        // 1. Получаем данные о времени создания
        const { data: app, error } = await supabase
            .from('applications')
            .select('created_at, candidate_name')
            .eq('id', appId)
            .single();

        if (error || !app) {
            return ctx.answerCallbackQuery("❌ Отклик не найден или удален.");
        }

        // 2. Считаем время реакции
        const reactionTime = Date.now() - new Date(app.created_at).getTime();

        // 3. Обновляем статус в базе
        await supabase.from('applications').update({ 
            status: status,
            response_time_ms: reactionTime
        }).eq('id', appId);

        // 4. Обновляем сообщение в чате
        const statusText = status === 'accepted' ? '✅ ПРИНЯТ' : '❌ ОТКЛОНЕН';
        const minutes = Math.floor(reactionTime / 60000);
        const seconds = Math.floor((reactionTime % 60000) / 1000);

        await ctx.editMessageText(
            `🏁 <b>Решение принято</b>\n\n` +
            `👤 Кандидат: ${app.candidate_name}\n` +
            `📊 Статус: <b>${statusText}</b>\n` +
            `⏱ Время реакции: ${minutes} мин ${seconds} сек`,
            { parse_mode: "HTML" }
        );
        return ctx.answerCallbackQuery("Статус обновлен!");
    }

    // Выбор роли при старте
    if (data.startsWith("role_")) {
        const role = data.split("_")[1]; // candidate или hr
        const userId = ctx.from.id;
        const username = ctx.from.username || ctx.from.first_name;

        const { error } = await supabase
            .from('profiles')
            .upsert({ user_id: userId, role: role, username: username });

        if (error) {
            return ctx.answerCallbackQuery("Ошибка сохранения роли!");
        }

        const roleName = role === 'hr' ? 'Рекрутер' : 'Соискатель';
        await ctx.editMessageText(`✅ Вы зарегистрированы как <b>${roleName}</b>! Нажмите /start, чтобы открыть приложение.`, { parse_mode: "HTML" });
    }
});

// --- КОМАНДЫ ---
bot.command("start", async (ctx) => {
    // Проверяем, есть ли пользователь в базе
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', ctx.from.id).single();

    if (!profile) {
        return ctx.reply("👋 Добро пожаловать в ACTIO!\nВыберите вашу роль:", {
            reply_markup: new InlineKeyboard()
                .text("👨‍💻 Я Соискатель", "role_candidate")
                .text("💼 Я Рекрутер", "role_hr")
        });
    }

    ctx.reply(`С возвращением, ${profile.username}!`, {
        reply_markup: {
            keyboard: [[{ text: "🚀 ОТКРЫТЬ ACTIO", web_app: { url: process.env.APP_URL } }]],
            resize_keyboard: true
        }
    });
});

// Запуск
listenToApplications();
bot.start();
console.log("🤖 Бот запущен...");