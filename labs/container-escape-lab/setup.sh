#!/bin/sh
# The "misconfiguration" under study: a docker.sock mounted in this container.
# (The daemon behind it is fake-dockerd.py; the technique is identical.)
apk add --no-cache curl python3 >/dev/null 2>&1 || true
python3 /fake-dockerd.py &
sleep 1
exec /bin/sh -c 'sleep infinity'
