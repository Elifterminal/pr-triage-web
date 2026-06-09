#!/usr/bin/env python3
"""Check HackerOne report statuses via API."""
import json
import os
import urllib.request
import base64
import sys

# Load creds
env = {}
with open(os.path.expanduser('~/.env')) as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            k, v = line.strip().split('=', 1)
            env[k] = v

username = env.get('HACKERONE_USERNAME', 'holohydra')
token = env['HACKERONE_API_TOKEN']

# Build auth header
credentials = base64.b64encode(f"{username}:{token}".encode()).decode()

url = "https://api.hackerone.com/v1/hackers/me/reports?page[size]=25"
req = urllib.request.Request(url)
req.add_header("Authorization", f"Basic {credentials}")

resp = urllib.request.urlopen(req)
data = json.loads(resp.read())

reports = data.get('data', [])
if not reports:
    print("No reports found.")
    sys.exit(0)

for r in reports:
    attrs = r['attributes']
    rels = r['relationships']
    program = rels.get('program', {}).get('data', {}).get('attributes', {}).get('handle', '?')
    severity = rels.get('severity', {}).get('data', {}).get('attributes', {})

    print(f"--- REPORT #{r['id']} ---")
    print(f"  Program:  {program}")
    print(f"  Title:    {attrs['title'][:80]}")
    print(f"  State:    {attrs['state'].upper()}")
    print(f"  Severity: {severity.get('rating', '?')} ({severity.get('score', '?')})")
    print(f"  Created:  {attrs['created_at'][:10]}")
    if attrs.get('bounty_awarded_at'):
        print(f"  Bounty:   AWARDED on {attrs['bounty_awarded_at'][:10]}")
    if attrs.get('closed_at'):
        print(f"  Closed:   {attrs['closed_at'][:10]}")
    print()
