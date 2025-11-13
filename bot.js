const { Telegraf, Markup } = require('telegraf');
const express = require('express');

const TELEGRAM_TOKEN = "8020165788:AAHyM7nKtS9eovxiPkHh0SP84eXnyrBLmus";
const ADMIN_CHAT_ID = 6565594143;

const app = express();
const bot = new Telegraf(TELEGRAM_TOKEN);

// حالة المستخدمين
const users = {};

function initUser(userId) {
    if (!users[userId]) {
        users[userId] = {
            balance: 1000,
            gamesPlayed: 0,
            totalWins: 0
        };
    }
    return users[userId];
}

// 🎯 كيبورد القائمة الرئيسية
function mainKeyboard() {
    return Markup.keyboard([
        ['🎮 لعبة CRASH', '💰 رصيدي'],
        ['📊 إحصائياتي', '❓ المساعدة']
    ]).resize();
}

// 🎮 كيبورد لعبة CRASH
function crashKeyboard() {
    return Markup.keyboard([
        ['🎯 رهان 10$', '🎯 رهان 50$'],
        ['🎯 رهان 100$', '↩️ القائمة الرئيسية']
    ]).resize();
}

// 🎯 كيبورد أثناء اللعبة
function gameKeyboard() {
    return Markup.keyboard([
        ['🛬 سحب الأموال', '🔄 تحديث'],
        ['↩️ الخروج من اللعبة']
    ]).resize();
}

// 🏁 أمر START
bot.start(async (ctx) => {
    const user = initUser(ctx.from.id);
    
    await ctx.replyWithHTML(
        `🎉 <b>مرحباً ${ctx.from.first_name}!</b>\n\n` +
        `💰 <b>رصيدك:</b> ${user.balance} $\n\n` +
        `🎮 <b>اختر لعبة من الكيبورد:</b>`,
        mainKeyboard()
    );
});

// 🎮 لعبة CRASH
bot.hears('🎮 لعبة CRASH', async (ctx) => {
    await ctx.replyWithHTML(
        `✈️ <b>لعبة CRASH</b>\n\n` +
        `🎯 <b>كيفية اللعب:</b>\n` +
        `• اختر مبلغ الرهان من الأسفل\n` +
        `• شاهد الطائرة ترتفع والمضاعف يزيد\n` +
        `• اسحب أموالك قبل الانفجار\n` +
        `• كلما ارتفعت الطائرة زاد الربح!\n\n` +
        `⚠️ <b>تحذير:</b> إذا انفجرت الطائرة قبل السحب تخسر الرهان!`,
        crashKeyboard()
    );
});

// 💰 الرصيد
bot.hears('💰 رصيدي', async (ctx) => {
    const user = initUser(ctx.from.id);
    await ctx.replyWithHTML(
        `💼 <b>رصيدك</b>\n\n` +
        `💰 <b>${user.balance} $</b>\n\n` +
        `استمر في اللعب لزيادة رصيدك! 🎯`,
        mainKeyboard()
    );
});

// 📊 الإحصائيات
bot.hears('📊 إحصائياتي', async (ctx) => {
    const user = initUser(ctx.from.id);
    await ctx.replyWithHTML(
        `📊 <b>إحصائياتك</b>\n\n` +
        `🎮 <b>الألعاب الملعوبة:</b> ${user.gamesPlayed}\n` +
        `🏆 <b>الفوز الكلي:</b> ${user.totalWins} $\n` +
        `💰 <b>الرصيد الحالي:</b> ${user.balance} $`,
        mainKeyboard()
    );
});

// ❓ المساعدة
bot.hears('❓ المساعدة', async (ctx) => {
    await ctx.replyWithHTML(
        `❓ <b>كيفية اللعب</b>\n\n` +
        `🎮 <b>لعبة CRASH:</b>\n` +
        `• اختر مبلغ الرهان\n` +
        `• شاهد الطائرة ترتفع\n` +
        `• اسحب أموالك قبل الانفجار\n` +
        `• كلما ارتفعت زاد الربح!\n\n` +
        `⚠️ إذا انفجرت الطائرة قبل السحب تخسر الرهان!\n\n` +
        `💰 <b>كل لاعب يبدأ بـ 1000$</b>`,
        mainKeyboard()
    );
});

// ↩️ العودة للقائمة
bot.hears('↩️ القائمة الرئيسية', async (ctx) => {
    const user = initUser(ctx.from.id);
    await ctx.replyWithHTML(
        `🎮 <b>القائمة الرئيسية</b>\n\n` +
        `💰 <b>رصيدك:</b> ${user.balance} $\n\n` +
        `اختر من الخيارات:`,
        mainKeyboard()
    );
});

// 🎯 الرهان في CRASH
bot.hears(['🎯 رهان 10$', '🎯 رهان 50$', '🎯 رهان 100$'], async (ctx) => {
    const betText = ctx.message.text;
    let betAmount;
    
    if (betText.includes('10$')) betAmount = 10;
    else if (betText.includes('50$')) betAmount = 50;
    else if (betText.includes('100$')) betAmount = 100;
    else return;
    
    const user = initUser(ctx.from.id);
    
    if (user.balance < betAmount) {
        await ctx.reply('❌ رصيد غير كافي!', mainKeyboard());
        return;
    }

    user.balance -= betAmount;
    user.gamesPlayed++;
    
    // محاكاة اللعبة
    const multiplier = (1 + Math.random() * 2).toFixed(2);
    const potentialWin = (betAmount * multiplier).toFixed(2);
    
    await ctx.replyWithHTML(
        `✈️ <b>الطائرة تقلع...</b>\n\n` +
        `🎯 <b>الرهان:</b> ${betAmount} $\n` +
        `📈 <b>المضاعف الحالي:</b> ${multiplier}x\n` +
        `💰 <b>الربح المحتمل:</b> ${potentialWin} $\n\n` +
        `🛬 <b>اضغط "سحب الأموال" لتحقيق ربحك!</b>`,
        gameKeyboard()
    );
});

// 🛬 سحب الأموال
bot.hears('🛬 سحب الأموال', async (ctx) => {
    const user = initUser(ctx.from.id);
    const winAmount = Math.floor(Math.random() * 100) + 50;
    
    user.balance += winAmount;
    user.totalWins += winAmount;
    
    await ctx.replyWithHTML(
        `🎉 <b>مبروك! نجحت في السحب</b>\n\n` +
        `💰 <b>الربح:</b> ${winAmount} $\n` +
        `💼 <b>الرصيد الجديد:</b> ${user.balance} $\n\n` +
        `🎮 استمر في اللعب!`,
        mainKeyboard()
    );
});

// 🔄 تحديث
bot.hears('🔄 تحديث', async (ctx) => {
    const multiplier = (1 + Math.random() * 3).toFixed(2);
    await ctx.reply(
        `📈 المضاعف الحالي: ${multiplier}x\n\n` +
        `🛬 اضغط "سحب الأموال" لتحقيق ربحك!`,
        gameKeyboard()
    );
});

// ↩️ الخروج من اللعبة
bot.hears('↩️ الخروج من اللعبة', async (ctx) => {
    const user = initUser(ctx.from.id);
    await ctx.replyWithHTML(
        `🎮 <b>عدت للقائمة الرئيسية</b>\n\n` +
        `💰 <b>رصيدك:</b> ${user.balance} $`,
        mainKeyboard()
    );
});

// 🏓 أمر PING
bot.command('ping', (ctx) => {
    ctx.reply('🏓 البوت يعمل! ✅', mainKeyboard());
});

// ℹ️ أمر HELP
bot.command('help', (ctx) => {
    ctx.replyWithHTML(
        `ℹ️ <b>أوامر البوت:</b>\n\n` +
        `<code>/start</code> - بدء البوت\n` +
        `<code>/ping</code> - التحقق من عمل البوت\n` +
        `<code>/help</code> - المساعدة\n\n` +
        `🎮 <b>استخدم الكيبورد للعب!</b>`,
        mainKeyboard()
    );
});

// 🔄 إعادة تعيين الكيبورد
bot.command('keyboard', (ctx) => {
    ctx.reply('🔄 تم إعادة تعيين الكيبورد', mainKeyboard());
});

// تشغيل البوت
bot.launch().then(() => {
    console.log('✅ بوت الألعاب يعمل بنجاح!');
}).catch(err => {
    console.error('❌ خطأ في تشغيل البوت:', err);
});

// إعداد السيرفر الويب
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🎮 بوت الألعاب</title>
            <meta charset="utf-8">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    background: #1a1a2e;
                    color: white; 
                    text-align: center; 
                    padding: 50px;
                }
                .container {
                    background: #16213e;
                    padding: 30px;
                    border-radius: 15px;
                    max-width: 500px;
                    margin: 0 auto;
                }
                h1 { color: #4CAF50; }
                .status { 
                    background: #4CAF50; 
                    padding: 10px 20px; 
                    border-radius: 25px; 
                    display: inline-block;
                    margin: 10px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎮 بوت الألعاب</h1>
                <div class="status">✅ البوت يعمل بنجاح</div>
                <p>اذهب إلى تليجرام وابحث عن البوت للبدء في اللعب!</p>
                <p>🎯 استخدم الكيبورد للعب بسهولة</p>
                <p>💰 كل لاعب يبدأ بـ 1000$</p>
            </div>
        </body>
        </html>
    `);
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على PORT: ${PORT}`);
});

// معالجة الأخطاء
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});
