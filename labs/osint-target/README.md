# Lab osint-target

Room: **recon-pasivo-osint** (JrPT). Fake company "TechCorp" con información oculta.

## Dónde buscar
| Flag | Escondida en | Técnica |
|---|---|---|
| FLAG_1 | robots.txt | `curl /robots.txt` |
| FLAG_2 | Comment HTML en /about | Ver código fuente (Ctrl+U) |
| FLAG_3 | .env accesible | `curl /.env` |
| FLAG_4 | /admin/panel (hint en comment) | Leer HTML comments del home |

## Otra info a descubrir
- Emails de empleados en /about (incl. contractor)
- Staging server mencionado en HTML comment
- WordPress 6.4 en meta generator
- Old site en /old-site
