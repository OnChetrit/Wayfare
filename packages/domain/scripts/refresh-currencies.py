#!/usr/bin/env python3
"""Refresh the bundled ISO 4217 catalog from SIX (requires network only at refresh time)."""
import json
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET

url = 'https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml'
root = ET.fromstring(urllib.request.urlopen(url, timeout=60).read())
# Funds, units of account, testing/no-currency codes, and precious metals are not money entry options.
excluded = {'BOV', 'CHE', 'CHW', 'CLF', 'COU', 'MXV', 'USN', 'UYI', 'UYW', 'XAD', 'XAG', 'XAU', 'XBA', 'XBB', 'XBC', 'XBD', 'XDR', 'XPD', 'XPT', 'XSU', 'XTS', 'XUA', 'XXX'}
path = Path(__file__).resolve().parents[1] / 'src/currency-catalog.json'
previous = json.loads(path.read_text())['currencies'] if path.exists() else []
entries = {}
for row in root.findall('.//CcyNtry'):
    code, digits = row.findtext('Ccy'), row.findtext('CcyMnrUnts')
    if code and code not in excluded and digits and digits.isdigit():
        entries[code] = {'code': code, 'name': row.findtext('CcyNm'), 'digits': int(digits), 'active': True}
for row in previous:
    if row['code'] not in entries:
        entries[row['code']] = {**row, 'active': False}
path.write_text(json.dumps({'version': root.attrib['Pblshd'], 'source': url, 'currencies': sorted(entries.values(), key=lambda row: row['code'])}, indent=2) + '\n')
