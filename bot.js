const { Telegraf } = require('telegraf');
const express = require('express');

const TELEGRAM_TOKEN = "8020165788:AAHyM7nKtS9eovxiPkHh0SP84eXnyrBLmus";
const ADMIN_CHAT_ID = 6565594143;

const app = express();
const bot = new Telegraf(TELEGRAM_TOKEN);

// حالة اللعبة
const games = {};
const users = {};

function initUser(userId) {
    if (!users[userId]) {
        users[userId] = {
            balance: 1000,
            totalWins: 0,
            totalLosses: 0
        };
    }
    return users[userId];
}

class CrashGame {
    constructor(userId, betAmount) {
        this.userId = userId;
        this.betAmount = betAmount;
        this.multiplier = 1.0;
        this.isActive = true;
        this.crashPoint = (Math.random() * 8 + 1.5).toFixed(2);
        this.planePosition = 0;
        this.mountainHeight = 5;
        this.exploded = false;
    }

    update() {
        if (!this.isActive || this.exploded) return false;
        
        // زيادة المضاعف
        this.multiplier = (parseFloat(this.multiplier) + 0.05).toFixed(2);
        this.planePosition += 1;
        
        // تحقق من الانفجار
        if (parseFloat(this.multiplier) >= parseFloat(this.crashPoint)) {
            this.exploded = true;
            this.isActive = false;
            return false;
        }
        return true;
    }

    cashOut() {
        if (!this.isActive || this.exploded) return 0;
        this.isActive = false;
        return parseFloat((this.betAmount * this.multiplier).toFixed(2));
    }

    // رسم المشهد
    drawScene() {
        let scene = '';
        
        // السماء والطائرة
        const skyWidth = 30;
        const planePos = Math.min(this.planePosition, skyWidth - 3);
        
        // السماء
        for (let y = 0; y < 3; y++) {
            let line = '';
            for (let x = 0; x < skyWidth; x++) {
                if (y === 1 && x === planePos && !this.exploded) {
                    line += '✈️';
                    x += 1; // لأن الطائرة تأخذ حرفين
                } else if (this.exploded && y === 1 && Math.abs(x - planePos) <= 2) {
                    line += '💥';
                } else {
                    line += y === 0 ? '☁️' : '  ';
                }
            }
            scene += line + '\n';
        }
        
        // الجبال
        scene += this.drawMountains();
        
        // معلومات اللعبة
        scene += `\n📈 المضاعف: ${this.multiplier}x\n`;
        scene += `💰 الرهان: ${this.betAmount}$\n`;
        scene += `🎯 الربح: ${(this.betAmount * this.multiplier).toFixed(2)}$\n`;
        
        if (this.exploded) {
            scene += `\n💥 **انفجرت عند ${this.multiplier}x**\n`;
        } else if (this.multiplier > 3) {
            scene += `\n🚨 **احذر! المضاعف مرتفع**\n`;
        } else if (this.multiplier > 5) {
            scene += `\n⚠️ **خطر! قد تنفجر قريباً**\n`;
        }
        
        return scene;
    }

    drawMountains() {
        let mountains = '';
        const width = 30;
        
        for (let y = 0; y < this.mountainHeight; y++) {
            let line = '';
            for (let x = 0; x < width; x++) {
                const mountainPattern = this.getMountainPattern(x, y);
                line += mountainPattern;
            }
            mountains += line + '\n';
        }
        return mountains;
    }

    getMountainPattern(x, y) {
        const patterns = ['🏔️', '⛰️', '🗻', ' '];
        
        // إنشاء نمط جبال عشوائي ولكن متناسق
        const seed = (x * 7 + y * 3) % 20;
        
        if (y === this.mountainHeight - 1) {
            // قاعدة الجبل
            return patterns[Math.floor(Math.random() * 3)];
        } else if (y >= this.mountainHeight - 2) {
            // منتصف الجبل
            return seed < 15 ? patterns[Math.floor(Math.random() * 3)] : '  ';
        } else {
            // قمة الجبل
            return seed < 8 ? patterns[Math.floor(Math.random() * 2)] : '  ';
        }
    }
}

// 🎯 أمر START
bot.start(async (ctx) => {
    const user = initUser(ctx.from.id);
    
    await ctx.replyWithHTML(
        `🎮 <b>لعبة CRASH - الطائرة المتجهة نحو الجبل!</b>\n\n` +
        `💰 <b>رصيدك:</b> ${user.balance}$\n\n` +
        `✈️ <b>كيفية اللعب:</b>\n` +
        `• ارسل مبلغ الرهان (مثال: 100)\n` +
        `• شاهد الطائرة ترتفع والمضاعف يزيد\n` +
        `• ارسل "سحب" لسحب أموالك\n` +
        `• إذا انفجرت الطائرة تخسر الرهان!\n\n` +
        `🚨 <b>المضاعف يزيد كل ثانية!</b>\n\n` +
        `💸 <b>لبدء اللعبة، ارسل مبلغ الرهان:</b>`
    );
});

// 💰 استقبال الرهان
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const user = initUser(userId);
    
    // تحقق إذا كان الرهان رقم
    const betAmount = parseInt(text);
    if (!isNaN(betAmount) && betAmount > 0) {
        if (games[userId]) {
            await ctx.reply('❌ لديك لعبة نشطة بالفعل!');
            return;
        }
        
        if (user.balance < betAmount) {
            await ctx.reply(`❌ رصيدك غير كافي! رصيدك: ${user.balance}$`);
            return;
        }
        
        // بدأ لعبة جديدة
        user.balance -= betAmount;
        const game = new CrashGame(userId, betAmount);
        games[userId] = game;
        
        // إرسال المشهد الأول
        const scene = game.drawScene();
        const message = await ctx.reply(
            `🎮 <b>بدأت اللعبة!</b>\n\n` +
            `${scene}\n\n` +
            `💸 <b>ارسل "سحب" لسحب أموالك!</b>\n` +
            `⏰ <b>المضاعف يزيد تلقائياً...</b>`,
            { parse_mode: 'HTML' }
        );
        
        // بدأ التحديث التلقائي
        startGameUpdates(ctx, game, message.message_id);
        
    } else if (text.toLowerCase() === 'سحب' || text.toLowerCase() === 'سحب') {
        // سحب الأموال
        const game = games[userId];
        if (!game) {
            await ctx.reply('❌ لا يوجد لعبة نشطة! ارسل رقماً لبدء لعبة جديدة.');
            return;
        }
        
        const winAmount = game.cashOut();
        user.balance += winAmount;
        user.totalWins += winAmount;
        
        delete games[userId];
        
        await ctx.replyWithHTML(
            `🎉 <b>مبروك! سحبت أموالك بنجاح</b>\n\n` +
            `📈 <b>المضاعف:</b> ${game.multiplier}x\n` +
            `💰 <b>الرهان:</b> ${game.betAmount}$\n` +
            `💸 <b>الربح:</b> ${winAmount}$\n` +
            `💼 <b>الرصيد الجديد:</b> ${user.balance}$\n\n` +
            `🎮 <b>للعبة جديدة، ارسل مبلغ الرهان:</b>`
        );
        
    } else if (text === '/balance') {
        await ctx.replyWithHTML(
            `💼 <b>رصيدك:</b> ${user.balance}$\n` +
            `🏆 <b>إجمالي الأرباح:</b> ${user.totalWins}$\n` +
            `💸 <b>إجمالي الخسائر:</b> ${user.totalLosses}$`
        );
    } else if (text === '/help') {
        await ctx.replyWithHTML(
            `🎮 <b>أوامر اللعبة:</b>\n\n` +
            `<code>100</code> - بدء لعبة برهان 100$\n` +
            `<code>سحب</code> - سحب الأموال\n` +
            `<code>/balance</code> - رصيدك\n` +
            `<code>/start</code> - إعادة البدء\n\n` +
            `✈️ <b>شاهد الطائرة ترتفع وتجنب الاصطدام بالجبال!</b>`
        );
    }
});

// 🔄 تحديث اللعبة تلقائياً
function startGameUpdates(ctx, game, messageId) {
    const interval = setInterval(async () => {
        try {
            if (!game.update()) {
                clearInterval(interval);
                
                const user = initUser(game.userId);
                user.totalLosses += game.betAmount;
                
                delete games[game.userId];
                
                const finalScene = game.drawScene();
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    messageId,
                    null,
                    `💥 <b>انتهت اللعبة!</b>\n\n` +
                    `${finalScene}\n\n` +
                    `😔 <b>خسرت:</b> ${game.betAmount}$\n` +
                    `💼 <b>رصيدك:</b> ${user.balance}$\n\n` +
                    `🎮 <b>للعبة جديدة، ارسل مبلغ الرهان:</b>`,
                    { parse_mode: 'HTML' }
                );
            } else {
                // تحديث المشهد
                const scene = game.drawScene();
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    messageId,
                    null,
                    `🎮 <b>اللعبة جارية...</b>\n\n` +
                    `${scene}\n\n` +
                    `💸 <b>ارسل "سحب" لسحب أموالك!</b>\n` +
                    `⏰ <b>المضاعف يزيد...</b>`,
                    { parse_mode: 'HTML' }
                );
            }
        } catch (error) {
            // تجاهل أخطاء تعديل الرسالة (مثل عدم وجود تغييرات)
            if (error.response && error.response.error_code === 400) {
                // لا تفعل شيء
            } else {
                console.error('Error updating game:', error);
                clearInterval(interval);
            }
        }
    }, 2000); // تحديث كل 2 ثانية
}

// 🏓 أمر PING
bot.command('ping', (ctx) => {
    ctx.reply('🏓 البوت يعمل! ارسل /start للبدء');
});

// تشغيل البوت
bot.launch().then(() => {
    console.log('✅ بوت لعبة CRASH يعمل بنجاح!');
}).catch(err => {
    console.error('❌ خطأ في تشغيل البوت:', err);
});

// إعداد السيرفر الويب
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🎮 لعبة CRASH</title>
            <meta charset="utf-8">
            <style>
                body { 
                    font-family: 'Courier New', monospace; 
                    background: #0a0a2a;
                    color: #00ff00; 
                    text-align: center; 
                    padding: 50px;
                }
                .container {
                    background: #1a1a4a;
                    padding: 30px;
                    border-radius: 10px;
                    max-width: 600px;
                    margin: 0 auto;
                    border: 2px solid #00ff00;
                }
                h1 { color: #00ff00; text-shadow: 0 0 10px #00ff00; }
                .scene {
                    background: #000;
                    padding: 20px;
                    border-radius: 5px;
                    margin: 20px 0;
                    font-family: monospace;
                    white-space: pre;
                }
                .instructions {
                    text-align: left;
                    margin: 20px 0;
                    padding: 15px;
                    background: #2a2a5a;
                    border-radius: 5px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎮 لعبة CRASH - الطائرة والجبال</h1>
                <div class="scene">
☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️
  ✈️
🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️🏔️
                </div>
                <div class="instructions">
                    <h3>🎯 كيفية اللعب:</h3>
                    <p>1. ارسل مبلغ الرهان (مثال: 100)</p>
                    <p>2. شاهد الطائرة ترتفع والمضاعف يزيد</p>
                    <p>3. ارسل "سحب" لسحب أموالك قبل الانفجار</p>
                    <p>4. إذا انفجرت الطائرة تخسر الرهان!</p>
                </div>
                <p>🚀 اذهب إلى تليجرام وابحث عن البوت للبدء!</p>
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
