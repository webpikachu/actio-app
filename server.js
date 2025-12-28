require('dotenv').config();
const { Bot, InlineKeyboard, Keyboard } = require("grammy");
const { createClient } = require('@supabase/supabase-js');

const bot = new Bot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function clearDatabase() {
    console.log("--- ACTIO: CLEANING TEST DATA ---");
    await supabase.from('applications').delete().filter('id', 'neq', '00000000-0000-0000-0000-000000000000');
    console.log("✅ Applications cleared.");
}

bot.command("start", async (ctx) => {
    const userId = ctx.from.id;
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).single();

    if (!profile) {
        return ctx.reply("Добро пожаловать! Выберите роль:", {
            reply_markup: new InlineKeyboard().text("👨‍💻 Соискатель", "set_role_candidate").text("💼 Рекрутер", "set_role_hr")
        });
    }
    ctx.reply(`С возвращением! Вы: ${profile.role === 'hr' ? 'Рекрутер' : 'Соискатель'}.`, {
        reply_markup: new Keyboard().webApp("Открыть ACTIO Market", process.env.APP_URL).resized()
    });
});

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data.startsWith("set_role_")) {
        const role = data.replace("set_role_", "");
        await supabase.from('profiles').upsert([{ user_id: ctx.from.id, role: role, username: ctx.from.username }]);
        return ctx.editMessageText(`Вы — ${role === 'hr' ? 'Рекрутер' : 'Соискатель'}. Теперь откройте приложение через /start.`);
    }

    if (data.startsWith("accept_")) {
        const [_, startTime, roleTitle] = data.split("_");
        const duration = Math.floor((Date.now() - parseInt(startTime)) / 1000);
        await supabase.from('applications').update({ status: 'accepted', response_time_ms: duration * 1000 }).eq('role', roleTitle).eq('status', 'pending');
        await ctx.editMessageText(`✅ Принято! Скорость: ${duration} сек.`);
    }
});

bot.on("message:web_app_data", async (ctx) => {
    const data = JSON.parse(ctx.message.web_app_data.data);
    if (data.action === 'new_apply') {
        const startTime = Date.now();
        await ctx.api.sendMessage(data.hr_id || process.env.HR_ID, 
            `⚡️ **НОВЫЙ ОТКЛИК**\nВакансия: ${data.role}\nТаймер запущен.`, 
            { parse_mode: "Markdown", reply_markup: new InlineKeyboard().text("✅ ПРИНЯТЬ", `accept_${startTime}_${data.role}`) }
        );
    }
});

async function main() {
    await clearDatabase();
    console.log("--- ACTIO ENGINE IS RUNNING ---");
    bot.start();
}
main();