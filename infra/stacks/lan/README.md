# Despliegue en la LAN (fase 013)

CyberArena completo (Postgres + api + web + lab-runner) en un servidor de tu red, accesible desde cualquier
navegador de la LAN en `http://<IP-del-servidor>:<WEB_PORT>` (por defecto 3080). Un solo proyecto Docker
(`cyberarena-prod`) con sus propias redes y sin proxy inverso: la web se publica directamente en su
puerto y reenvía `/api` a la api por la red interna del proyecto.

## Estructura en el servidor

```
~/cyberarena/
├── repo/                  # git clone — NO se modifica nunca (solo git pull)
└── stack/                 # todo lo propio del servidor
    ├── cyberarena.sh -> ../repo/infra/stacks/lan/cyberarena.sh
    ├── .env               # IP, puerto, política de labs (cyberarena.sh init)
    ├── secrets/           # contraseñas y tokens (carpeta 700, ficheros 644)
    ├── lab-flags/         # flags de los labs para el runner
    └── backups/           # volcados de la BD
```

## Primer despliegue

```bash
mkdir -p ~/cyberarena/stack
git clone https://github.com/adriandy89/tryhackme.git ~/cyberarena/repo
ln -s ~/cyberarena/repo/infra/stacks/lan/cyberarena.sh ~/cyberarena/stack/cyberarena.sh
cd ~/cyberarena/stack
./cyberarena.sh init          # detecta la IP de la LAN; o: ./cyberarena.sh init 192.168.1.20
./cyberarena.sh up            # build + arranque (espera a healthy) + carga del contenido
```

`init` muestra **una vez** la contraseña del admin inicial (`admin@cyberarena.local`); también queda en
`secrets/bootstrap_admin_password`. Nunca sobrescribe secretos existentes.

¿Otro puerto? Cambia `WEB_PORT` y el puerto de `WEB_ORIGIN` en `.env` y ejecuta `./cyberarena.sh up`.

## Día a día

| Comando | Qué hace |
|---|---|
| `./cyberarena.sh update` | `git pull --ff-only` en el clon, regenera flags, rebuild + up + seed |
| `./cyberarena.sh ps` / `logs [servicio]` | Estado y logs |
| `./cyberarena.sh down` | Para y quita los contenedores (los datos se conservan) |
| `./cyberarena.sh backup` | Volcado de la BD en `stack/backups/` (rotación 14 días) |
| `./cyberarena.sh labs ls` | Labs en marcha y su plazo (`labs down-all` = parada de emergencia) |
| `./cyberarena.sh destroy` | Borra contenedores **y datos** (pide confirmación) |

## Labs en la LAN

Con `LAB_BIND_ADDRESS=<IP>` (lo pone `init`) los labs que arranca la web publican sus puertos en la IP de
la LAN y los comandos de las tareas (`curl http://127.0.0.1:18081/...`) se muestran ya con esa IP. Mientras
un lab está encendido, cualquier equipo de tu red puede alcanzarlo (son apps vulnerables a propósito); se
apagan solos a los 10 min sin la página abierta. Para dejarlos solo en el servidor:
`LAB_BIND_ADDRESS=127.0.0.1` y `LAB_PUBLIC_HOST=` en `.env`, y `./cyberarena.sh up`.

Los labs de terminal (`docker exec …`) se usan desde una sesión SSH en el servidor.

## Notas

- Sin HTTPS: pensado para tu LAN. Las contraseñas viajan en claro por la red local.
- Un solo lab-runner por host Docker (si tienes otro CyberArena en la misma máquina, páralo).
- Puertos que usa: `WEB_PORT` (3080) y, solo mientras estén encendidos, los de los labs (18080–18116,
  18153/udp, 18180/18443/18844, 28021–28901). Postgres no publica ninguno: se opera con `docker exec`.
- Más detalle: `docs/runbook.md` (producción y labs bajo demanda).
