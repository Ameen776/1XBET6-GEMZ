// static/js/crash.js
(function(){
  function qs(name) {
    name = name.replace(/[[]/,"\\[").replace(/[\]]/,"\\]");
    var regex = new RegExp("[\\?&]"+name+"=([^&#]*)");
    var results = regex.exec(location.search);
    return results === null ? null : decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  const betId = qs('bet_id');
  const startBtn = document.getElementById('startBtn');
  const cashBtn = document.getElementById('cashBtn');
  const multDisplay = document.getElementById('mult');
  const log = document.getElementById('log');
  const progress = document.getElementById('progress');
  const betInput = document.getElementById('betAmount');

  let crashMultiplier = 2.0;
  let running = false;
  let currentMult = 1.0;
  let animId = null;
  let startTime = null;
  let growthRate = 0.0025; // tweak speed
  let crashed = false;

  function addLog(t){
    log.innerText = t + "\n" + log.innerText;
  }

  async function fetchBet() {
    if(!betId) { addLog("لم يتم العثور على bet_id في الرابط."); return null; }
    try {
      const resp = await fetch(`/api/get_bet/${betId}`);
      if(!resp.ok) throw new Error("failed");
      const j = await resp.json();
      return j;
    } catch(e) {
      addLog("خطأ في جلب بيانات الرهان.");
      return null;
    }
  }

  function animate() {
    if(crashed) return;
    const t = Date.now();
    const dt = t - startTime;
    // simple exponential growth for multiplier feel
    currentMult = 1.0 + Math.exp(growthRate * dt / 10) - 1.0;
    // clamp
    if(currentMult > 1000) currentMult = 1000;
    multDisplay.innerText = "x" + currentMult.toFixed(2);
    // progress visual relative to crashMultiplier (for demo)
    const pct = Math.min((currentMult / crashMultiplier) * 100, 100);
    progress.style.width = pct + "%";
    // plane rotate a bit
    const plane = document.getElementById('planeImg');
    if (plane) plane.style.transform = `rotate(${Math.min((currentMult-1)*10, 40)}deg) translateX(${Math.min((currentMult-1)*8,50)}px)`;
    if(currentMult >= crashMultiplier) {
      // crash!
      crashed = true;
      running = false;
      cashBtn.disabled = true;
      addLog(`انفجار عند x${crashMultiplier.toFixed(2)} — خسرت الرهان.`);
      multDisplay.innerText = "BOOM!";
      // notify server (settle lost)
      fetch('/api/cashout', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ bet_id: Number(betId), cashed_at: crashMultiplier + 1.0 })
      }).then(()=>{}).catch(()=>{});
      cancelAnimationFrame(animId);
      return;
    }
    animId = requestAnimationFrame(animate);
  }

  startBtn.addEventListener('click', async ()=>{
    if(running) return;
    const amount = Number(betInput.value);
    if(isNaN(amount) || amount <= 0) { addLog("ضع مبلغ صالح للرهان."); return; }
    // verify bet id & amount matching server (demo doesn't verify amount server-side)
    addLog("جارٍ جلب بيانات الرهان...");
    const bet = await fetchBet();
    if(!bet) return;
    if(bet.amount != amount) {
      addLog("تحذير: مبلغ الرهان المرسل في البوت مختلف عن المبلغ هنا. افتح الرهان من البوت أو ادخل المبلغ الصحيح.");
      // still allow for demo
    }
    crashMultiplier = bet.crash_multiplier;
    addLog(`اللعبة بدأت — الطيارة قد تنفجر عند مضاعف عشوائي.`);
    running = true;
    crashed = false;
    currentMult = 1.0;
    startTime = Date.now();
    cashBtn.disabled = false;
    animId = requestAnimationFrame(animate);
  });

  cashBtn.addEventListener('click', async ()=>{
    if(!running) return;
    running = false;
    cashBtn.disabled = true;
    const cashed_at = currentMult;
    addLog(`حاولت السحب عند x${cashed_at.toFixed(2)} ... جارٍ التحقق...`);
    try {
      const resp = await fetch('/api/cashout', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({bet_id: Number(betId), cashed_at: Number(cashed_at)})
      });
      const j = await resp.json();
      if(j.ok && j.result === 'won') {
        addLog(`فزت! جائزة: ${j.payout}`);
        multDisplay.innerText = "WIN x" + cashed_at.toFixed(2);
      } else {
        addLog(`خسرت! انتهى اللعب.`);
      }
    } catch(e){
      addLog("خطأ في الاتصال بالسيرفر.");
    }
    cancelAnimationFrame(animId);
  });

  // auto-show bet info
  (async ()=>{
    const b = await fetchBet();
    if(b) {
      addLog(`تعرّف على الرهان #${b.bet_id} — المبلغ: ${b.amount}`);
      betInput.value = b.amount;
    }
  })();

})();