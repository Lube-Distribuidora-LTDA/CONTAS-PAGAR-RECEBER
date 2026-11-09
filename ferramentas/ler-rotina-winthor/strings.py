"""SO LEITURA. Tira do executavel os textos (ANSI e UTF-16) que tem as palavras pedidas.
Uso: python strings.py exe saida.txt PALAVRA1 PALAVRA2 ..."""
import re
import sys

dados = open(sys.argv[1], "rb").read()
palavras = [p.upper() for p in sys.argv[3:]]
achados = []
for m in re.finditer(rb"[\x09\x0a\x0d\x20-\x7e\xa0-\xff]{6,}", dados):
    s = m.group().decode("cp1252", "replace")
    if any(p in s.upper() for p in palavras):
        achados.append((m.start(), "A", s))
for m in re.finditer(rb"(?:[\x09\x0a\x0d\x20-\x7e\xa0-\xff]\x00){6,}", dados):
    s = m.group().decode("utf-16-le", "replace")
    if any(p in s.upper() for p in palavras):
        achados.append((m.start(), "U", s))
achados.sort()
with open(sys.argv[2], "w", encoding="utf-8") as f:
    for pos, t, s in achados:
        f.write(f"[{pos}:{t}] {s}\n")
print(len(achados), "textos")
