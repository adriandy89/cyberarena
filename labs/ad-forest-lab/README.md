# Lab ad-forest-lab

Room: **ad-avanzado** (task adicional, Tier 3). AD avanzado simulado.

## Uso
```bash
cp flags.env.example flags.env
docker compose --env-file flags.env up -d
# http://127.0.0.1:18116
```

| Ataque | Endpoint | Herramienta real equivalente |
|---|---|---|
| Kerberoasting | /kerberoast?spn=svc-backup | Rubeus kerberoast / GetNPUsers + hashcat 13100 |
| LDAP filter injection | /ldap/query?filter=(samAccountName=svc-*) | ldapsearch + wildcard |
| ADCS ESC1 | /adcs/templates → /adcs/enroll?template=CorpWebServer&san=administrator@corp.local | certipy find/req |
| Delegación S4U | /kerberos/s4u?as=administrator&ticket=$krb5tgs$... | Rubeus s4u |
| Trust externo | /trust | Get-ADTrust / sid-history |

Flags: F1 kerberoast, F2 LDAP injection, F3 ESC1 (o S4U), F4 trust.
