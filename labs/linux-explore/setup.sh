#!/bin/sh
# Setup for linux-explore: filesystem with secrets to discover.

adduser -D -s /bin/sh explorer 2>/dev/null || true

# FLAG 1: hidden file in home (dotfile — requires ls -la)
echo "$FLAG_1" > /home/explorer/.secret_flag

# FLAG 2: in /etc/passwd comments (requires reading system files)
echo "# Admin note: $FLAG_2" >> /etc/passwd

# FLAG 3: findable by searching for text in files (grep -r)
mkdir -p /var/log/app
echo "Application started successfully" > /var/log/app/app.log
echo "Configuration loaded - secret token: $FLAG_3" >> /var/log/app/app.log

# FLAG 4: readable only by a specific group (requires understanding permissions)
addgroup flagreaders 2>/dev/null || true
adduser explorer flagreaders 2>/dev/null || true
echo "$FLAG_4" > /opt/group_only_flag.txt
chgrp flagreaders /opt/group_only_flag.txt
chmod 440 /opt/group_only_flag.txt

# Welcome file
echo "Welcome, explorer! Find 4 flags hidden in this system:
  1. Hidden dotfile in your home directory
  2. System file with a comment (hint: /etc/)
  3. Application log file (hint: /var/log/)
  4. File readable only by group 'flagreaders' (you are a member)

Commands to try: ls -la, cat, grep -r, find, id
" > /home/explorer/README.txt
chown explorer:explorer /home/explorer/README.txt /home/explorer/.secret_flag

echo "Lab ready. Enter: docker exec -it lab-linux-explore-shell-1 su - explorer"
sleep infinity
