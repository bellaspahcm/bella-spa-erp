import os
path = 'src/services/booking-actions.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "return { error: 'Unauthorized. Role: ' + (currentUser?.role || 'null') };",
    "return { error: `DEBUG: ID: ${currentUser?.id || 'null'}, Role: ${currentUser?.role || 'null'}, Email: ${currentUser?.email || 'null'}` };"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
