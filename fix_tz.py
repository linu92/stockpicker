import codecs

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace datetime.now() with (datetime.utcnow() + timedelta(hours=9))
content = content.replace('datetime.now()', '(datetime.utcnow() + timedelta(hours=9))')

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Replaced successfully")
