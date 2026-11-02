# Lab phishing-analysis

Room: **phishing-forensics** (NUEVA, Tier 2). Análisis de emails de phishing.

## Uso
```bash
cp flags.env.example flags.env
docker compose --env-file flags.env up -d
# http://127.0.0.1:18106
```

| Endpoint | Qué da |
|---|---|
| `/emails/*.eml` | 3 emails crudos (2 phishing, 1 legítimo) |
| `/check-spf?domain=X` | Registro SPF del dominio |
| `/verify?origin=&url=&attachment=` | Valida hallazgos → flags |

## Flags
1. Servidor de origen real (Return-Path/Message-ID vs HELO spoofeado)
2. URL de phishing real (href disfrazado de subdominio)
3. Nombre del attachment malicioso
4. SPF `+all` del dominio atacante
