# functions/config.py
from firebase_functions import params

# Mengambil secret yang telah di-set di Firebase Secret Manager
WHATSAPP_API_TOKEN = params.SecretParam("WHATSAPP_API_TOKEN")
WHATSAPP_API_URL = params.SecretParam("WHATSAPP_API_URL")