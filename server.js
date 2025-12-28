require('dotenv').config();
const { Bot, InlineKeyboard, Keyboard } = require("grammy");
const { createClient } = require('@supabase/supabase-js');

const bot = new Bot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Слушаем новые отклики через Supabase Realtime
const listenToApplications = () => {
    supabase
        .channel('db-changes')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'applications' }, 
            async (payload) => {
                const app = payload.new;
                console.log("Новый отклик:", app);

                // Отправляем уведомление HR-у
                try {
                    await bot.api.sendMessage(app.hr_id, 
                        `🚀 *Новый отклик!*\n\n` +
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
                    console.error("Ошибка отправки уведомления HR:", e.message);
                }
            }
        )
        .subscribe();
};

// Обработка кнопок "Принять/Отклонить" (Измерение ACTIO)
bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith("accept_") || data.startsWith("reject_")) {
        const [action, appId] = data.split("_");
        const status = action === 'accept' ? 'accepted' : 'rejected';

        // 1. Получаем время создания отклика
        const { data: app } = await supabase.from('applications').select('created_at').eq('id', appId).single();
        
        if (app) {
            const startTime = new Date(app.created_at).getTime();
            const responseTimeMs = Date.now() - startTime; // Измеряем скорость реакции

            // 2. Обновляем статус и время в базе
            await supabase.from('applications').update({
                status: status,
                response_time_ms: responseTimeMs
            }).eq('id', appId);

            const seconds = Math.floor(responseTimeMs / 1000);
            await ctx.editMessageText(`✅ Обработано за ${seconds} сек. Статус: ${status.toUpperCase()}`);
        }
    }

    if (data.startsWith("set_role_")) {
        const role = data.replace("set_role_", "");
        await supabase.from('profiles').upsert([{ user_id: ctx.from.id, role: role, username: ctx.from.username }]);
        return ctx.editMessageText(`Вы выбрали роль: ${role === 'hr' ? 'Рекрутер' : 'Соискатель'}. Нажмите /start`);
    }
});

bot.command("start", async (ctx) => {
    const userId = ctx.from.id;
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).single();

    if (!profile) {
        return ctx.reply("Добро пожаловать в ACTIO! Выберите роль:", {
            reply_markup: new InlineKeyboard()
                .text("👨‍💻 Соискатель", "set_role_candidate")
                .text("💼 Рекрутер", "set_role_hr")
        });
    }

    ctx.reply(`Твой статус: ${profile.role === 'hr' ? 'Рекрутер' : 'Соискатель'}.`, {
        reply_markup: new Keyboard().webApp("Запустить ACTIO", process.env.APP_URL).resized()
    });
});

async function main() {
    console.log("--- ACTIO BOT STARTING ---");
    listenToApplications();
    bot.start();
}
main();