# test_bot.py - لاختبار البوت
import os
import requests

TELEGRAM_TOKEN = "8020165788:AAHyM7nKtS9eovxiPkHh0SP84eXnyrBLmus"

def test_bot():
    print("🔍 اختبار البوت...")
    
    # اختبار getMe
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getMe"
    response = requests.get(url)
    
    if response.status_code == 200:
        bot_data = response.json()
        print(f"✅ البوت يعمل!")
        print(f"🤖 اسم البوت: {bot_data['result']['first_name']}")
        print(f"👤 username: @{bot_data['result']['username']}")
        print(f"🆔 ID البوت: {bot_data['result']['id']}")
    else:
        print(f"❌ خطأ: {response.status_code}")
        print(response.text)

if __name__ == '__main__':
    test_bot()