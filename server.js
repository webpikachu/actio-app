require('dotenv').config();
const { Bot, InlineKeyboard, Keyboard } = require("grammy");
const { createClient } = require('@supabase/supabase-js');

const bot = new Bot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 1. Команда /start с ПРАВИЛЬНОЙ кнопкой
bot.command("start", (ctx) => {
    console.log("Юзер нажал /start");
    ctx.reply("Привет! Чтобы всё сработало, открой маркетплейс кнопкой ниже:", {
        reply_markup: new Keyboard()
            .webApp("Открыть ACTIO Market", process.env.APP_URL)
            .resized()
    });
});

// 2. Слушаем данные от Mini App
bot.on("message:web_app_data", async (ctx) => {
    console.log("СИГНАЛ ПОЛУЧЕН!"); // Это должно появиться в черном окне
    const data = JSON.parse(ctx.message.web_app_data.data);
    console.log("Данные из приложения:", data);

    if (data.action === 'new_apply') {
        const startTime = Date.now();
        
        await ctx.api.sendMessage(process.env.HR_ID, 
            `⚡️ НОВЫЙ ОТКЛИК\nРоль: ${data.role}\nТаймер запущен.`, 
            {
                reply_markup: new InlineKeyboard()
                    .text("✅ ПРИНЯТЬ", `accept_${startTime}_${data.role}`)
            }
        ).catch(e => console.error("Ошибка отправки HR-у:", e));
    }
});

// 3. Обработка кнопки ПРИНЯТЬ
bot.on("callback_query:data", async (ctx) => {
    console.log("Нажата кнопка ПРИНЯТЬ в Telegram");
    const [_, startTime, role] = ctx.callbackQuery.data.split("_");
    const durationSeconds = Math.floor((Date.now() - parseInt(startTime)) / 1000);

    const { error } = await supabase
        .from('applications')
        .update({ status: 'accepted', response_time_ms: durationSeconds * 1000 })
        .eq('role', role)
        .eq('status', 'pending');

    await ctx.editMessageText(`✅ Принято! Скорость: ${durationSeconds} сек.`);
    await ctx.answerCallbackQuery();
});

console.log("--- ACTIO ENGINE IS RUNNING ---");
bot.start();