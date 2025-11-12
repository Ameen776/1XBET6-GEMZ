# main.py
import os
import asyncio
import random
import decimal
from datetime import datetime
from threading import Thread

from fastapi import FastAPI, Request, HTTPException, Form
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from aiogram import Bot, Dispatcher
from aiogram.types import Message
from aiogram.utils.executor import start_polling

from sqlalchemy import (create_engine, Column, Integer, BigInteger, String,
                        Numeric, DateTime, Boolean, Text)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ---------- Configuration ----------
BOT_TOKEN = os.getenv("8020165788:AAHyM7nKtS9eovxiPkHh0SP84eXnyrBLmus", "PUT_YOUR_BOT_TOKEN_HERE")
ADMIN_TELEGRAM_ID = int(os.getenv("6565594143", "0"))  # ضع معرف الأدمن هنا للتجربة
PORT = int(os.getenv("PORT", 8000))

# ---------- Database ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "crash_bot.sqlite")
DATABASE_URL = f"sqlite:///{DB_PATH}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
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
    status = Column(String, default="pending")  # pending / won / lost / cashed
    crash_multiplier = Column(Numeric(18,6), nullable=True)
    cashed_multiplier = Column(Numeric(18,6), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    type = Column(String)  # deposit, withdraw, payout
    amount = Column(Numeric(18,2))
    status = Column(String, default="completed")
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# ---------- FastAPI app ----------
app = FastAPI()
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# ---------- Aiogram bot (Dispatcher) ----------
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# helper functions
def get_or_create_user(session, tg_user):
    user = session.query(User).filter_by(telegram_id=tg_user.id).first()
    if not user:
        user = User(telegram_id=tg_user.id, username=tg_user.username or "", balance=0)
        session.add(user)
        session.commit()
        session.refresh(user)
    return user

# ---------- Telegram handlers (simple) ----------
@dp.message_handler(commands=["start"])
async def cmd_start(message: Message):
    session = SessionLocal()
    get_or_create_user(session, message.from_user)
    await message.reply("أهلاً! بوت Crash جاهز. لاختبار: استخدم /deposit <amount> ثم /crash <amount> للعب.\nأوامر: /balance /deposit /crash /history")
    session.close()

@dp.message_handler(commands=["balance"])
async def cmd_balance(message: Message):
    session = SessionLocal()
    user = session.query(User).filter_by(telegram_id=message.from_user.id).first()
    bal = float(user.balance) if user else 0.0
    await message.reply(f"رصيدك: {bal} وحدة")
    session.close()

@dp.message_handler(commands=["deposit"])
async def cmd_deposit(message: Message):
    parts = message.text.split()
    if len(parts) < 2:
        return await message.reply("استخدام: /deposit <amount>")
    try:
        amount = float(parts[1])
        if amount <= 0: raise ValueError
    except:
        return await message.reply("المبلغ غير صالح.")
    session = SessionLocal()
    user = get_or_create_user(session, message.from_user)
    user.balance = float(user.balance) + amount
    trx = Transaction(user_id=user.id, type="deposit", amount=amount, status="completed",
                      note="manual_test")
    session.add(trx)
    session.commit()
    await message.reply(f"تم إضافة {amount} إلى رصيدك. رصيدك الآن: {float(user.balance)}")
    session.close()

@dp.message_handler(commands=["history"])
async def cmd_history(message: Message):
    session = SessionLocal()
    user = session.query(User).filter_by(telegram_id=message.from_user.id).first()
    if not user:
        session.close()
        return await message.reply("لا يوجد سجل.")
    bets = session.query(Bet).filter_by(telegram_id=message.from_user.id).order_by(Bet.created_at.desc()).limit(20).all()
    text = "آخر الرهانات:\n"
    for b in bets:
        text += f"- #{b.id} {b.amount} => {b.status} crash={b.crash_multiplier} cashed={b.cashed_multiplier}\n"
    await message.reply(text)
    session.close()

@dp.message_handler(commands=["crash"])
async def cmd_crash(message: Message):
    # usage: /crash <amount>
    parts = message.text.split()
    if len(parts) < 2:
        return await message.reply("استخدام: /crash <amount>")
    try:
        amount = float(parts[1])
        if amount <= 0: raise ValueError
    except:
        return await message.reply("المبلغ غير صالح.")
    session = SessionLocal()
    user = session.query(User).filter_by(telegram_id=message.from_user.id).first()
    if not user or float(user.balance) < amount:
        session.close()
        return await message.reply("رصيد غير كافٍ.")
    # خصم مؤقت
    user.balance = float(user.balance) - amount
    # generate deterministic-ish crash multiplier for this bet (demo)
    # crash multiplier in range 1.00 .. 10.00 (two decimal places)
    crash_val = round(random.random() * 9.0 + 1.0, 2)
    bet = Bet(user_id=user.id, telegram_id=message.from_user.id, amount=amount,
              status="pending", crash_multiplier=decimal.Decimal(str(crash_val)))
    session.add(bet)
    session.commit()
    bet_id = bet.id
    # reply with link to open the game (hosted in /static/games/crash.html)
    host = os.getenv("HOST_URL", f"http://localhost:{PORT}")
    game_url = f"{host}/static/games/crash.html?bet_id={bet_id}"
    await message.reply(f"تم إنشاء رهان #{bet_id} بمقدار {amount}.\nافتح اللعبة واضغط Cashout قبل انفجار الطيارة:\n{game_url}")
    session.close()

# ---------- API endpoints used by the game ----------
@app.get("/api/get_bet/{bet_id}")
def api_get_bet(bet_id: int):
    session = SessionLocal()
    bet = session.query(Bet).filter_by(id=bet_id).first()
    if not bet:
        session.close()
        raise HTTPException(status_code=404, detail="Bet not found")
    # For demo purposes we send crash_multiplier to client.
    # In production do NOT expose it — instead control animation server-side.
    data = {
        "bet_id": bet.id,
        "amount": float(bet.amount),
        "crash_multiplier": float(bet.crash_multiplier),
        "status": bet.status
    }
    session.close()
    return JSONResponse(content=data)

class CashoutIn(BaseModel):
    bet_id: int
    cashed_at: float  # multiplier the player cashed at

@app.post("/api/cashout")
def api_cashout(payload: CashoutIn):
    session = SessionLocal()
    bet = session.query(Bet).filter_by(id=payload.bet_id).first()
    if not bet:
        session.close()
        raise HTTPException(status_code=404, detail="Bet not found")
    if bet.status != "pending":
        session.close()
        return JSONResponse(content={"ok": False, "msg": "Bet already settled"})
    crash = float(bet.crash_multiplier)
    cashed = float(payload.cashed_at)
    # if player cashed before crash -> win, else lost
    if cashed < crash + 1e-9:
        # won
        payout = round(float(bet.amount) * cashed, 2)
        # update user balance
        user = session.query(User).filter_by(id=bet.user_id).first()
        user.balance = float(user.balance) + payout
        bet.status = "won"
        bet.cashed_multiplier = decimal.Decimal(str(round(cashed,6)))
        trx = Transaction(user_id=user.id, type="payout", amount=payout, status="completed",
                          note=f"bet:{bet.id}")
        session.add(trx)
        session.commit()
        session.close()
        # notify user via bot (async)
        asyncio.create_task(bot.send_message(bet.telegram_id, f"مبروك! رهان #{bet.id} فزت. مضاعف: {cashed} — جائزة: {payout}"))
        return JSONResponse(content={"ok": True, "result": "won", "payout": payout})
    else:
        # lost
        bet.status = "lost"
        bet.cashed_multiplier = decimal.Decimal(str(round(cashed,6)))
        session.commit()
        session.close()
        asyncio.create_task(bot.send_message(bet.telegram_id, f"للأسف! رهان #{bet.id} خسرت. انفجار عند: {crash}"))
        return JSONResponse(content={"ok": True, "result": "lost"})

# ---------- serve main page (optional) ----------
@app.get("/", response_class=HTMLResponse)
def index():
    html = """
    <html><head><meta charset="utf-8"/></head><body>
    <h2>Crash Bot - جاهز</h2>
    <p>استخدم البوت عبر تيليجرام. صفحات الألعاب متاحة في /static/games/</p>
    </body></html>
    """
    return HTMLResponse(html)

# ---------- run aiogram polling in background ----------
def start_aiogram():
    # register handlers decorators already used
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    # start polling (blocking)
    loop.run_until_complete(dp.start_polling(bot))

def run_in_thread():
    thread = Thread(target=start_aiogram, daemon=True)
    thread.start()

# start aiogram when FastAPI starts
@app.on_event("startup")
async def startup_event():
    run_in_thread()

# ---------- uvicorn entrypoint ----------
# (when running uvicorn main:app)