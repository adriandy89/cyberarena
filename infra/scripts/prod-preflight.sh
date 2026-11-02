#!/usr/bin/env bash
# Checks before bringing up the production stack (phase 012). Never prints a
# secret value: only pass/fail per check. Run from the repo root:
#   bash infra/scripts/prod-preflight.sh
set -uo pipefail

PROD=infra/stacks/prod
PROXY=infra/stacks/proxy
fail=0
ok() { printf '  ok    %s\n' "$1"; }
bad() { printf '  FAIL  %s\n' "$1"; fail=1; }

echo "env files"
for f in "$PROXY/.env" "$PROD/.env"; do
  [ -s "$f" ] && ok "$f" || bad "$f missing (copy it from .env.example)"
done

echo "secrets ($PROD/secrets)"
for name in postgres_password better_auth_secret bootstrap_admin_password lab_runner_token; do
  f="$PROD/secrets/$name"
  if [ ! -s "$f" ]; then bad "$name missing or empty (see secrets/README.md)"; continue; fi
  # Count bytes: Git Bash's grep hides a CR that comes right before LF.
  if [ "$(tr -cd '\r' < "$f" | wc -c | tr -d ' ')" != 0 ]; then bad "$name contains a carriage return (fix: tr -d '\\r' < $f > $f.tmp && mv $f.tmp $f)"; continue; fi
  value_len=$(tr -d '\n' < "$f" | wc -c | tr -d ' ')
  case "$name" in
    postgres_password)
      if tr -d '\n' < "$f" | grep -q '[^A-Za-z0-9]'; then bad "$name must be alphanumeric (it goes into a URL)"; else ok "$name"; fi ;;
    better_auth_secret | lab_runner_token)
      if [ "$value_len" -lt 32 ]; then bad "$name needs 32+ characters"; else ok "$name"; fi ;;
    *) ok "$name" ;;
  esac
done

echo "lab flags ($PROD/lab-flags)"
labs=$(find labs -mindepth 2 -maxdepth 2 -name compose.yaml -not -path 'labs/_*' | wc -l | tr -d ' ')
flags=$(find "$PROD/lab-flags" -name '*.env' 2>/dev/null | wc -l | tr -d ' ')
[ "$flags" -ge "$labs" ] && ok "$flags flag files for $labs labs" \
  || bad "$flags flag files for $labs labs (run: bash infra/scripts/lab-flags.sh $PROD/lab-flags)"

echo "host ports (free unless our stacks already use them)"
for port in 80 443 5433; do
  owner=$(docker ps --format '{{.Names}} {{.Ports}}' | grep -E "(0\.0\.0\.0|127\.0\.0\.1|\[::\]):$port->" | awk '{print $1}' | head -1)
  if [ -z "$owner" ]; then
    if node -e "const s=require('net').createServer();s.once('error',()=>process.exit(1));s.listen($port,'0.0.0.0',()=>s.close(()=>process.exit(0)))"; then
      ok "port $port free"
    else
      bad "port $port in use by another process"
    fi
  elif [[ "$owner" == cyberarena-p* ]]; then
    ok "port $port used by $owner"
  else
    bad "port $port used by container $owner"
  fi
done

echo "docker"
engine=$(docker version --format '{{.Server.Version}}' 2>/dev/null)
compose=$(docker compose version --short 2>/dev/null)
node -e "
const [e,c]=process.argv.slice(1).map(v=>v.replace(/^v/,'').split(/[-+]/)[0].split('.').map(Number));
const ge=(a,b)=>{for(let i=0;i<b.length;i++){if((a[i]??0)!==b[i])return (a[i]??0)>b[i]}return true};
process.exit(ge(e,[26,0,0])&&ge(c,[2,24,4])?0:1)" "$engine" "$compose" \
  && ok "engine $engine, compose $compose" || bad "needs Docker Engine >= 26 and Compose >= 2.24.4 (have $engine / $compose)"

[ "$fail" = 0 ] && echo "preflight OK" || echo "preflight FAILED"
exit "$fail"
