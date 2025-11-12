# main.py
import os
import asyncio
import random
import decimal
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from aiogram import Bot, Dispatcher
from aiogram.types import Message
from aiogram.utils.executor import start_polling

from sqlalchemy import create_engine, Column, Integer, BigInteger, String, Numeric, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Configuration
BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID"))
PORT = int(os.getenv("PORT", 8000))

# Database
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
    balance = Column(Numeric(18, 2), default=0)
    banned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Bet(Base):
    __tablename__ = "bets"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    telegram_id = Column(BigInteger, nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    crash_multiplier = Column(Numeric(18, 6), nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# FastAPI app
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

# Bot setup
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(bot)

# Helper functions
def get_or_create_user(session, tg_user):
    user = session.query(User).filter_by(telegram_id=tg_user.id).first()
    if not user:
        user = User(telegram_id=tg_user.id, balance=0)
        session.add(user)
        session.commit()
        session.refresh(user)
    return user

@dp.message_handler(commands=["start"])
async def cmd_start(message: Message):
    session = SessionLocal()
    get_or_create_user(session, message.from_user)
    await message.reply("أهلاً! هذا هو بوت الطيارة (Crash). قم بوضع رهانك وابدأ اللعب باستخدام /crash <مبلغ>.")

@dp.message_handler(commands=["balance"])
async def cmd_balance(message: Message):
    session = SessionLocal()
    user = session.query(User).filter_by(telegram_id=message.from_user.id).first()
    await message.reply(f"رصيدك الحالي: {float(user.balance)}")
    session.close()

@dp.message_handler(commands=["crash"])
async def cmd_crash(message: Message):
    parts = message.text.split()
    if len(parts) < 2:
        return await message.reply("استخدام: /crash <المبلغ>")
    try:
        amount = float(parts[1])
        if amount <= 0: raise ValueError
    except:
        return await message.reply("المبلغ غير صالح.")
    
    session = SessionLocal()
    user = get_or_create_user(session, message.from_user)
    if user.balance < amount:
        await message.reply("رصيدك غير كافٍ.")
        session.close()
        return
    # Create bet
    crash_multiplier = round(random.uniform(1.0, 5.0), 2)
    bet = Bet(user_id=user.id, telegram_id=message.from_user.id, amount=amount, crash_multiplier=crash_multiplier)
    session.add(bet)
    session.commit()
    await message.reply(f"تم إنشاء الرهان. مضاعف الطيارة: x{crash_multiplier}.\nافتح اللعبة هنا: /play {bet.id}")
    session.close()

@dp.message_handler(commands=["play"])
async def cmd_play(message: Message):
    parts = message.text.split()
    if len(parts) < 2:
        return await message.reply("استخدام: /play <bet_id>")
    bet_id = int(parts[1])
    
    session = SessionLocal()
    bet = session.query(Bet).filter_by(id=bet_id).first()
    if not bet:
        await message.reply("لم يتم العثور على الرهان.")
        session.close()
        return
    
    # Generate crash multiplier for demo
    crash_multiplier = round(random.uniform(1.0, 5.0), 2)
    bet.crash_multiplier = crash_multiplier
    bet.status = "completed"
    session.commit()
    
    await message.reply(f"مضاعف الطيارة: x{crash_multiplier}. هل ترغب في سحب رهانك؟ استخدم /cashout {bet.id} لتسحب قبل انفجار الطيارة.")
    session.close()

@dp.message_handler(commands=["cashout"])
async def cmd_cashout(message: Message):
    parts = message.text.split()
    if len(parts) < 2:
        return await message.reply("استخدام: /cashout <bet_id>")
    bet_id = int(parts[1])
    
    session = SessionLocal()
    bet = session.query(Bet).filter_by(id=bet_id).first()
    if not bet:
        await message.reply("لم يتم العثور على الرهان.")
        session.close()
        return
    
    # Check if user cashed out before crash
    if bet.status != "completed":
        await message.reply(f"لم يتم الانتهاء من الرهان بعد. مضاعف الطيارة: x{bet.crash_multiplier}.")
        session.close()
        return
    
    payout = bet.amount * bet.crash_multiplier
    user = session.query(User).filter_by(telegram_id=message.from_user.id).first()
    user.balance += payout
    session.commit()
    
    await message.reply(f"لقد سحبت بنجاح! جائزة: {payout}. رصيدك الآن: {user.balance}")
    session.close()

# Running FastAPI + Aiogram
@app.on_event("startup")
async def startup_event():
    loop = asyncio.get_event_loop()
    loop.create_task(start_polling(dp))

@app.get("/", response_class=HTMLResponse)
async def index():
    return HTMLResponse(content="<h2>بوت الطيارة - رهان مباشر</h2>")
