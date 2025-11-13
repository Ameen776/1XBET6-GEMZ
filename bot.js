// bot.js - بوت الألعاب الكامل والمصحح
const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// التوكن والآيدي
const TELEGRAM_TOKEN = "8020165788:AAHyM7nKtS9eovxiPkHh0SP84eXnyrBLmus";
const ADMIN_CHAT_ID = 6565594143;

const app = express();
const bot = new Telegraf(TELEGRAM_TOKEN);

// حالة المستخدمين والألعاب
const users = {};
const activeGames = {};

// تهيئة المستخدم
function initUser(userId) {
    if (!users[userId]) {
        users[userId] = {
            balance: 1000,
            gamesPlayed: 0,
            totalWins: 0,
            totalLosses: 0
        };
    }
    return users[userId];
}

// 🎮 لعبة CRASH
class CrashGame {
    constructor(userId, betAmount) {
        this.userId = userId;
        this.betAmount = betAmount;
        this.multiplier = 1.0;
        this.isActive = true;
        this.crashPoint = (Math.random() * 8 + 1.5).toFixed(2);
        this.startTime = Date.now();
    }

    update() {
        if (!this.isActive) return false;
        
        const timeElapsed = (Date.now() - this.startTime) / 1000;
        this.multiplier = (1 + (timeElapsed * 0.1)).toFixed(2);
        
        if (parseFloat(this.multiplier) >= parseFloat(this.crashPoint)) {
            this.isActive = false;
            return false;
        }
        return true;
    }

    cashOut() {
        if (!this.isActive) return 0;
        this.isActive = false;
        const winAmount = (this.betAmount * this.multiplier).toFixed(2);
        return parseFloat(winAmount);
    }
}

// 🎰 لعبة SLOT
function playSlot(betAmount) {
    const symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
    const reels = [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
    ];

    let winMultiplier = 0;
    
    // حساب الربح
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
        if (reels[0] === '💎') winMultiplier = 10;
        else if (reels[0] === '7️⃣') winMultiplier = 5;
        else if (reels[0] === '🔔') winMultiplier = 3;
        else winMultiplier = 2;
    } else if (reels[0] === reels[1] || reels[1] === reels[2]) {
        winMultiplier = 1;
    }

    const winAmount = betAmount * winMultiplier;
    return { reels, winAmount, winMultiplier };
}

// 🎯 أمر START
bot.start(async (ctx) => {
    const user = initUser(ctx.from.id);
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎮 لعبة Crash', 'game_crash')],
        [Markup.button.callback('🎰 Slot Machines', 'game_slots')],
        [Markup.button.callback('💰 رصيدي', 'balance'), Markup.button.callback('📊 إحصائيات', 'stats')]
    ]);

    await ctx.replyWithHTML(
        `🎉 <b>مرحباً ${ctx.from.first_name}!</b>\n\n` +
        `💰 <b>رصيدك:</b> ${user.balance} $\n\n` +
        `🎮 <b>اختر لعبة للبدء:</b>`,
        keyboard
    );
});

// 💰 عرض الرصيد
bot.action('balance', async (ctx) => {
    const user = initUser(ctx.from.id);
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎮 العب الآن', 'menu')],
        [Markup.button.callback('📊 إحصائيات', 'stats')]
    ]);

    await ctx.editMessageText(
        `💼 <b>رصيدك</b>\n\n` +
        `💰 <b>${user.balance} $</b>\n\n` +
        `استمر في اللعب لزيادة رصيدك! 🎯`,
        { parse_mode: 'HTML', ...keyboard }
    );
});

// 📊 الإحصائيات
bot.action('stats', async (ctx) => {
    const user = initUser(ctx.from.id);
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎮 العب الآن', 'menu')],
        [Markup.button.callback('💰 رصيدي', 'balance')]
    ]);

    await ctx.editMessageText(
        `📊 <b>إحصائياتك</b>\n\n` +
        `🎮 <b>الألعاب الملعوبة:</b> ${user.gamesPlayed}\n` +
        `🏆 <b>الفوز الكلي:</b> ${user.totalWins} $\n` +
        `💸 <b>الخسارة الكلية:</b> ${user.totalLosses} $\n` +
        `💰 <b>الرصيد الحالي:</b> ${user.balance} $\n\n` +
        `📈 <b>صافي الربح:</b> ${(user.totalWins - user.totalLosses).toFixed(2)} $`,
        { parse_mode: 'HTML', ...keyboard }
    );
});

// ↩️ القائمة الرئيسية
bot.action('menu', async (ctx) => {
    const user = initUser(ctx.from.id);
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎮 لعبة Crash', 'game_crash')],
        [Markup.button.callback('🎰 Slot Machines', 'game_slots')],
        [Markup.button.callback('💰 رصيدي', 'balance'), Markup.button.callback('📊 إحصائيات', 'stats')]
    ]);

    await ctx.editMessageText(
        `🎮 <b>القائمة الرئيسية</b>\n\n` +
        `💰 <b>رصيدك:</b> ${user.balance} $\n\n` +
        `اختر لعبة:`,
        { parse_mode: 'HTML', ...keyboard }
    );
});

// 🎮 لعبة CRASH
bot.action('game_crash', async (ctx) => {
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎯 رهان 10$', 'crash_bet_10')],
        [Markup.button.callback('🎯 رهان 50$', 'crash_bet_50')],
        [Markup.button.callback('🎯 رهان 100$', 'crash_bet_100')],
        [Markup.button.callback('↩️ رجوع', 'menu')]
    ]);

    await ctx.editMessageText(
        `✈️ <b>لعبة CRASH</b>\n\n` +
        `🎯 <b>كيفية اللعب:</b>\n` +
        `• اختر مبلغ الرهان\n` +
        `• شاهد الطائرة ترتفع والمضاعف يزيد\n` +
        `• اسحب أموالك قبل الانفجار\n` +
        `• كلما ارتفعت الطائرة زاد الربح!\n\n` +
        `⚠️ <b>تحذير:</b> إذا انفجرت الطائرة قبل السحب تخسر الرهان!`,
        { parse_mode: 'HTML', ...keyboard }
    );
});

// 🎯 وضع الرهان في CRASH
bot.action(/crash_bet_(\d+)/, async (ctx) => {
    const betAmount = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    const user = initUser(userId);
    
    if (user.balance < betAmount) {
        await ctx.answerCbQuery('❌ رصيد غير كافي!');
        return;
    }

    // خصم الرهان
    user.balance -= betAmount;
    user.gamesPlayed++;
    
    // إنشاء لعبة جديدة
    const game = new CrashGame(userId, betAmount);
    activeGames[userId] = game;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🛬 سحب الأموال', 'crash_cashout')],
        [Markup.button.callback('🔄 تحديث', 'crash_update')],
        [Markup.button.callback('↩️ رجوع', 'menu')]
    ]);

    let message = `✈️ <b>الطائرة تقلع...</b>\n\n`;
    message += `🎯 <b>الرهان:</b> ${betAmount} $\n`;
    message += `📈 <b>المضاعف:</b> ${game.multiplier}x\n`;
    message += `💰 <b>الربح المحتمل:</b> ${(betAmount * game.multiplier).toFixed(2)} $\n\n`;
    message += `🛬 <b>اضغط سحب الأموال قبل الانفجار!</b>`;

    await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard });
    
    // بدأ تحديث اللعبة
    startGameInterval(ctx, game);
});

// 🔄 تحديث لعبة CRASH
function startGameInterval(ctx, game) {
    const interval = setInterval(async () => {
        if (!game.update()) {
            clearInterval(interval);
            
            const user = initUser(game.userId);
            user.totalLosses += game.betAmount;
            
            delete activeGames[game.userId];

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('🎮 العب مجدداً', 'game_crash')],
                [Markup.button.callback('↩️ القائمة', 'menu')]
            ]);

            await ctx.editMessageText(
                `💥 <b>انفجرت الطائرة!</b>\n\n` +
                `📈 <b>وصلت إلى:</b> ${game.multiplier}x\n` +
                `🎯 <b>الرهان:</b> ${game.betAmount} $\n` +
                `💰 <b>الخسارة:</b> ${game.betAmount} $\n\n` +
                `😔 حاول مجدداً!`,
                { parse_mode: 'HTML', ...keyboard }
            );
        }
    }, 1000);
}

// 🛬 سحب الأموال من CRASH
bot.action('crash_cashout', async (ctx) => {
    const userId = ctx.from.id;
    const game = activeGames[userId];
    
    if (!game) {
        await ctx.answerCbQuery('❌ لا يوجد لعبة نشطة!');
        return;
    }

    const winAmount = game.cashOut();
    const user = initUser(userId);
    user.balance += winAmount;
    user.totalWins += winAmount;
    
    delete activeGames[userId];

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎮 العب مجدداً', 'game_crash')],
        [Markup.button.callback('↩️ القائمة', 'menu')]
    ]);

    await ctx.editMessageText(
        `🎉 <b>مبروك! نجحت في السحب</b>\n\n` +
        `📈 <b>المضاعف:</b> ${game.multiplier}x\n` +
        `🎯 <b>الرهان:</b> ${game.betAmount} $\n` +
        `💰 <b>الربح:</b> ${winAmount} $\n` +
        `💼 <b>الرصيد الجديد:</b> ${user.balance} $`,
        { parse_mode: 'HTML', ...keyboard }
    );
});

// 🎰 لعبة SLOT
bot.action('game_slots', async (ctx) => {
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎰 رهان 20$', 'slots_bet_20')],
        [Markup.button.callback('🎰 رهان 50$', 'slots_bet_50')],
        [Markup.button.callback('🎰 رهان 100$', 'slots_bet_100')],
        [Markup.button.callback('↩️ رجوع', 'menu')]
    ]);

    await ctx.editMessageText(
        `🎰 <b>Slot Machines</b>\n\n` +
        `🎯 <b>كيفية اللعب:</b>\n` +
        `• اختر مبلغ الرهان\n` +
        `• اضغط لتدوير المحارف\n` +
        `• إذا تطابقت 3 رموز تربح!\n\n` +
        `💎 <b>المضاعفات:</b>\n` +
        `• 💎💎💎 = 10x\n` +
        `• 7️⃣7️⃣7️⃣ = 5x\n` +
        `• 🔔🔔🔔 = 3x\n` +
        `• أي 3 متطابقة = 2x\n` +
        `• 2 متطابقة = 1x`,
        { parse_mode: 'HTML', ...keyboard }
    );
});

// 🎰 وضع الرهان في SLOT
bot.action(/slots_bet_(\d+)/, async (ctx) => {
    const betAmount = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    const user = initUser(userId);
    
    if (user.balance < betAmount) {
        await ctx.answerCbQuery('❌ رصيد غير كافي!');
        return;
    }

    user.balance -= betAmount;
    user.gamesPlayed++;
    
    const result = playSlot(betAmount);
    user.balance += result.winAmount;
    
    if (result.winAmount > 0) {
        user.totalWins += result.winAmount;
    } else {
        user.totalLosses += betAmount;
    }

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎰 العب مجدداً', 'game_slots')],
        [Markup.button.callback('↩️ القائمة', 'menu')]
    ]);

    let message = `🎰 <b>${result.reels.join(' ')}</b>\n\n`;
    message += `🎯 <b>الرهان:</b> ${betAmount} $\n`;
    
    if (result.winAmount > 0) {
        message += `🎉 <b>فزت!</b>\n`;
        message += `💰 <b>الربح:</b> ${result.winAmount} $\n`;
        message += `📈 <b>المضاعف:</b> ${result.winMultiplier}x\n`;
    } else {
        message += `😔 <b>لم تربح هذه المرة</b>\n`;
    }
    
    message += `💼 <b>الرصيد:</b> ${user.balance} $`;

    await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard });
});

// 🔄 تحديث لعبة CRASH يدوياً
bot.action('crash_update', async (ctx) => {
    const game = activeGames[ctx.from.id];
    if (!game) {
        await ctx.answerCbQuery('❌ لا يوجد لعبة نشطة!');
        return;
    }

    const currentMultiplier = game.multiplier;
    await ctx.answerCbQuery(`📈 المضاعف الحالي: ${currentMultiplier}x`);
});

// 🏓 أمر PING للتحقق من عمل البوت
bot.command('ping', (ctx) => {
    ctx.reply('🏓 البوت يعمل! ✅');
});

// ℹ️ أمر HELP
bot.command('help', (ctx) => {
    ctx.replyWithHTML(
        `ℹ️ <b>أوامر البوت:</b>\n\n` +
        `<code>/start</code> - بدء البوت\n` +
        `<code>/ping</code> - التحقق من عمل البوت\n` +
        `<code>/help</code> - المساعدة\n\n` +
        `🎮 <b>الألعاب المتاحة:</b>\n` +
        `• 🎯 Crash - لعبة الطائرة\n` +
        `• 🎰 Slot - ماكينات القمار\n\n` +
        `💰 <b>كل لاعب يبدأ بـ 1000$</b>`
    );
});

// معالجة الأخطاء
bot.catch((err, ctx) => {
    console.error(`❌ خطأ في البوت:`, err);
    ctx.reply('❌ حدث خطأ غير متوقع!');
});

// تشغيل البوت
bot.launch().then(() => {
    console.log('✅ بوت الألعاب يعمل بنجاح!');
    console.log('🤖 البوت: @' + bot.context.botInfo.username);
}).catch(err => {
    console.error('❌ فشل تشغيل البوت:', err);
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
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white; 
                    text-align: center; 
                    padding: 50px;
                }
                .container {
                    background: rgba(255,255,255,0.1);
                    padding: 30px;
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                }
                h1 { font-size: 2.5em; margin-bottom: 20px; }
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
                <p>🎯 الألعاب المتاحة: Crash, Slot Machines</p>
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

// معالجة إيقاف التطبيق
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
