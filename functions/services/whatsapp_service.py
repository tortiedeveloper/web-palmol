# functions/services/whatsapp_service.py
import requests
import json
from requests.auth import HTTPBasicAuth

import config 

def send_template_message(recipient_number: str, content_sid: str, template_variables: list):
    """
    Mengirim pesan WhatsApp menggunakan Template yang sudah disetujui via Twilio.
    recipient_number bisa berupa nomor individu ('whatsapp:+62...') atau ID grup.
    """
    account_sid = config.TWILIO_ACCOUNT_SID.value()
    auth_token = config.TWILIO_AUTH_TOKEN.value()
    twilio_number = config.TWILIO_WHATSAPP_NUMBER.value()

    if not all([account_sid, auth_token, twilio_number, recipient_number, content_sid]):
        print("ERROR: Konfigurasi Twilio atau parameter tidak lengkap.")
        return False

    api_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    
    # Membuat payload ContentVariables secara dinamis
    content_vars = {}
    for i, var in enumerate(template_variables):
        content_vars[str(i + 1)] = str(var)

    # Payload untuk mengirim Template
    payload = {
        "To": recipient_number,
        "From": twilio_number,
        "ContentSid": content_sid,
        "ContentVariables": json.dumps(content_vars)
    }

    try:
        print(f"Mengirim template (SID: {content_sid}) ke: {recipient_number}...")
        response = requests.post(
            api_url,
            data=payload,
            auth=HTTPBasicAuth(account_sid, auth_token),
            timeout=15
        )
        response.raise_for_status()
        print(f"Template berhasil dikirim. SID Pesan: {response.json().get('sid')}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"!!! GAGAL mengirim template WhatsApp ke {recipient_number}: {e}")
        if e.response is not None:
            print(f"Response body: {e.response.text}")
        return False