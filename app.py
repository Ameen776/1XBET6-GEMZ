# app.py - ويب سيرفيس للعبة Crash
import os
import random
import time
from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# قراءة من متغيرات البيئة
SECRET_KEY = os.getenv('SECRET_KEY', '8289468105:AAEX0lGF7OkaZ93slM1qao4-v5K1WFnafVk')
ADMIN_CHAT_ID = int(os.getenv('ADMIN_CHAT_ID', '6565594143'))

# حالة اللعبة
games = {}
users_balance = {}

# HTML واجهة ويب
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Crash Game</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial; background: #1a1a2e; color: white; text-align: center; margin: 0; padding: 20px; }
        .container { max-width: 400px; margin: 0 auto; background: #16213e; padding: 20px; border-radius: 10px; }
        .multiplier { font-size: 2.5em; color: #4CAF50; margin: 20px 0; font-weight: bold; }
        .button { padding: 12px 25px; margin: 10px; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; width: 90%; }
        .bet-btn { background: #4CAF50; color: white; }
        .cashout-btn { background: #2196F3; color: white; }
        .plane { font-size: 3em; margin: 20px 0; transition: transform 0.3s; }
        .balance { font-size: 1.2em; margin: 15px 0; color: #ffd700; }
        .message { margin: 15px 0; min-height: 40px; font-size: 1.1em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎮 لعبة Crash</h1>
        <div class="balance">الرصيد: $<span id="balance">10.00</span></div>
        <div class="multiplier" id="multiplier">1.00x</div>
        <div class="plane" id="plane">✈️</div>
        
        <button class="button bet-btn" onclick="placeBet(1)" id="betBtn1">رهان $1</button>
        <button class="button bet-btn" onclick="placeBet(2)" id="betBtn2">رهان $2</button>
        <button class="button bet-btn" onclick="placeBet(5)" id="betBtn5">رهان $5</button>
        
        <button class="button cashout-btn" onclick="cashOut()" id="cashoutBtn" style="display:none;">سحب الأموال</button>
        
        <div class="message" id="message"></div>
    </div>

    <script>
        let gameActive = false;
        let currentMultiplier = 1.0;
        let updateInterval;

        function placeBet(amount) {
            fetch('/place_bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: 'web_user', bet_amount: amount })
            })
            .then(r => r.json())
            .then(data => {
                if(data.success) {
                    startGame(data.multiplier);
                    updateBalance(data.balance);
                    showMessage('', '');
                } else {
                    showMessage(data.message, 'red');
                }
            });
        }

        function startGame(multiplier) {
            gameActive = true;
            currentMultiplier = multiplier;
            document.getElementById('cashoutBtn').style.display = 'block';
            ['betBtn1','betBtn2','betBtn5'].forEach(id => {
                document.getElementById(id).style.display = 'none';
            });

            updateInterval = setInterval(() => {
                if(gameActive) {
                    currentMultiplier += 0.02;
                    updateMultiplier();
                    checkCrash();
                }
            }, 500);
        }

        function updateMultiplier() {
            const elem = document.getElementById('multiplier');
            elem.textContent = currentMultiplier.toFixed(2) + 'x';
            elem.style.color = currentMultiplier > 2 ? '#FF9800' : '#4CAF50';
            
            const plane = document.getElementById('plane');
            plane.style.transform = `translateY(-${(currentMultiplier-1)*10}px) rotate(${(currentMultiplier-1)*2}deg)`;
        }

        function checkCrash() {
            if(currentMultiplier > 10) crashGame();
            else if(currentMultiplier > 5 && Math.random() < 0.1) crashGame();
            else if(currentMultiplier > 3 && Math.random() < 0.05) crashGame();
            else if(currentMultiplier > 2 && Math.random() < 0.02) crashGame();
        }

        function crashGame() {
            gameActive = false;
            clearInterval(updateInterval);
            document.getElementById('plane').innerHTML = '💥';
            showMessage('انفجرت الطائرة! خسرت الرهان', 'red');
            resetButtons();
        }

        function cashOut() {
            fetch('/cash_out', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: 'web_user' })
            })
            .then(r => r.json())
            .then(data => {
                if(data.success) {
                    gameActive = false;
                    clearInterval(updateInterval);
                    showMessage(`🎉 نجحت! ربحت: $${data.profit}`, '#4CAF50');
                    updateBalance(data.balance);
                    resetButtons();
                }
            });
        }

        function updateBalance(balance) {
            document.getElementById('balance').textContent = balance;
        }

        function showMessage(text, color) {
            const msg = document.getElementById('message');
            msg.textContent = text;
            msg.style.color = color;
        }

        function resetButtons() {
            document.getElementById('cashoutBtn').style.display = 'none';
            ['betBtn1','betBtn2','betBtn5'].forEach(id => {
                document.getElementById(id).style.display = 'block';
            });
            document.getElementById('plane').innerHTML = '✈️';
            document.getElementById('plane').style.transform = 'none';
        }
    </script>
</body>
</html>
'''

class CrashGame:
    def __init__(self, user_id, bet_amount):
        self.user_id = user_id
        self.bet_amount = bet_amount
        self.multiplier = 1.0
        self.crash_point = random.uniform(1.5, 8.0)
        self.is_active = True
        self.start_time = time.time()

    def update(self):
        if not self.is_active:
            return "crashed"
        
        time_elapsed = time.time() - self.start_time
        self.multiplier = 1.0 + (time_elapsed * 0.1)
        
        if self.multiplier >= self.crash_point:
            self.is_active = False
            return "crashed"
        
        return "active"

@app.route('/')
def home():
    return render_template_string(HTML_TEMPLATE)

@app.route('/place_bet', methods=['POST'])
def place_bet():
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'web_user')
        bet_amount = float(data.get('bet_amount', 1.0))
        
        if user_id not in users_balance:
            users_balance[user_id] = 10.0
        
        if users_balance[user_id] < bet_amount:
            return jsonify({"success": False, "message": "رصيد غير كافي"})
        
        if user_id in games and games[user_id].is_active:
            return jsonify({"success": False, "message": "لديك لعبة نشطة بالفعل"})
        
        users_balance[user_id] -= bet_amount
        games[user_id] = CrashGame(user_id, bet_amount)
        
        return jsonify({
            "success": True, 
            "balance": round(users_balance[user_id], 2),
            "multiplier": 1.0
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"خطأ: {str(e)}"})

@app.route('/cash_out', methods=['POST'])
def cash_out():
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'web_user')
        
        if user_id not in games or not games[user_id].is_active:
            return jsonify({"success": False, "message": "لا يوجد لعبة نشطة"})
        
        game = games[user_id]
        game.update()  # تحديث المضاعف الأخير
        profit = game.bet_amount * game.multiplier
        users_balance[user_id] += profit
        game.is_active = False
        
        return jsonify({
            "success": True,
            "profit": round(profit, 2),
            "multiplier": round(game.multiplier, 2),
            "balance": round(users_balance[user_id], 2)
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"خطأ: {str(e)}"})

@app.route('/get_balance', methods=['POST'])
def get_balance():
    data = request.get_json()
    user_id = data.get('user_id', 'web_user')
    
    if user_id not in users_balance:
        users_balance[user_id] = 10.0
    
    return jsonify({
        "success": True,
        "balance": round(users_balance[user_id], 2)
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
