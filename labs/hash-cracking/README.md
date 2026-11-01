# Lab hash-cracking

Room: **criptografia-basica** (CS101). 4 niveles de hash cracking.

## Uso
```bash
# Ver challenge 1
curl http://127.0.0.1:18088/challenge/1

# Responder (submit plaintext)
curl "http://127.0.0.1:18088/challenge/1?answer=password"
```

## Niveles
| # | Algoritmo | Password | Herramienta |
|---|---|---|---|
| 1 | MD5 | común | crackstation.net / john |
| 2 | SHA1 | común | john --wordlist |
| 3 | SHA256 | común | hashcat |
| 4 | SHA256 | menos común | rockyou.txt + hashcat |
