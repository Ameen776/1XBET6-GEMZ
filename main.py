# main.py
import os
import threading
import random
import decimal
from datetime import datetime

from flask import Flask, send_from_directory, jsonify, request
from sqlalchemy import (create_engine, Column, Integer, BigInteger, String,
                        Numeric, DateTime, Boolean, Text)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from aiogram import Bot, Dispatcher, types
from aiogram.utils import executor

# ----------------- Configuration -----------------
BOT_TOKEN = os.getenv("BOT_TOKEN")  # from Render env
ADMIN_ID = int(os.getenv("ADMIN_ID", "0"))  # admin telegram id
PORT = int(os.getenv("PORT", "8000"))
HOST_URL = os.getenv("HOST_URL", None)  # optional, used to build game links

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN environment variable is required")

# ----------------- Database (SQLite) -----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "crash_bot.sqlite")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=False)
    username = Column(String, nullable=True)
    balance = Column(Numeric(18,2), default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    banned = Column(Boolean, default=False)

class Bet(Base):
    __tablename__ = "bets"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    telegram_id = Column(BigInteger, nullable=False)
    amount = Column(Numeric(18,2), nullable=False)
    crash_multiplier = Column(Numeric(18,6), nullable=True)  # explosion multiplier
    cashed_at = Column(Numeric(18,6), nullable=True)  # what player cashed at
    status = Column(String, default="pending")  # pending / won / lost / cashed
    created_at = Column(DateTime, default=datetime.utcnow)

class Deposit(Base):
    __tablename__ = "deposits"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    amount = Column(Numeric(18,2), nullable=False)
    status = Column(String, default="pending")  # pending / approved / rejected
    proof_file_id = Column(String, nullable=True)  # telegram file_id of screenshot
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# ----------------- Flask app (serves static game) -----------------
app = Flask(__name__, static_folder="static")

@app.route("/")
def index():
    return "Crash Bot backend — service is up."

@app.route("/game/<int:bet_id>")
def serve_game(bet_id):
    # serves static crash.html; bet_id passed via query string
    return app.send_static_file('crash.html')

@app.route("/api/get_bet/<int:bet_id>")
def api_get_bet(bet_id):
    session = SessionLocal()
    bet = session.query(Bet).filter_by(id=bet_id).first()
    if not bet:
        session.close()
        return jsonify({"ok": False, "error": "bet_not_found"}), 404
    # For demo we send crash multiplier (server-side decides explosion)
    data = {
        "ok": True,
        "bet_id": bet.id,
        "amount": float(bet.amount),
        "crash_multiplier": float(bet.crash_multiplier) if bet.crash_multiplier is not None else None,
        "status": bet.status
    }
    session.close()
    return jsonify(data)

@app.route("/api/cashout", methods=["POST"])
def api_cashout():
    payload = request.json
    if not payload:
        return jsonify({"ok": False, "error": "no_payload"}), 400
    bet_id = payload.get("bet_id")
    cashed_at = float(payload.get("cashed_at", 0))
    session = SessionLocal()
    bet = session.query(Bet).filter_by(id=bet_id).first()
    if not bet:
        session.close()
        return jsonify({"ok": False, "error": "bet_not_found"}), 404
    if bet.status != "pending":
        session.close()
        return jsonify({"ok": False, "error": "already_settled"}), 400
    crash = float(bet.crash_multiplier)
    # player wins if cashed_at < crash (i.e., cashed before explosion)
    if cashed_at < crash - 1e-9:
        payout = round(float(bet.amount) * cashed_at, 2)
        # credit user
        user = session.query(User).filter_by(id=bet.user_id).first()
        user.balance = float(user.balance) + payout
        bet.cashed_at = decimal.Decimal(str(round(cashed_at,6)))
        bet.status = "won"
        session.commit()
        # notify user async via bot
        try:
            bot.send_message(bet.telegram_id, f"✅ فزت! رهان #{bet.id} — مضاعف: x{cashed_at:.2f} — جائزة: {payout}")
        except Exception:
            pass
        session.close()
        return jsonify({"ok": True, "result": "won", "payout": payout})
    else:
        # lost
        bet.cashed_at = decimal.Decimal(str(round(cashed_at,6)))
        bet.status = "lost"
        session.commit()
        try:
            bot.send_message(bet.telegram_id, f"💥 خسرت! رهان #{bet.id} — انفجار عند x{crash:.2f}")
        except Exception:
            pass
        session.close()
        return jsonify({"ok": True, "result": "lost"})

# ----------------- Aiogram bot (v2) -----------------
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(bot)

def get_or_create_user(tg_user):
    session = SessionLocal()
    user = session.query(User).filter_by(telegram_id=tg_user.id).first()
    if not user:
        user = User(telegram_id=tg_user.id, username=tg_user.username or "", balance=0)
        session.add(user)
        session.commit()
        session.refresh(user)
    session.close()
    return user

@dp.message_handler(commands=["start"])
def cmd_start(message: types.Message):
    get_or_create_user(message.from_user)
    message.reply("أهلاً! بوت الطيارة (Crash) جاهز.\nللاختبار: استخدم /deposit <amount> ثم ارفع إثبات الدفع (صورة) بالشرح أسفل.\nثم استخدم /bet <amount> للرهان.")

@dp.message_handler(commands=["balance"])
def cmd_balance(message: types.Message):
    session = SessionLocal()
    user = session.query(User).filter_by(telegram_id=message.from_user.id).first()
    bal = float(user.balance) if user else 0.0
    session.close()
    message.reply(f"رصيدك: {bal}")

@dp.message_handler(commands=["deposit"])
def cmd_deposit(message: types.Message):
    # usage: /deposit 50  -> creates pending deposit and instructs to upload screenshot with caption deposit:<id>
    parts = message.text.split()
    if len(parts) < 2:
        return message.reply("استخدام: /deposit <amount>\nبعدها ارفق صورة الإيصال مع التعليق: deposit:<id> ليتم إرساله للأدمن للمراجعة.")
    try:
        amount = float(parts[1])
        if amount <= 0:
            raise ValueError
    except:
        return message.reply("المبلغ غير صالح.")
    session = SessionLocal()
    user = session.query(User).filter_by(telegram_id=message.from_user.id).first()
    if not user:
        user = User(telegram_id=message.from_user.id, username=message.from_user.username or "", balance=0)
        session.add(user)
        session.commit()
    dep = Deposit(user_id=user.id, amount=amount, status="pending")
    session.add(dep)
    session.commit()
    session.refresh(dep)
    session.close()
    message.reply(f"تم إنشاء طلب إيداع مؤقت (ID: {dep.id}). الآن أرسل صورة إيصال الدفع كصورة مع التعليق (caption): deposit:{dep.id}\nستتحقق الإدارة وتوافق أو ترفض يدوياً.")

@dp.message_handler(commands=["bet"])
def cmd_bet(message: types.Message):
    # create bet and open game link
    parts = message.text.split()
    if len(parts) < 2:
        return message.reply("استخدام: /bet <amount>")
    try:
        amount = float(parts[1])
        if amount <= 0:
            raise ValueError
    except:
        return message.reply("المبلغ غير صالح.")
    session = SessionLocal()
    user = session.query(User).filter_by(telegram_id=message.from_user.id).first()
    if not user or float(user.balance) < amount:
        session.close()
        return message.reply("رصيد غير كافٍ. استخدم /deposit لإرسال طلب إيداع.")
    # deduct immediately
    user.balance = float(user.balance) - amount
    # generate server-side crash multiplier (1.00 - 20.00) with 2 decimals
    crash_val = round(random.uniform(1.05, 8.00), 2)
    bet = Bet(user_id=user.id, telegram_id=message.from_user.id, amount=amount,
              crash_multiplier=decimal.Decimal(str(crash_val)), status="pending")
    session.add(bet)
    session.commit()
    session.refresh(bet)
    bid = bet.id
    session.close()
    # build game url
    host = HOST_URL or f"https://{os.getenv('RENDER_EXTERNAL_URL')}" or f"http://localhost:{PORT}"
    game_url = f"{host}/game/{bid}?bet_id={bid}"
    message.reply(f"تم إنشاء رهان #{bid} بمبلغ {amount}.\nافتح اللعبة واضغط Cashout قبل انفجار الطيارة:\n{game_url}")

@dp.message_handler(commands=["mybets"])
def cmd_mybets(message: types.Message):
    session = SessionLocal()
    user = session.query(User).filter_by(telegram_id=message.from_user.id).first()
    if not user:
        session.close()
        return message.reply("لا يوجد حساب.")
    bets = session.query(Bet).filter_by(user_id=user.id).order_by(Bet.created_at.desc()).limit(10).all()
    text = "آخر رهاناتك:\n"
    for b in bets:
        text += f"#{b.id} | مبلغ: {float(b.amount)} | حالة: {b.status} | انفجار: {float(b.crash_multiplier) if b.crash_multiplier else '-'}\n"
    session.close()
    message.reply(text)

@dp.message_handler(content_types=types.ContentType.PHOTO)
def handle_photo(message: types.Message):
    # user can upload deposit proof by caption: deposit:<id>
    caption = (message.caption or "").strip()
    if caption.startswith("deposit:"):
        try:
            dep_id = int(caption.split(":")[1])
        except:
            return message.reply("التعليق (caption) غير صالح. استخدم: deposit:<id>")
        session = SessionLocal()
        dep = session.query(Deposit).filter_by(id=dep_id).first()
        if not dep:
            session.close()
            return message.reply("لم أجد طلب الإيداع المذكور.")
        # take highest resolution photo file_id
        file_id = message.photo[-1].file_id
        dep.proof_file_id = file_id
        session.commit()
        # notify admin
        try:
            bot.send_message(ADMIN_ID, f"جاء إثبات إيداع لطلب #{dep.id} من المستخدم {message.from_user.id}. المبلغ: {float(dep.amount)}. استخدم /approve_deposit {dep.id} أو /reject_deposit {dep.id}")
            bot.send_photo(ADMIN_ID, file_id, caption=f"إثبات إيداع لطلب #{dep.id} — user:{message.from_user.id}")
        except Exception:
            pass
        session.close()
        return message.reply("تم إرسال إثبات الإيداع للإدارة. انتظر الموافقة اليدوية.")
    else:
        # generic photo
        return message.reply("لرفع إثبات إيداع، ضع في تعليق الصورة: deposit:<id>")

@dp.message_handler(commands=["approve_deposit"])
def cmd_approve_deposit(message: types.Message):
    # admin command: /approve_deposit <deposit_id>
    if message.from_user.id != ADMIN_ID:
        return message.reply("غير مصرح.")
    parts = message.text.split()
    if len(parts) < 2:
        return message.reply("استخدام: /approve_deposit <deposit_id>")
    try:
        dep_id = int(parts[1])
    except:
        return message.reply("معرف غير صالح.")
    session = SessionLocal()
    dep = session.query(Deposit).filter_by(id=dep_id).first()
    if not dep:
        session.close()
        return message.reply("لم أجد طلب الإيداع.")
    if dep.status != "pending":
        session.close()
        return message.reply("هذا الطلب ليس في حالة انتظار.")
    user = session.query(User).filter_by(id=dep.user_id).first()
    if not user:
        session.close()
        return message.reply("لم أجد المستخدم.")
    user.balance = float(user.balance) + float(dep.amount)
    dep.status = "approved"
    session.commit()
    try:
        bot.send_message(user.telegram_id, f"✅ تمت الموافقة على إيداعك #{dep.id} — أضيفت {float(dep.amount)} إلى رصيدك.")
    except Exception:
        pass
    session.close()
    message.reply(f"تمت الموافقة على الإيداع #{dep.id}.")

@dp.message_handler(commands=["reject_deposit"])
def cmd_reject_deposit(message: types.Message):
    if message.from_user.id != ADMIN_ID:
        return message.reply("غير مصرح.")
    parts = message.text.split()
    if len(parts) < 2:
        return message.reply("استخدام: /reject_deposit <deposit_id>")
    try:
        dep_id = int(parts[1])
    except:
        return message.reply("معرف غير صالح.")
    session = SessionLocal()
    dep = session.query(Deposit).filter_by(id=dep_id).first()
    if not dep:
        session.close()
        return message.reply("لم أجد طلب الإيداع.")
    dep.status = "rejected"
    session.commit()
    try:
        bot.send_message(dep.user_id, f"❌ تم رفض إيداعك #{dep.id}.")
    except Exception:
        pass
    session.close()
    message.reply(f"تم رفض الإيداع #{dep.id}.")

# ----------------- Start polling in background thread -----------------
def start_polling_bot():
    executor.start_polling(dp, skip_updates=True)

def run_flask():
    # Flask runs as main thread when executed by Render
    app.run(host="0.0.0.0", port=PORT)

if __name__ == "__main__":
    thread = threading.Thread(target=start_polling_bot, daemon=True)
    thread.start()
    print("Starting Flask webserver...")
    run_flask()
