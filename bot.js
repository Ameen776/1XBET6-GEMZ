const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');

const TELEGRAM_TOKEN = "8020165788:AAHyM7nKtS9eovxiPkHh0SP84eXnyrBLmus";
const ADMIN_CHAT_ID = 6565594143;

const app = express();
const bot = new Telegraf(TELEGRAM_TOKEN);

// خدمة الملفات الثابتة
app.use(express.static('public'));

// 🔗 رابط الويب أب - سيتم تعبئته تلقائياً بعد النشر
let WEB_APP_URL = '';

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

// 🎯 أمر START مع زر الويب أب
bot.start(async (ctx) => {
    const user = initUser(ctx.from.id);
    
    // إنشاء زر الويب أب
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.webApp(
            '🎮 ابدأ لعبة CRASH', 
            WEB_APP_URL || 'https://your-app.onrender.com'
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

// 💰 عرض الرصيد
bot.command('balance', async (ctx) => {
    const user = initUser(ctx.from.id);
    await ctx.replyWithHTML(
        `💼 <b>رصيدك</b>\n\n` +
        `💰 <b>${user.balance}$</b>\n\n` +
        `🎮 <b>الألعاب الملعوبة:</b> ${user.gamesPlayed}\n` +
        `🏆 <b>الفوز الكلي:</b> ${user.totalWins}$\n` +
        `💸 <b>الخسارة الكلية:</b> ${user.totalLosses}$`
    );
});

// 🏓 أمر PING
bot.command('ping', (ctx) => {
    ctx.reply('🏓 البوت يعمل! ✅');
});

// 🌐 صفحة الويب الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 📊 API للحصول على بيانات المستخدم
app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    const user = initUser(userId);
    res.json(user);
});

// 💰 API لتحديث الرصيد
app.post('/api/update-balance', express.json(), (req, res) => {
    const { userId, amount, type } = req.body;
    const user = initUser(userId);
    
    if (type === 'win') {
        user.balance += amount;
        user.totalWins += amount;
    } else if (type === 'bet') {
        user.balance -= amount;
        user.gamesPlayed += 1;
    }
    
    res.json({ success: true, balance: user.balance });
});

// تشغيل البوت والسيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على PORT: ${PORT}`);
    WEB_APP_URL = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:' + PORT}`;
    console.log(`🔗 رابط الويب أب: ${WEB_APP_URL}`);
});

bot.launch().then(() => {
    console.log('✅ بوت لعبة CRASH يعمل بنجاح!');
}).catch(err => {
    console.error('❌ خطأ في تشغيل البوت:', err);
});