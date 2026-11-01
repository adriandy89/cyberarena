# Lab crypto-puzzle

Room: **criptografia-basica** (task adicional). Decodificación multi-capa.

## Niveles
| # | Encoding | Herramienta | Comando |
|---|---|---|---|
| 1 | base64 | terminal | `echo STRING \| base64 -d` |
| 2 | base64(ROT13) | terminal | `echo STRING \| base64 -d \| tr "A-Za-z" "N-ZA-Mn-za-m"` |
| 3 | base64(XOR) | CyberChef | base64 decode → XOR con key "ctf" |

## Uso
```bash
# Ver challenge
curl http://127.0.0.1:18097/challenge/1

# Responder
curl "http://127.0.0.1:18097/challenge/1?answer=FLAG{...}"
```
