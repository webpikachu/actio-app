require('dotenv').config();
const { Bot, InlineKeyboard, Keyboard } = require("grammy");
const { createClient } = require('@supabase/supabase-js');

const bot = new Bot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function clearDatabase() {
    console.log("--- СИСТЕМА ACTIO: ОЧИСТКА ТЕСТОВЫХ ДАННЫХ ---");
    
    // Удаляем все отклики
    const { error: appError } = await supabase
        .from('applications')
        .delete()
        .filter('id', 'neq', '00000000-0000-0000-0000-000000000000'); // Удалит всё, где ID не равен пустому UUID

    if (appError) {
        console.error("Ошибка при очистке applications:", appError.message);
    } else {
        console.log("✅ Таблица applications очищена.");
    }

    // Если ты НЕ ХОЧЕШЬ, чтобы удалялись твои созданные РОЛИ (Python и т.д.),
    // убедись, что блок ниже закомментирован символами /* и */
    /*
    const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .filter('id', 'neq', '00000000-0000-0000-0000-000000000000');
    
    if (roleError) console.error("Ошибка очистки ролей:", roleError.message);
    else console.log("✅ Таблица user_roles очищена.");
    */
}

bot.command("start", async (ctx) => {
    const userId = ctx.from.id;

    // Проверяем наличие профиля в Supabase
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (!profile) {
        return ctx.reply("Добро пожаловать в ACTIO! Выберите вашу роль:", {
            reply_markup: new InlineKeyboard()
                .text("👨‍💻 Я Соискатель", "set_role_candidate")
                .text("💼 Я Рекрутер (HR)", "set_role_hr")
        });
    }

    ctx.reply(`С возвращением! Ваша роль: ${profile.role === 'hr' ? 'Рекрутер' : 'Соискатель'}.`, {
        reply_markup: new Keyboard()
            .webApp("Открыть ACTIO Market", process.env.APP_URL)
            .resized()
    });
});

// 2. Слушаем данные от Mini App
bot.on("message:web_app_data", async (ctx) => {
    const data = JSON.parse(ctx.message.web_app_data.data);
    console.log("Данные из Mini App:", data);

    if (data.action === 'new_apply') {
        const startTime = Date.now();
        const cleanRole = data.role.replace(" (как ", "\n🎭 Профиль: ").replace(")", "");
        
        // Определяем, кому слать уведомление (приоритет - hr_id из приложения)
        const targetHR = data.hr_id || process.env.HR_ID; 

        await ctx.api.sendMessage(targetHR, 
            `⚡️ **НОВЫЙ ОТКЛИК**\n\n💼 Вакансия: ${cleanRole}\n\n⏱ Таймер запущен. Нажми кнопку для принятия.`, 
            {
                parse_mode: "Markdown",
                reply_markup: new InlineKeyboard()
                    .text("✅ ПРИНЯТЬ", `accept_${startTime}_${data.role}`)
            }
        ).catch(e => console.error("Ошибка отправки уведомления HR-у:", e));
    }
});

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;

    // 1. Логика выбора роли (Рекрутер или Соискатель)
    if (data.startsWith("set_role_")) {
        const role = data.replace("set_role_", "");
        
        const { error } = await supabase.from('profiles').upsert([{ 
            user_id: userId, 
            role: role, 
            username: ctx.from.username 
        }]);

        if (error) {
            console.error("Ошибка сохранения профиля:", error.message);
            return ctx.answerCallbackQuery("Ошибка сохранения роли");
        }

        await ctx.answerCallbackQuery("Роль сохранена!");
        return ctx.editMessageText(`Готово! Теперь вы — ${role === 'hr' ? 'Рекрутер' : 'Соискатель'}. Напишите /start для входа в приложение.`);
    }

    // 2. Твоя оригинальная логика кнопки ПРИНЯТЬ
    if (data.startsWith("accept_")) {
        console.log("Нажата кнопка ПРИНЯТЬ в Telegram");
        const [_, startTime, roleTitle] = data.split("_");
        const durationSeconds = Math.floor((Date.now() - parseInt(startTime)) / 1000);

        const { error } = await supabase
            .from('applications')
            .update({ 
                status: 'accepted', 
                response_time_ms: durationSeconds * 1000 
            })
            .eq('role', roleTitle)
            .eq('status', 'pending');

        if (error) {
            console.error("Ошибка обновления статуса:", error.message);
            await ctx.answerCallbackQuery("Ошибка БД");
        } else {
            await ctx.editMessageText(`✅ Принято! Скорость реакции: ${durationSeconds} сек.`);
            await ctx.answerCallbackQuery();
        }
    }
});

// ЗАПУСК СИСТЕМЫ
async function main() {
    await clearDatabase(); // Сначала чистим базу
    console.log("--- ACTIO ENGINE IS RUNNING ---");
    bot.start(); // Потом запускаем бота
}

main();