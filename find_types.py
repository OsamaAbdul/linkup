import re

sql_file = "c:/Users/HomePC/Desktop/linkup-marketplace/supabase/comprehensive_schema_20260309.sql"

with open(sql_file, 'r', encoding='utf-8') as f:
    text = f.read()

# Find CREATE TYPE statements. They look like: CREATE TYPE something AS ENUM (...);
# Let's find all CREATE TYPE ... ; and see what surrounds them.
pattern = re.compile(r'(?i)(CREATE\s+TYPE\s+[^;]+;)')

matches = pattern.finditer(text)
for m in matches:
    start = m.start()
    # Print 50 chars before and the match
    context_start = max(0, start - 100)
    print("MATCH AT INDEX", start)
    print("--- CONTEXT ---")
    print(text[context_start:start + len(m.group(0))])
    print("---------------\n")
