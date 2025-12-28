require('dotenv').config();
const { Bot, InlineKeyboard, Keyboard } = require("grammy");
const { createClient } = require('@supabase/supabase-js');

const bot = new Bot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function clearDatabase() {
    console.log("--- ACTIO: ПОЛНАЯ ОЧИСТКА ДАННЫХ (ТЕСТОВЫЙ РЕЖИМ) ---");
    // Удаляем все отклики
    await supabase.from('applications').delete().filter('id', 'neq', '00000000-0000-0000-0000-000000000000');
    // Удаляем все вакансии
    await supabase.from('vacancies').delete().filter('id', 'neq', '00000000-0000-0000-0000-000000000000');
    // Удаляем все профили (роли), чтобы начать сценарий сначала
    await supabase.from('profiles').delete().filter('user_id', 'gt', 0);
    // Удаляем созданные карточки ролей
    await supabase.from('user_roles').delete().filter('id', 'neq', '00000000-0000-0000-0000-000000000000');
    
    console.log("✅ База данных очищена. Все пользователи теперь 'новые'.");
}

bot.command("start", async (ctx) => {
    const userId = ctx.from.id;
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).single();

    if (!profile) {
        return ctx.reply("Привет! Это ACTIO. Для начала тестов выбери свою роль:", {
            reply_markup: new InlineKeyboard()
                .text("👨‍💻 Я Соискатель", "set_role_candidate")
                .text("💼 Я Рекрутер", "set_role_hr")
        });
    }

    ctx.reply(`Твоя текущая роль: ${profile.role === 'hr' ? 'Рекрутер' : 'Соискатель'}.`, {
        reply_markup: new Keyboard().webApp("Открыть ACTIO", process.env.APP_URL).resized()
    });
});

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data.startsWith("set_role_")) {
        const role = data.replace("set_role_", "");
        await supabase.from('profiles').upsert([{ 
            user_id: ctx.from.id, 
            role: role, 
            username: ctx.from.username 
        }]);
        return ctx.editMessageText(`Готово! Ты теперь — ${role === 'hr' ? 'Рекрутер' : 'Соискатель'}.\nНапиши /start, чтобы появилась кнопка входа в приложение.`);
    }

    if (data.startsWith("accept_")) {
        const [_, startTime, roleTitle] = data.split("_");
        const duration = Math.floor((Date.now() - parseInt(startTime)) / 1000);
        await ctx.editMessageText(`✅ Отклик принят рекрутером за ${duration} сек.`);
    }
});

bot.on("message:web_app_data", async (ctx) => {
    const data = JSON.parse(ctx.message.web_app_data.data);
    if (data.action === 'new_apply') {
        const startTime = Date.now();
        await ctx.api.sendMessage(data.hr_id || process.env.HR_ID, 
            `⚡️ **НОВЫЙ СИГНАЛ НА РЫНКЕ**\nВакансия: ${data.role}`, 
            { 
                parse_mode: "Markdown", 
                reply_markup: new InlineKeyboard().text("✅ ПРИНЯТЬ СИГНАЛ", `accept_${startTime}_${data.role}`) 
            }
        );
    }
});

async function main() {
    await clearDatabase();
    console.log("--- ACTIO BOT ЗАПУЩЕН ---");
    bot.start();
}
main();