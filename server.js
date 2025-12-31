require('dotenv').config();
const { Bot, InlineKeyboard } = require("grammy");
const { createClient } = require('@supabase/supabase-js');

// --- КОНФИГУРАЦИЯ ---
const bot = new Bot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const APP_URL = process.env.APP_URL; // Ссылка на твой Web App (https://....)

// --- ЛОГИКА УВЕДОМЛЕНИЙ (REALTIME) ---
// Бот слушает базу данных: когда появляется новый отклик, он пишет рекрутеру
supabase
    .channel('applications-monitor')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applications' }, async (payload) => {
        const app = payload.new;
        if (!app.hr_id) return;

        try {
            await bot.api.sendMessage(app.hr_id, 
                `🔔 <b>НОВЫЙ ОТКЛИК!</b>\n\n` +
                `👤 <b>Кандидат:</b> ${app.candidate_name || 'Аноним'}\n` +
                `💼 <b>Вакансия:</b> ${app.role || 'Не указана'}\n` +
                `📅 <b>Дата:</b> ${new Date().toLocaleString('ru-RU')}`,
                {
                    parse_mode: "HTML",
                    reply_markup: new InlineKeyboard()
                        .text("✅ Связаться", `contact_${app.candidate_id}`)
                        .text("❌ Отклонить", `reject_${app.id}`)
                }
            );
        } catch (e) {
            console.error(`Ошибка отправки уведомления HRу (${app.hr_id}):`, e);
        }
    })
    .subscribe();

// --- КОМАНДА /START ---
bot.command("start", async (ctx) => {
    const userId = ctx.from.id;
    
    // Проверяем, есть ли уже такой пользователь
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    // Если пользователя нет — предлагаем выбрать роль
    if (!profile) {
        return ctx.reply("Добро пожаловать! Выберите вашу роль:", {
            reply_markup: new InlineKeyboard()
                .text("👨‍💻 Я Кандидат", "set_role_candidate")
                .text("👔 Я Рекрутер (HR)", "set_role_hr")
        });
    }

    // Если есть — даем кнопку входа
    const roleText = profile.role === 'hr' ? 'Рекрутер' : 'Кандидат';
    await ctx.reply(`Вы авторизованы как: <b>${roleText}</b>.`, {
        parse_mode: "HTML",
        reply_markup: {
            keyboard: [[{ text: "🚀 ОТКРЫТЬ ПРИЛОЖЕНИЕ", web_app: { url: APP_URL } }]],
            resize_keyboard: true
        }
    });
});

// --- ОБРАБОТКА КНОПОК ---
bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;

    // Регистрация роли
    if (data.startsWith("set_role_")) {
        const role = data.replace("set_role_", "");
        
        const { error } = await supabase
            .from('profiles')
            .upsert({ user_id: userId, role: role, username: username });

        if (error) {
            console.error(error);
            return ctx.answerCallbackQuery("Ошибка базы данных!");
        }

        await ctx.editMessageText("✅ Роль сохранена! Нажмите кнопку ниже, чтобы войти.");
        await ctx.reply("Нажмите кнопку меню или введите /start снова, чтобы появилась кнопка приложения.");
    }
});

// Запуск
console.log("🤖 Бот запущен...");
bot.start();