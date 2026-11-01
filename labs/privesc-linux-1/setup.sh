#!/bin/sh
# Setup for privesc-linux-1: creates a low-priv user and plants misconfigurations.

# Create user 'student' with no sudo rights
adduser -D -s /bin/sh student 2>/dev/null || true

# FLAG 1: readable only by root — requires SUID escalation
echo "$FLAG_1" > /root/flag1.txt
chmod 600 /root/flag1.txt

# FLAG 2: SUID find binary — student can use find -exec to read it
echo "$FLAG_2" > /home/student/flag2_suid.txt
chmod 600 /home/student/flag2_suid.txt
# Make find SUID root (the privesc vector)
chmod u+s /usr/bin/find

# FLAG 3: sudo misconfig — vim can be run as root without password
echo "$FLAG_3" > /opt/flag3_sudo.txt
chmod 600 /opt/flag3_sudo.txt
# Install sudo and vim if not present
apk add --no-cache sudo vim >/dev/null 2>&1 || true
# Allow student to run vim as root without password
echo "student ALL=(root) NOPASSWD: /usr/bin/vim" >> /etc/sudoers

# FLAG 4: writable cron script that runs as root
echo "$FLAG_4" > /opt/flag4_cron.txt
chmod 600 /opt/flag4_cron.txt
# Create a writable script that cron runs as root
mkdir -p /opt/scripts
cat > /opt/scripts/backup.sh << 'EOF'
#!/bin/sh
# "Backup" script run by cron as root
echo "Backup running..."
# tar czf /tmp/backup.tar.gz /home/student
EOF
chmod 755 /opt/scripts/backup.sh
# Make it writable by student (the vulnerability)
chown student:student /opt/scripts/backup.sh
chmod 777 /opt/scripts/backup.sh
# Add to crontab
echo "* * * * * /opt/scripts/backup.sh" >> /etc/crontabs/root
# Start crond
crond

# Give student a home with a note
echo "Welcome! You are user 'student'. Find 4 flags:
  1. /root/flag1.txt (readable only by root)
  2. /home/student/flag2_suid.txt (SUID binary needed)
  3. /opt/flag3_sudo.txt (sudo misconfig)
  4. /opt/flag4_cron.txt (writable cron script)
" > /home/student/README.txt
chown student:student /home/student/README.txt

echo "Lab ready. Enter with: docker exec -it lab-privesc-linux-1-shell-1 su - student"
sleep infinity
