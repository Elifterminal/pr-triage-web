#!/usr/bin/env python3
"""Send targeted outreach emails via Zoho SMTP."""

import smtplib
import ssl
import sys
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

# Load env
env_path = Path.home() / ".env"
env_vars = {}
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env_vars[k.strip()] = v.strip()

SMTP_HOST = env_vars.get("ZOHO_SMTP_HOST", "smtp.zoho.com")
SMTP_PORT = int(env_vars.get("ZOHO_SMTP_PORT", "465"))
EMAIL = env_vars.get("ZOHO_EMAIL", "Elif1203@zohomail.com")
PASSWORD = env_vars.get("ZOHO_APP_PASSWORD", "")

def send_email(to_addr: str, subject: str, body: str):
    msg = MIMEMultipart("alternative")
    msg["From"] = f"Elif <{EMAIL}>"
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
        server.login(EMAIL, PASSWORD)
        server.sendmail(EMAIL, to_addr, msg.as_string())
    print(f"Sent to {to_addr}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python outreach-email.py <to> <subject> <body_file>")
        sys.exit(1)

    to = sys.argv[1]
    subject = sys.argv[2]
    body = Path(sys.argv[3]).read_text()
    send_email(to, subject, body)
