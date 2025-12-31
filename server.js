require('dotenv').config();
const { Bot, InlineKeyboard } = require("grammy");
const { createClient } = require('@supabase/supabase-js');

/* ==============================
   CONFIG
================================ */
const bot = new Bot(process.env.BOT_TOKEN);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
const APP_URL = process.env.APP_URL;

/* ==============================
   REALTIME: NEW APPLICATION
================================ */
supabase
  .channel('applications-monitor')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'applications' },
    async (payload) => {
      const app = payload.new;
      if (!app.hr_id) return;

      try {
        // 1. Основное уведомление HR
        await bot.api.sendMessage(
          app.hr_id,
          `🔔 <b>НОВЫЙ ОТКЛИК</b>\n\n` +
          `👤 <b>Кандидат:</b> ${app.candidate_name || 'Аноним'}\n` +
          `💼 <b>Роль:</b> ${app.role || '—'}\n` +
          `⏳ <b>Дедлайн:</b> ${
            app.deadline_at
              ? new Date(app.deadline_at).toLocaleString('ru-RU')
              : '—'
          }`,
          {
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard()
              .text("✅ Принять", `accept_${app.id}`)
              .text("❌ Отклонить", `reject_${app.id}`)
              .row()
              .text("ℹ️ Профиль", `info_${app.id}`)
          }
        );

        // 2. Herald-доставка PDF резюме (если есть)
        if (app.resume_url) {
          await bot.api.sendDocument(
            app.hr_id,
            app.resume_url,
            {
              caption:
                `📎 <b>Резюме кандидата</b>\n` +
                `👤 ${app.candidate_name || ''}\n` +
                `💼 ${app.role || ''}`,
              parse_mode: "HTML"
            }
          );
        }

      } catch (e) {
        console.error(`Ошибка уведомления HR (${app.hr_id})`, e);
      }
    }
  )
  .subscribe();

/* ==============================
   /START
================================ */
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!profile) {
    return ctx.reply(
      "Добро пожаловать! Выберите вашу роль:",
      {
        reply_markup: new InlineKeyboard()
          .text("👨‍💻 Я Кандидат", "set_role_candidate")
          .text("👔 Я Рекрутер (HR)", "set_role_hr")
      }
    );
  }

  const roleText = profile.role === 'hr' ? 'Рекрутер' : 'Кандидат';

  await ctx.reply(
    `Вы авторизованы как: <b>${roleText}</b>`,
    {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [
          [{ text: "🚀 ОТКРЫТЬ ПРИЛОЖЕНИЕ", web_app: { url: APP_URL } }]
        ],
        resize_keyboard: true
      }
    }
  );
});

/* ==============================
   CALLBACK QUERIES
================================ */
bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;

  /* ---- ROLE SETUP ---- */
  if (data.startsWith("set_role_")) {
    const role = data.replace("set_role_", "");

    const { error } = await supabase
      .from('profiles')
      .upsert({
        user_id: userId,
        role,
        username
      });

    if (error) {
      console.error(error);
      return ctx.answerCallbackQuery("Ошибка базы данных");
    }

    await ctx.editMessageText("✅ Роль сохранена");
    await ctx.reply("Введите /start чтобы открыть приложение");
    return;
  }

  /* ---- ACCEPT / REJECT ---- */
  if (data.startsWith("accept_") || data.startsWith("reject_")) {
    const appId = data.split("_")[1];
    const newStatus = data.startsWith("accept_")
      ? "accepted"
      : "rejected";

    const { data: appRow, error } = await supabase
      .from("applications")
      .select("*")
      .eq("id", appId)
      .single();

    if (error || !appRow) {
      return ctx.answerCallbackQuery("Отклик не найден");
    }

    const createdAt = new Date(appRow.created_at).getTime();
    const responseMs = Date.now() - createdAt;

    await supabase
      .from("applications")
      .update({
        status: newStatus,
        response_time_ms: responseMs,
        candidate_chat_unlocked: newStatus === "accepted"
      })
      .eq("id", appId);

    await ctx.answerCallbackQuery(
      newStatus === "accepted" ? "Принято ✅" : "Отклонено ❌"
    );

    /* SAFE DIRECT LINK */
    if (newStatus === "accepted") {
      const hrLink = ctx.from.username
        ? `https://t.me/${ctx.from.username}`
        : null;

      await bot.api.sendMessage(
        appRow.candidate_id,
        `✅ <b>Работодатель подтвердил интерес</b>\n\n` +
        (hrLink
          ? `🔗 Связь с HR: ${hrLink}`
          : `HR ответит вам напрямую в Telegram`),
        { parse_mode: "HTML" }
      );
    }

    return;
  }

  /* ---- INFO ---- */
  if (data.startsWith("info_")) {
    const appId = data.split("_")[1];

    const { data: appRow } = await supabase
      .from("applications")
      .select("*")
      .eq("id", appId)
      .single();

    if (!appRow) {
      return ctx.answerCallbackQuery("Нет данных");
    }

    await ctx.reply(
      `📌 <b>Отклик</b>\n` +
      `👤 ${appRow.candidate_name || '—'}\n` +
      `💼 ${appRow.role || '—'}\n` +
      `⏳ Дедлайн: ${
        appRow.deadline_at
          ? new Date(appRow.deadline_at).toLocaleString('ru-RU')
          : '—'
      }\n` +
      `📎 Резюме: ${appRow.resume_url ? 'есть' : 'нет'}`,
      { parse_mode: "HTML" }
    );

    await ctx.answerCallbackQuery("OK");
    return;
  }
});

/* ==============================
   START BOT
================================ */
console.log("🤖 Bot started");
bot.start();
