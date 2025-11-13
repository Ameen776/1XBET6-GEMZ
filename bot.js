const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');

const TELEGRAM_TOKEN = "8020165788:AAHyM7nKtS9eovxiPkHh0SP84eXnyrBLmus";
const ADMIN_CHAT_ID = 6565594143;

const app = express();
const bot = new Telegraf(TELEGRAM_TOKEN);

// خدمة الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 💰 حالة المستخدمين
const users = {};

function initUser(userId) {
    if (!users[userId]) {
        users[userId] = {
            balance: 1000,
            totalWins: 0,
            totalLosses: 0,
            gamesPlayed: 0,
            currentGame: null
        };
    }
    return users[userId];
}

// 🌐 جميع الطلبات ترجع صفحة الويب
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 📊 API للحصول على بيانات المستخدم
app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    const user = initUser(userId);
    res.json(user);
});

// 💰 API لتحديث الرصيد
app.post('/api/update-balance', (req, res) => {
    const { userId, amount, type } = req.body;
    const user = initUser(userId);
    
    if (type === 'win') {
        user.balance += amount;
        user.totalWins += amount;
    } else if (type === 'bet') {
        user.balance -= amount;
        user.gamesPlayed += 1;
    } else if (type === 'loss') {
        user.totalLosses += amount;
    } else if (type === 'deposit') {
        user.balance += amount;
    }
    
    res.json({ success: true, balance: user.balance });
});

// 🎮 API لتحديث اللعبة الحالية
app.post('/api/set-game', (req, res) => {
    const { userId, game } = req.body;
    const user = initUser(userId);
    user.currentGame = game;
    res.json({ success: true });
});

// 🎯 أمر START مع زر الويب أب
bot.start(async (ctx) => {
    const user = initUser(ctx.from.id);
    
    // إنشاء زر الويب أب
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.webApp(
            '🎮 دخول القاعة الرئيسية', 
            `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:3000'}`
        )]
    ]);

    await ctx.replyWithHTML(
        `🏦 <b>مرحباً بك في منصة الألعاب!</b>\n\n` +
        `💰 <b>رصيدك:</b> ${user.balance}$\n\n` +
        `🎯 <b>الألعاب المتاحة:</b>\n` +
        `• ✈️ لعبة CRASH - الطائرة الحمراء\n` +
        `• 🎰 لعبة SLOTS - ماكينات القمار\n` +
        `• 🎲 لعبة DICE - النرد\n` +
        `• ♠️ لعبة ROULETTE - الروليت\n\n` +
        `🚀 <b>اضغط الزر أدناه لبدء اللعب:</b>`,
        keyboard
    );
});

// 💰 أمر الإيداع
bot.command('deposit', async (ctx) => {
    const user = initUser(ctx.from.id);
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.webApp(
            '💳 الإيداع الآن', 
            `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:3000'}/deposit`
        )]
    ]);

    await ctx.replyWithHTML(
        `💳 <b>نظام الإيداع</b>\n\n` +
        `💰 <b>رصيدك الحالي:</b> ${user.balance}$\n\n` +
        `📥 <b>طرق الإيداع:</b>\n` +
        `• 💳 بطاقة ائتمان\n` +
        `• 📲 محفظة إلكترونية\n` +
        `• 🏦 تحويل بنكي\n\n` +
        `⚡ <b>الإيداع فوري وآمن</b>`,
        keyboard
    );
});

// تشغيل البوت والسيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على PORT: ${PORT}`);
    console.log(`🔗 رابط الويب: https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:' + PORT}`);
});

bot.launch().then(() => {
    console.log('✅ نظام الألعاب يعمل بنجاح!');
}).catch(err => {
    console.error('❌ خطأ في تشغيل البوت:', err);
});
