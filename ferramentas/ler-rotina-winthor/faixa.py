"""SO LEITURA. Todos os textos UTF-16 (>= 3 letras) de uma faixa de bytes do executavel, na ordem.
Uso: python faixa.py exe inicio fim saida"""
import re
import sys

dados = open(sys.argv[1], "rb").read()
a, b = int(sys.argv[2]), int(sys.argv[3])
pedaco = dados[a:b]
out = []
for m in re.finditer(rb"(?:[\x09\x0a\x0d\x20-\x7e\xa0-\xff]\x00){3,}", pedaco):
    out.append(f"[{a + m.start()}] " + m.group().decode("utf-16-le", "replace").rstrip())
open(sys.argv[4], "w", encoding="utf-8").write("\n".join(out))
print(len(out), "textos")
