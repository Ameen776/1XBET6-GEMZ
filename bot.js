// bot.js - بوت الألعاب الكامل بـ JavaScript
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const axios = require('axios');

// التوكن والآيدي
const TELEGRAM_TOKEN = "8020165788:AAHyM7nKtS9eovxiPkHh0SP84eXnyrBLmus";
const ADMIN_CHAT_ID = 6565594143;

const app = express();
const bot = new Telegraf(TELEGRAM_TOKEN);

// حالة المستخدمين
const users = {};
const games = {};

// تهيئة المستخدم
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

// ↴ ↳ ↲ ↱ ↰ ↴
// 🎮 لعبة CRASH
class CrashGame {
    constructor(userId, bet) {
        this.userId = userId;
        this.bet = bet;
        this.multiplier = 1.0;
        this.crashed = false;
        this.crashPoint = (Math.random() * 8 + 1.5).toFixed(2);
        this.startTime = Date.now();
    }

    update() {
        if (this.crashed) return false;
        
        const elapsed = (Date.now() - this.startTime) / 1000;
        this.multiplier = (1 + (elapsed * 0.1)).toFixed(2);
        
        if (this.multiplier >= this.crashPoint) {
            this.crashed = true;
            return false;
        }
        return true;
    }

    cashOut() {
        if (this.crashed) return 0;
        const winAmount = (this.bet * this.multiplier).toFixed(2);
        return parseFloat(winAmount);
    }
}

// 🎰 لعبة SLOT
function playSlots(bet) {
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

    const winAmount = bet * winMultiplier;
    return { reels, winAmount, winMultiplier };
}

// 🎲 لعبة النرد
function playDice(bet, prediction) {
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;

    let winAmount = 0;
    if (prediction === 'high' && total > 7) winAmount = bet * 2;
    else if (prediction === 'low' && total < 7) winAmount = bet * 2;
    else if (prediction === '7' && total === 7) winAmount = bet * 4;

    return { dice1, dice2, total, winAmount };
}

// ♠️♥️♦️♣️ لعبة الروليت
function playRoulette(bet, betType, number = null) {
    const numberResult = Math.floor(Math.random() * 37);
    const colorResult = numberResult === 0 ? 'green' : (numberResult % 2 === 0 ? 'red' : 'black');

    let winAmount = 0;
    
    switch(betType) {
        case 'red':
            if (colorResult === 'red') winAmount = bet * 2;
            break;
        case 'black':
            if (colorResult === 'black') winAmount = bet * 2;
            break;
        case 'number':
            if (number === numberResult) winAmount = bet * 36;
            break;
        case 'even':
            if (numberResult !== 0 && numberResult % 2 === 0) winAmount = bet * 2;
            break;
        case 'odd':
            if (numberResult % 2 === 1) winAmount = bet * 2;
            break;
    }

    return { numberResult, colorResult, winAmount };
}

// 🎯 أوامر البوت
bot.start(async (ctx) => {
    const user = initUser(ctx.from.id);
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎮 لعبة Crash', 'game_crash')],
        [Markup.button.callback('🎰 Slot Machines', 'game_slots')],
        [Markup.button.callback('🎲 النرد', 'game_dice')],
        [Markup.button.callback('♠️ الروليت', 'game_roulette')],
        [Markup.button.callback('💰 رصيدي', 'balance'), Markup.button.callback('📊 إحصائيات', 'stats')]
    ]);

    await ctx.replyWithHTML(
        `🎉 <b>مرحباً ${ctx.from.first_name}!</b>\n\n` +
        `💰 <b>رصيدك:</b> ${user.balance} $\n\n` +
        `🎮 <b>اختر لعبة:</b>`,
        keyboard
    );
});

bot.action('balance', async (ctx) => {
    const user = initUser(ctx.from.id);
    await ctx.editMessageText(
        `💼 <b>رصيدك</b>\n\n` +
        `💰 <b>${user.balance} $</b>\n\n` +
        `🎮 العب واستمتع!`,
        { parse_mode: 'HTML' }
    );
});

bot.action('stats', async (ctx) => {
    const user = initUser(ctx.from.id);
    await ctx.editMessageText(
        `📊 <b>إحصائياتك</b>\n\n` +
        `🎮 <b>الألعاب الملعوبة:</b> ${user.gamesPlayed}\n` +
        `🏆 <b>الفوز الكلي:</b> ${user.totalWins} $\n` +
        `💰 <b>الرصيد الحالي:</b> ${user.balance} $`,
        { parse_mode: 'HTML' }
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
        `• شاهد الطائرة ترتفع\n` +
        `• اسحب أموالك قبل الانفجار\n` +
        `• كلما ارتفعت الطائرة زاد الربح!\n\n` +
        `⚠️ <b>تحذير:</b> إذا انفجرت الطائرة قبل السحب تخسر الرهان!`,
        { parse_mode: 'HTML', ...keyboard }
    );
});

bot.action(/crash_bet_(\d+)/, async (ctx) => {
    const betAmount = parseInt(ctx.match[1]);
    const user = initUser(ctx.from.id);
    
    if (user.balance < betAmount) {
        await ctx.answerCbQuery('❌ رصيد غير كافي!');
        return;
    }

    user.balance -= betAmount;
    user.gamesPlayed++;
    
    const game = new CrashGame(ctx.from.id, betAmount);
    games[ctx.from.id] = game;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🛬 سحب الأموال', 'crash_cashout')],
        [Markup.button.callback('🔄 تحديث', 'crash_update')]
    ]);

    let message = `✈️ <b>الطائرة تقلع...</b>\n\n`;
    message += `🎯 <b>الرهان:</b> ${betAmount} $\n`;
    message += `📈 <b>المضاعف:</b> ${game.multiplier}x\n`;
    message += `💰 <b>الربح المحتمل:</b> ${(betAmount * game.multiplier).toFixed(2)} $\n\n`;
    message += `🛬 <b>اضغط سحب الأموال قبل الانفجار!</b>`;

    await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard });
    startCrashUpdates(ctx, game);
});

function startCrashUpdates(ctx, game) {
    const interval = setInterval(async () => {
        if (!game.update()) {
            clearInterval(interval);
            const user = initUser(game.userId);
            
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('🎮 العب مجدداً', 'game_crash')],
                [Markup.button.callback('↩️ القائمة', 'menu')]
            ]);

            await ctx.editMessageText(
                `💥 <b>انفجرت الطائرة!</b>\n\n` +
                `📈 <b>وصلت إلى:</b> ${game.multiplier}x\n` +
                `🎯 <b>الرهان:</b> ${game.bet} $\n` +
                `💰 <b>الخسارة:</b> ${game.bet} $\n\n` +
                `😔 حاول مجدداً!`,
                { parse_mode: 'HTML', ...keyboard }
            );
        }
    }, 1000);
}

bot.action('crash_cashout', async (ctx) => {
    const game = games[ctx.from.id];
    if (!game) {
        await ctx.answerCbQuery('❌ لا يوجد لعبة نشطة!');
        return;
    }

    const winAmount = game.cashOut();
    const user = initUser(ctx.from.id);
    user.balance += winAmount;
    user.totalWins += winAmount;
    
    delete games[ctx.from.id];

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎮 العب مجدداً', 'game_crash')],
        [Markup.button.callback('↩️ القائمة', 'menu')]
    ]);

    await ctx.editMessageText(
        `🎉 <b>مبروك! نجحت في السحب</b>\n\n` +
        `📈 <b>المضاعف:</b> ${game.multiplier}x\n` +
        `🎯 <b>الرهان:</b> ${game.bet} $\n` +
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

bot.action(/slots_bet_(\d+)/, async (ctx) => {
    const betAmount = parseInt(ctx.match[1]);
    const user = initUser(ctx.from.id);
    
    if (user.balance < betAmount) {
        await ctx.answerCbQuery('❌ رصيد غير كافي!');
        return;
    }

    user.balance -= betAmount;
    user.gamesPlayed++;
    
    const result = playSlots(betAmount);
    user.balance += result.winAmount;
    if (result.winAmount > 0) user.totalWins += result.winAmount;

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

// 🎲 لعبة النرد
bot.action('game_dice', async (ctx) => {
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('⬆️ عالي (>7)', 'dice_high')],
        [Markup.button.callback('⬇️ منخفض (<7)', 'dice_low')],
        [Markup.button.callback('🎯 الرقم 7', 'dice_7')],
        [Markup.button.callback('↩️ رجوع', 'menu')]
    ]);

    await ctx.editMessageText(
        `🎲 <b>لعبة النرد</b>\n\n` +
        `🎯 <b>كيفية اللعب:</b>\n` +
        `• اختر توقعك لمجموع النردين\n` +
        `• عالي (>7) = ربح 2x\n` +
        `• منخفض (<7) = ربح 2x\n` +
        `• الرقم 7 = ربح 4x\n\n` +
        `🎲 الرهان: 50 $`,
        { parse_mode: 'HTML', ...keyboard }
    );
});

bot.action(/dice_(high|low|7)/, async (ctx) => {
    const prediction = ctx.match[1];
    const betAmount = 50;
    const user = initUser(ctx.from.id);
    
    if (user.balance < betAmount) {
        await ctx.answerCbQuery('❌ رصيد غير كافي!');
        return;
    }

    user.balance -= betAmount;
    user.gamesPlayed++;
    
    const result = playDice(betAmount, prediction);
    user.balance += result.winAmount;
    if (result.winAmount > 0) user.totalWins += result.winAmount;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎲 العب مجدداً', 'game_dice')],
        [Markup.button.callback('↩️ القائمة', 'menu')]
    ]);

    let predictionText = '';
    switch(prediction) {
        case 'high': predictionText = 'عالي (>7)'; break;
        case 'low': predictionText = 'منخفض (<7)'; break;
        case '7': predictionText = 'الرقم 7'; break;
    }

    let message = `🎲 <b>${result.dice1} + ${result.dice2} = ${result.total}</b>\n\n`;
    message += `🎯 <b>توقعك:</b> ${predictionText}\n`;
    message += `💰 <b>الرهان:</b> ${betAmount} $\n`;
    
    if (result.winAmount > 0) {
        message += `🎉 <b>فزت!</b>\n`;
        message += `💰 <b>الربح:</b> ${result.winAmount} $\n`;
    } else {
        message += `😔 <b>لم تربح هذه المرة</b>\n`;
    }
    
    message += `💼 <b>الرصيد:</b> ${user.balance} $`;

    await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard });
});

// ♠️ لعبة الروليت
bot.action('game_roulette', async (ctx) => {
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔴 أحمر', 'roulette_red'), Markup.button.callback('⚫ أسود', 'roulette_black')],
        [Markup.button.callback('⚪ زوجي', 'roulette_even'), Markup.button.callback('⚫ فردي', 'roulette_odd')],
        [Markup.button.callback('🎯 رقم', 'roulette_number')],
        [Markup.button.callback('↩️ رجوع', 'menu')]
    ]);

    await ctx.editMessageText(
        `♠️ <b>لعبة الروليت</b>\n\n` +
        `🎯 <b>كيفية اللعب:</b>\n` +
        `• اختر نوع الرهان\n` +
        `• أحمر/أسود = ربح 2x\n` +
        `• زوجي/فردي = ربح 2x\n` +
        `• رقم محدد = ربح 36x\n\n` +
        `🎲 الرهان: 25 $`,
        { parse_mode: 'HTML', ...keyboard }
    );
});

bot.action(/roulette_(red|black|even|odd)/, async (ctx) => {
    const betType = ctx.match[1];
    const betAmount = 25;
    const user = initUser(ctx.from.id);
    
    if (user.balance < betAmount) {
        await ctx.answerCbQuery('❌ رصيد غير كافي!');
        return;
    }

    user.balance -= betAmount;
    user.gamesPlayed++;
    
    const result = playRoulette(betAmount, betType);
    user.balance += result.winAmount;
    if (result.winAmount > 0) user.totalWins += result.winAmount;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('♠️ العب مجدداً', 'game_roulette')],
        [Markup.button.callback('↩️ القائمة', 'menu')]
    ]);

    let betTypeText = '';
    switch(betType) {
        case 'red': betTypeText = '🔴 أحمر'; break;
        case 'black': betTypeText = '⚫ أسود'; break;
        case 'even': betTypeText = '⚪ زوجي'; break;
        case 'odd': betTypeText = '⚫ فردي'; break;
    }

    let message = `🎲 <b>النتيجة: ${result.numberResult} ${result.colorResult === 'red' ? '🔴' : result.colorResult === 'black' ? '⚫' : '🟢'}</b>\n\n`;
    message += `🎯 <b>رهانك:</b> ${betTypeText}\n`;
    message += `💰 <b>المبلغ:</b> ${betAmount} $\n`;
    
    if (result.winAmount > 0) {
        message += `🎉 <b>فزت!</b>\n`;
        message += `💰 <b>الربح:</b> ${result.winAmount} $\n`;
    } else {
        message += `😔 <b>لم تربح هذه المرة</b>\n`;
    }
    
    message += `💼 <b>الرصيد:</b> ${user.balance} $`;

    await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard });
});

// ↩️ العودة للقائمة
bot.action('menu', async (ctx) => {
    const user = initUser(ctx.from.id);
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎮 لعبة Crash', 'game_crash')],
        [Markup.button.callback('🎰 Slot Machines', 'game_slots')],
        [Markup.button.callback('🎲 النرد', 'game_dice')],
        [Markup.button.callback('♠️ الروليت', 'game_roulette')],
        [Markup.button.callback('💰 رصيدي', 'balance'), Markup.button.callback('📊 إحصائيات', 'stats')]
    ]);

    await ctx.editMessageText(
        `🎮 <b>القائمة الرئيسية</b>\n\n` +
        `💰 <b>رصيدك:</b> ${user.balance} $\n\n` +
        `اختر لعبة:`,
        { parse_mode: 'HTML', ...keyboard }
    );
});

// تشغيل البوت
bot.launch().then(() => {
    console.log('🎮 بوت الألعاب يعمل!');
}).catch(err => {
    console.error('❌ خطأ في تشغيل البوت:', err);
});

// إعداد السيرفر
app.get('/', (req, res) => {
    res.send('🎮 بوت الألعاب يعمل!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على port ${PORT}`);
});