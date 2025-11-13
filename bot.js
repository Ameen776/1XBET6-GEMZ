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
            gamesPlayed: 0
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
    }
    
    res.json({ success: true, balance: user.balance });
});

// 🎯 أمر START مع زر الويب أب
bot.start(async (ctx) => {
    const user = initUser(ctx.from.id);
    
    // إنشاء زر الويب أب
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.webApp(
            '🎮 ابدأ لعبة CRASH', 
            `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:3000'}`
        )]
    ]);

    await ctx.replyWithHTML(
        `🎮 <b>مرحباً بك في لعبة CRASH!</b>\n\n` +
        `💰 <b>رصيدك:</b> ${user.balance}$\n\n` +
        `✈️ <b>لعبة الطائرة المتجهة نحو الجبل!</b>\n\n` +
        `🎯 <b>كيفية اللعب:</b>\n` +
        `• اضغط على الزر لفتح اللعبة\n` +
        `• شاهد الطائرة ترتفع والمضاعف يزيد\n` +
        `• اضغط سحب لسحب أموالك\n` +
        `• إذا انفجرت الطائرة تخسر الرهان!\n\n` +
        `🚀 <b>اضغط الزر أدناه لبدء المغامرة:</b>`,
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
    console.log('✅ بوت لعبة CRASH يعمل بنجاح!');
}).catch(err => {
    console.error('❌ خطأ في تشغيل البوت:', err);
});
