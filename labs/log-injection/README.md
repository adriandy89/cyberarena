# Lab log-injection
Room: **log-forging** (NUEVA). CRLF, XSS via logs, log poisoning.
| Ataque | URL |
|---|---|
| CRLF | /feedback?msg=hello%0d%0a[SUCCESS] Admin logged in |
| XSS | /feedback?msg=<script>alert(1)</script> → luego /logs |
| Poisoning | /feedback?msg=../../../etc/passwd |
