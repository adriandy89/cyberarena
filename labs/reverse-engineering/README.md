# Lab reverse-engineering

Room: **reverse-engineering** (NUEVA, Tier 3). Binarios con flags escondidas.

## Uso
```bash
cp flags.env.example flags.env
docker compose --env-file flags.env up -d
# http://127.0.0.1:18111  (level1.sh, level2.py, level3.bin)
```

| Binario | Técnica | Herramientas |
|---|---|---|
| level1.sh | flag en base64 | strings, base64 -d |
| level2.py | blob zlib+base64; correr no revela nada | python (zlib.decompress) |
| level3.bin | ELF con flag XOR 0x5A en .data | xxd/objdump/python xor |
