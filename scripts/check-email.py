#!/usr/bin/env python3
"""Check Zoho inbox via IMAP and print new messages."""

import imaplib
import email
from email.header import decode_header
from pathlib import Path
import sys

env_path = Path.home() / ".env"
env_vars = {}
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env_vars[k.strip()] = v.strip()

IMAP_HOST = "imap.zoho.com"
IMAP_PORT = 993
EMAIL = env_vars.get("ZOHO_EMAIL", "Elif1203@zohomail.com")
PASSWORD = env_vars.get("ZOHO_APP_PASSWORD", "")

def decode_str(s):
    if s is None:
        return ""
    decoded = decode_header(s)
    parts = []
    for data, charset in decoded:
        if isinstance(data, bytes):
            parts.append(data.decode(charset or "utf-8", errors="replace"))
        else:
            parts.append(data)
    return " ".join(parts)

def check_inbox(unseen_only=True):
    mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    mail.login(EMAIL, PASSWORD)
    mail.select("INBOX")

    criterion = "UNSEEN" if unseen_only else "ALL"
    status, data = mail.search(None, criterion)

    if status != "OK" or not data[0]:
        print("NO_NEW_MAIL")
        mail.logout()
        return

    msg_ids = data[0].split()
    # Only show last 20
    for mid in msg_ids[-20:]:
        status, msg_data = mail.fetch(mid, "(RFC822)")
        if status != "OK":
            continue
        msg = email.message_from_bytes(msg_data[0][1])
        from_addr = decode_str(msg.get("From", ""))
        subject = decode_str(msg.get("Subject", ""))
        date = decode_str(msg.get("Date", ""))

        # Get plain text body
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        body = payload.decode("utf-8", errors="replace")
                    break
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                body = payload.decode("utf-8", errors="replace")

        # Truncate body
        body_preview = body.strip()[:500]

        print(f"---EMAIL---")
        print(f"FROM: {from_addr}")
        print(f"SUBJECT: {subject}")
        print(f"DATE: {date}")
        print(f"PREVIEW: {body_preview}")
        print(f"---END---")

    mail.logout()

if __name__ == "__main__":
    unseen = "--all" not in sys.argv
    check_inbox(unseen)
