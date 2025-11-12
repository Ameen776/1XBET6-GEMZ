# bot.py - بوت التليجرام
import os
import logging
import requests
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

# قراءة من متغيرات البيئة
TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN', '8020165788:AAHyM7nKtS9eovxiPkHh0SP84eXnyrBLmus')
ADMIN_CHAT_ID = int(os.getenv('ADMIN_CHAT_ID', '6565594143'))
WEB_SERVICE_URL = os.getenv('WEB_SERVICE_URL', 'http://localhost:5000')

# إعداد التسجيل
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_id = str(user.id)
    
    # تحية خاصة للمطور
    if user.id == ADMIN_CHAT_ID:
        await update.message.reply_text(
            "👑 **مرحباً يا مطوري!** 👑\n"
            "البوت يعمل بشكل مثالي ✅\n"
            "يمكنك إدارة اللعبة من هنا."
        )
    
    # الحصول على الرصيد
    balance = await get_user_balance(user_id)
    
    keyboard = [
        [InlineKeyboardButton("🎮 بدأ لعبة Crash", callback_data="start_game")],
        [InlineKeyboardButton("💰 رصيدي", callback_data="balance")],
        [InlineKeyboardButton("❓ كيفية اللعب", callback_data="help")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        f"مرحباً {user.first_name}! 👋\n\n"
        f"💰 الرصيد الحالي: **${balance}**\n\n"
        "🎮 **لعبة Crash**\n"
        "• اراهن واشاهد الطائرة ترتفع\n"
        "• اسحب أموالي قبل أن تتحطم\n"
        "• كلما ارتفعت الطائرة زاد الربح!",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

async def get_user_balance(user_id):
    try:
        response = requests.post(
            f"{WEB_SERVICE_URL}/get_balance",
            json={"user_id": user_id},
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            return data.get('balance', 10.0)
    except:
        pass
    return 10.0

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = str(query.from_user.id)
    
    if query.data == "start_game":
        await start_game_menu(query, user_id)
    elif query.data == "balance":
        await show_balance(query, user_id)
    elif query.data == "help":
        await help_command(query)
    elif query.data.startswith("bet_"):
        amount = float(query.data.split("_")[1])
        await place_bet(query, user_id, amount)
    elif query.data == "cash_out":
        await cash_out(query, user_id)
    elif query.data == "game_status":
        await game_status(query, user_id)

async def start_game_menu(query, user_id):
    balance = await get_user_balance(user_id)
    
    keyboard = [
        [InlineKeyboardButton("🎯 رهان $1", callback_data="bet_1")],
        [InlineKeyboardButton("🎯 رهان $2", callback_data="bet_2")],
        [InlineKeyboardButton("🎯 رهان $5", callback_data="bet_5")],
        [InlineKeyboardButton("💰 رصيدي", callback_data="balance")],
        [InlineKeyboardButton("❓ مساعدة", callback_data="help")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        f"💰 الرصيد: **${balance}**\n\n"
        "🎮 اختر مبلغ الرهان:\n\n"
        "**كيفية اللعب:**\n"
        "• الطائرة تقلع وترتفع\n" 
        "• المضاعف يزيد كل ثانية\n"
        "• اسحب أموالك قبل الانفجار\n"
        "• إذا انفجرت تخسر الرهان",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

async def place_bet(query, user_id, bet_amount):
    try:
        response = requests.post(
            f"{WEB_SERVICE_URL}/place_bet",
            json={"user_id": user_id, "bet_amount": bet_amount},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data["success"]:
                keyboard = [
                    [InlineKeyboardButton("🛬 سحب الأموال", callback_data="cash_out")],
                    [InlineKeyboardButton("📈 حالة اللعبة", callback_data="game_status")],
                    [InlineKeyboardButton("💰 رصيدي", callback_data="balance")]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await query.edit_message_text(
                    f"🎯 **الرهان: ${bet_amount}**\n"
                    f"✈️ الطائرة تقلع...\n"
                    f"📈 المضاعف الحالي: 1.00x\n\n"
                    f"**اضغط على 'سحب الأموال' عندما تريد التوقف!**",
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
            else:
                await query.edit_message_text(f"❌ {data['message']}")
        else:
            await query.edit_message_text("❌ خطأ في الاتصال بالخادم")
    except Exception as e:
        await query.edit_message_text("❌ خطأ في الخادم، حاول لاحقاً")

async def cash_out(query, user_id):
    try:
        response = requests.post(
            f"{WEB_SERVICE_URL}/cash_out",
            json={"user_id": user_id},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data["success"]:
                keyboard = [
                    [InlineKeyboardButton("🎮 لعبة جديدة", callback_data="start_game")],
                    [InlineKeyboardButton("💰 رصيدي", callback_data="balance")]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await query.edit_message_text(
                    f"🎉 **نجحت!** 🎉\n\n"
                    f"💰 **الربح: ${data['profit']}**\n"
                    f"📈 **المضاعف: {data['multiplier']}x**\n"
                    f"💵 **الرصيد: ${data['balance']}**",
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
            else:
                await query.edit_message_text(f"❌ {data['message']}")
    except Exception as e:
        await query.edit_message_text("❌ خطأ في الخادم، حاول لاحقاً")

async def game_status(query, user_id):
    balance = await get_user_balance(user_id)
    await query.edit_message_text(
        f"📊 **حالة اللعبة**\n\n"
        f"💰 الرصيد: **${balance}**\n"
        f"✈️ الطائرة تحلق...\n\n"
        f"استخدم 'سحب الأموال' لتحقيق ربحك!",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🛬 سحب الأموال", callback_data="cash_out")],
            [InlineKeyboardButton("🎮 لعبة جديدة", callback_data="start_game")]
        ]),
        parse_mode='Markdown'
    )

async def show_balance(query, user_id):
    balance = await get_user_balance(user_id)
    keyboard = [
        [InlineKeyboardButton("🎮 العب الآن", callback_data="start_game")],
        [InlineKeyboardButton("📊 إحصائيات", callback_data="game_status")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        f"💼 **رصيدك**\n\n"
        f"💰 **${balance}**\n\n"
        f"جاهز للعب؟ اختر 'العب الآن'!",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

async def help_command(query):
    await query.edit_message_text(
        "📖 **كيفية اللعب:**\n\n"
        "1. 🎯 اختر مبلغ الرهان\n"
        "2. ✈️ شاهد الطائرة ترتفع والمضاعف يزيد\n" 
        "3. 🛬 اسحب أموالك قبل أن تتحطم الطائرة\n"
        "4. 💰 اربح مبلغ الرهان × المضاعف\n\n"
        "⚠️ **تحذير:** إذا تحطمت الطائرة قبل السحب، تخسر الرهان!\n\n"
        "🎯 **استراتيجية:**\n"
        "• اسحب مبكراً لربح مضمون\n"
        "• انتظر أكثر لربح أكبر\n"
        "• لا تنتظر كثيراً حتى لا تخسر",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🎮 ابدأ اللعب", callback_data="start_game")],
            [InlineKeyboardButton("💰 رصيدي", callback_data="balance")]
        ]),
        parse_mode='Markdown'
    )

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.error(f"حدث خطأ: {context.error}")

def main():
    # إنشاء التطبيق
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    
    # إضافة handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("balance", lambda u,c: show_balance(u.callback_query, str(u.effective_user.id)) if u.callback_query else None))
    application.add_handler(CommandHandler("help", lambda u,c: help_command(u.callback_query) if u.callback_query else None))
    application.add_handler(CallbackQueryHandler(button_handler))
    
    # إدارة الأخطاء
    application.add_error_handler(error_handler)
    
    # بدأ البوت
    logger.info("البوت يعمل...")
    application.run_polling()

if __name__ == '__main__':
    main()