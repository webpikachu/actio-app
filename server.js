require('dotenv').config();
const { Bot, InlineKeyboard, Keyboard } = require("grammy");
const { createClient } = require('@supabase/supabase-js');

// 1. Инициализация
const bot = new Bot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 2. Функция прослушивания базы в реальном времени (Realtime)
// Важно: Убедись, что в Supabase включена репликация для таблицы 'applications'!
const listenToApplications = () => {
    console.log("🔔 Realtime: Слушаю новые отклики...");
    supabase
        .channel('schema-db-changes')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'applications' }, 
            async (payload) => {
                const app = payload.new;
                console.log("🚀 Получен новый отклик:", app);

                // Отправляем уведомление HR-у (используем hr_id из таблицы)
                try {
                    await bot.api.sendMessage(app.hr_id, 
                        `🚀 *НОВЫЙ ОТКЛИК!*\n\n` +
                        `👤 Кандидат: ${app.candidate_name}\n` +
                        `💼 Роль: ${app.role}`, 
                        {
                            parse_mode: "Markdown",
                            reply_markup: new InlineKeyboard()
                                .text("✅ ПРИНЯТЬ", `accept_${app.id}`)
                                .text("❌ ОТКЛОНИТЬ", `reject_${app.id}`)
                        }
                    );
                } catch (e) {
                    console.error("❌ Ошибка отправки сообщения HR:", e.message);
                }
            }
        )
        .subscribe();
};

// 3. Обработка нажатий на кнопки (Callback Queries)
bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    // ОБРАБОТКА ОТКЛИКА (ПРИНЯТЬ/ОТКЛОНИТЬ)
    if (data.startsWith("accept_") || data.startsWith("reject_")) {
        const [action, appId] = data.split("_");
        const status = action === 'accept' ? 'accepted' : 'rejected';

        // ИЗМЕРЯЕМ СКОРОСТЬ РЕАКЦИИ (Метрика ACTIO)
        const { data: app, error: fetchError } = await supabase
            .from('applications')
            .select('created_at')
            .eq('id', appId)
            .single();
        
        if (app) {
            const startTime = new Date(app.created_at).getTime();
            const responseTimeMs = Date.now() - startTime; // Разница в мс

            // Записываем результат в базу
            const { error: updateError } = await supabase
                .from('applications')
                .update({
                    status: status,
                    response_time_ms: responseTimeMs
                })
                .eq('id', appId);

            if (!updateError) {
                const seconds = Math.floor(responseTimeMs / 1000);
                await ctx.editMessageText(
                    `✅ Обработано!\n⏱ Скорость: ${seconds} сек.\n📈 Статус: ${status.toUpperCase()}`
                );
            } else {
                await ctx.answerCallbackQuery("Ошибка обновления базы.");
            }
        }
    }

    // УСТАНОВКА РОЛИ ПОЛЬЗОВАТЕЛЯ
    if (data.startsWith("set_role_")) {
        const role = data.replace("set_role_", "");
        const { error } = await supabase
            .from('profiles')
            .upsert([{ 
                user_id: ctx.from.id, 
                role: role, 
                username: ctx.from.username 
            }]);

        if (!error) {
            await ctx.editMessageText(
                `🎉 Вы зарегистрированы как ${role === 'hr' ? 'Рекрутер' : 'Соискатель'}!\n\n` +
                `Теперь введите /start, чтобы открыть меню приложения.`
            );
        }
    }
});

// 4. Команда СТАРТ
bot.command("start", async (ctx) => {
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', ctx.from.id)
        .single();

    // Если пользователя нет в базе — просим выбрать роль
    if (!profile) {
        return ctx.reply("Привет! Это ACTIO. Кем вы являетесь?", {
            reply_markup: new InlineKeyboard()
                .text("👨‍💻 Соискатель", "set_role_candidate")
                .text("💼 Рекрутер", "set_role_hr")
        });
    }

    // Если профиль есть — даем кнопку запуска Mini App
    ctx.reply(`Ваш статус: ${profile.role === 'hr' ? '💼 Рекрутер' : '👨‍💻 Соискатель'}.`, {
        reply_markup: new Keyboard()
            .webApp("ОТКРЫТЬ ACTIO", process.env.APP_URL)
            .resized()
    });
});

// 5. Команда ОЧИСТКИ (Для тестов "с нуля")
bot.command("clear", async (ctx) => {
    try {
        // Удаляем данные из всех таблиц (кроме системных)
        await supabase.from('applications').delete().neq('candidate_name', 'SystemPlaceholder');
        await supabase.from('vacancies').delete().neq('title', 'SystemPlaceholder');
        await supabase.from('user_roles').delete().neq('role_name', 'SystemPlaceholder');
        await supabase.from('profiles').delete().neq('username', 'SystemPlaceholder');
        
        ctx.reply("🚨 *БАЗА ДАННЫХ ОЧИЩЕНА*\n\nТеперь вы можете снова использовать /start для выбора роли.", { parse_mode: "Markdown" });
    } catch (e) {
        ctx.reply("Ошибка очистки: " + e.message);
    }
});

// Запуск
console.log("--- ACTIO BOT ЗАПУСКАЕТСЯ ---");
listenToApplications();
bot.start();