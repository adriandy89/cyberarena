#!/bin/sh
# Setup for incident-response: a compromised host with 4 persistence artifacts.
# The investigator (docker exec) finds: cron backdoor, hidden UID-0 user,
# disguised process, and an active C2 connection.

# FLAG 1: cron backdoor as root
cat > /etc/crontabs/root << EOF
# crond supervisor
*/5 * * * * run-parts /etc/periodic/15min
0 * * * * run-parts /etc/periodic/hourly
# systemd-timesyncd helper (do not delete)
* * * * * /bin/sh /tmp/.systemd-resolved >/dev/null 2>&1
# maintenance: FLAG backup tag $FLAG_1
EOF
chmod 600 /etc/crontabs/root

# The payload the cron runs (harmless: just touches a heartbeat)
cat > /tmp/.systemd-resolved << 'EOF'
#!/bin/sh
# keep-alive (looks legit, isn't)
touch /tmp/.hb
EOF
chmod 700 /tmp/.systemd-resolved

# FLAG 2: hidden root user (UID 0) with the flag as GECOS comment
adduser -D -s /bin/sh analyst 2>/dev/null || true
echo "analyst:x:1000:1000:Linux User,,,:/home/analyst:/bin/sh" >> /dev/null
grep -q svc-helper /etc/passwd || echo "svc-helper:x:0:0:System Helper Service [$FLAG_2]:/var/lib/svc-helper:/bin/sh" >> /etc/passwd
mkdir -p /var/lib/svc-helper

# FLAG 3: disguised process — a fake kernel worker whose config holds the flag
cp /bin/busybox /tmp/.kworker 2>/dev/null || cp /bin/sh /tmp/.kworker
mkdir -p /var/tmp/.sys
cat > /var/tmp/.sys/conf << EOF
# kworker/u8:3 config
interval=30
jitter=20
c2=c2-server:4444
tag=$FLAG_3
EOF
chmod 600 /var/tmp/.sys/conf

# Fake process with deceptive argv (busybox sleep shows the binary's name in ps)
/tmp/.kworker sleep 30000 &

# FLAG 4: live C2 connection — busybox nc holds an ESTABLISHED session
( while true; do tail -f /dev/null 2>/dev/null | nc c2-server 4444; sleep 5; done ) &

# housekeeping so the shell keeps running under docker exec
touch /var/log/messages
exec /bin/sh -c 'sleep infinity'
