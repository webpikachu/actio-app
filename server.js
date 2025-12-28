require('dotenv').config();
const { Bot, InlineKeyboard, Keyboard } = require("grammy");
const { createClient } = require('@supabase/supabase-js');

const bot = new Bot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function clearDatabase() {
    console.log("--- ACTIO: ПОЛНАЯ ОЧИСТКА ТЕСТОВЫХ ДАННЫХ ---");
    // Удаляем всё из всех таблиц
    await supabase.from('applications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('vacancies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('profiles').delete().neq('user_id', 0);
    await supabase.from('user_roles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log("✅ База данных обнулена для новых тестов.");
}

bot.command("start", async (ctx) => {
    const userId = ctx.from.id;
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).single();

    if (!profile) {
        return ctx.reply("Добро пожаловать в ACTIO! Выберите роль для теста:", {
            reply_markup: new InlineKeyboard()
                .text("👨‍💻 Соискатель", "set_role_candidate")
                .text("💼 Рекрутер", "set_role_hr")
        });
    }

    ctx.reply(`Твой статус: ${profile.role === 'hr' ? 'Рекрутер' : 'Соискатель'}.`, {
        reply_markup: new Keyboard().webApp("Запустить ACTIO", process.env.APP_URL).resized()
    });
});

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data.startsWith("set_role_")) {
        const role = data.replace("set_role_", "");
        await supabase.from('profiles').upsert([{ user_id: ctx.from.id, role: role, username: ctx.from.username }]);
        return ctx.editMessageText(`Вы выбрали роль: ${role}. Нажмите /start для входа.`);
    }
});

async function main() {
    await clearDatabase();
    console.log("--- ACTIO BOT STARTING ---");
    bot.start();
}
main();