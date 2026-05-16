import os
import re

path = 'src/services/booking-actions.ts'
try:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
except UnicodeDecodeError:
    with open(path, 'r', encoding='latin-1') as f:
        content = f.read()

# Replace the specific lines using regex to match mojibake or real text
# We look for the general pattern of these error returns
content = re.sub(
    r"return \{ error: 'Bu.*?t.*?p.*?ho.*?n.*?th.*?nh.*?' \};", 
    "return { error: 'Unauthorized. Role: ' + (currentUser?.role || 'null') };", 
    content
)

content = re.sub(
    r"return \{ error: 'Kh.*?ng.*?th.*?.*?c.*?p.*?nh.*?t.*?ghi.*?ch.*?.*?' \};", 
    "return { error: 'Unauthorized. Role: ' + (currentUser?.role || 'null') };", 
    content
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
