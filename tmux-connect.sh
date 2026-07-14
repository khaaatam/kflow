#!/bin/bash
# ============================================
# K-Flow tmux Connect (Linux/Mac PC)
# ============================================
#
# Cara pakai:
#   1. Copy file ini ke /usr/local/bin/tmux-connect
#      sudo cp tmux-connect.sh /usr/local/bin/tmux-connect
#      sudo chmod +x /usr/local/bin/tmux-connect
#
#   2. Tambah alias di ~/.bashrc:
#      alias tmux='bash /usr/local/bin/tmux-connect.sh'
#
#   3. Buka terminal baru, ketik: tmux
#

# Ganti IP ini dengan IP Termux kamu
# Cek IP di Termux: ifconfig
TERMUX_IP="192.168.1.100"
TERMUX_PORT=8022

echo "Connecting to Termux ($TERMUX_IP:$TERMUX_PORT)..."
echo ""

ssh "$TERMUX_IP" -p "$TERMUX_PORT" -t "tmux attach -t bot || tmux new -s bot"

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Gagal connect. Pastikan:"
    echo "  1. Termux sudah jalan"
    echo "  2. SSH server aktif (ketik 'sshd' di Termux)"
    echo "  3. IP benar (cek dengan 'ifconfig' di Termux)"
    echo "  4. HP dan PC di WiFi yang sama"
    echo ""
fi
