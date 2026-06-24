import sys
with open('d:/my_project/StockPicker/app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_else = False
for line in lines:
    if 'chart_source = "전체 종목에서 직접 검색"' in line:
        new_lines.append(line)
        in_else = True
        continue
    
    if in_else:
        if line.startswith('    '):
            new_lines.append(line[4:])
        else:
            new_lines.append(line)
    else:
        new_lines.append(line)

with open('d:/my_project/StockPicker/app.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
