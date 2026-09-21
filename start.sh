#!/bin/bash

# ============================================
# K-Flow Start Script (Termux + PM2 + tmux)
# ============================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

cd ~/k-flow 2>/dev/null || cd "$(dirname "$0")"

# Ambil IP wlan0 (WiFi lokal). Jangan pakai IP pertama generik
# karena bisa dapat IP mobile data (rmnet_data, 10.x) yang tidak
# reachable dari PC satu WiFi.
get_wlan_ip() {
    local ip=""
    # Prioritas 0: Android system property (works tanpa root, anti Permission denied)
    # `ip addr` diblokir di Android 10+, getprop selalu bisa dibaca.
    if command -v getprop >/dev/null 2>&1; then
        ip=$(getprop dhcp.wlan0.ipaddress 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1)
        if [ -n "$ip" ]; then echo "$ip"; return 0; fi
    fi
    # Prioritas 1: termux-api wifi info (kalau terinstall)
    if command -v termux-wifi-connectioninfo >/dev/null 2>&1; then
        ip=$(termux-wifi-connectioninfo 2>/dev/null | grep -oE '"ip"[[:space:]]*:[[:space:]]*"[^"]+"' | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1)
        if [ -n "$ip" ] && [ "$ip" != "0.0.0.0" ]; then echo "$ip"; return 0; fi
    fi
    # Prioritas 2: IP 192.168.x di wlan0 (satu subnet dengan PC umumnya)
    ip=$(ip -4 addr show wlan0 2>/dev/null | grep -oE '192\.168\.[0-9]{1,3}\.[0-9]{1,3}' | head -1)
    if [ -n "$ip" ]; then echo "$ip"; return 0; fi
    # Prioritas 3: IP apa saja di wlan0
    ip=$(ip -4 addr show wlan0 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | grep -v '255\.' | head -1)
    if [ -n "$ip" ]; then echo "$ip"; return 0; fi
    # Prioritas 4: ifconfig wlan0 spesifik (kalau paket iproute2 tidak ada)
    ip=$(ifconfig wlan0 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | grep -v '255\.' | head -1)
    if [ -n "$ip" ]; then echo "$ip"; return 0; fi
    # Prioritas 5: IP 192.168.x dari ifconfig SEMUA interface.
    # Penting: `ifconfig wlan0` ber-argumen kadang kosong di sebagian device,
    # tapi `ifconfig` polos jalan — ambil yang satu subnet LAN dulu supaya
    # tidak dapat IP mobile data (rmnet_data, 10.x).
    ip=$(ifconfig 2>/dev/null | grep -oE '192\.168\.[0-9]{1,3}\.[0-9]{1,3}' | head -1)
    if [ -n "$ip" ]; then echo "$ip"; return 0; fi
    # Prioritas 6: source IP untuk route ke LAN 192.168.1.x
    ip=$(ip -4 route get 192.168.1.1 2>/dev/null | grep -oE 'src ([0-9]{1,3}\.){3}[0-9]{1,3}' | awk '{print $2}' | head -1)
    if [ -n "$ip" ]; then echo "$ip"; return 0; fi
    # Fallback terakhir: IP apa saja selain loopback (bisa IP mobile data)
    ip=$(ifconfig 2>/dev/null | grep -oE 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | awk '{print $2}' | head -1)
    echo "$ip"
}

# Tampilkan semua IP untuk debug (biar ketahuan kalau beda subnet)
# NOTE: `ip addr` diblokir Android 10+ (Permission denied), jadi pakai
# getprop/ifconfig yang tidak butuh netlink.
show_all_ips() {
    echo -e "${YELLOW}Semua IP HP:${NC}"
    if command -v getprop >/dev/null 2>&1; then
        echo "wlan0 (getprop): $(getprop dhcp.wlan0.ipaddress 2>/dev/null || echo '?')"
        echo "gateway (getprop): $(getprop dhcp.wlan0.gateway 2>/dev/null || echo '?')"
    fi
    if command -v ifconfig >/dev/null 2>&1; then
        ifconfig wlan0 2>&1 | head -10
        echo "---"
        ifconfig 2>&1 | grep -E '^[a-z]|inet ' | head -20
    else
        echo "(ifconfig tidak tersedia, install: pkg install net-tools)"
    fi
    if command -v termux-wifi-connectioninfo >/dev/null 2>&1; then
        echo -e "${YELLOW}WiFi info:${NC}"
        termux-wifi-connectioninfo 2>&1 | head -20
    else
        echo "(tip: pkg install termux-api + install Termux:API apk untuk info WiFi akurat)"
    fi
}

# ============================================
# START MYSQL (MariaDB)
# ============================================
if ! pgrep -x mysqld > /dev/null 2>&1 && ! pgrep -x mariadbd > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting MariaDB...${NC}"
    mysqld_safe &
    sleep 3
    for i in {1..15}; do
        if mysqladmin ping -u root --silent 2>/dev/null; then
            echo -e "${GREEN}MariaDB running${NC}"
            break
        fi
        sleep 1
    done
else
    echo -e "${GREEN}MariaDB already running${NC}"
fi

# ============================================
# START SSH SERVER
# ============================================
if ! pgrep -x sshd > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting SSH server...${NC}"
    sshd
    echo -e "${GREEN}SSH running on port 8022${NC}"
fi

# ============================================
# START 9ROUTER (AI API Proxy via tmux)
# ============================================
if curl -s http://localhost:20128/v1/models > /dev/null 2>&1; then
    echo -e "${GREEN}9router already running${NC}"
else
    echo -e "${YELLOW}Starting 9router in tmux...${NC}"
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    tmux new-session -d -s router "bash ${SCRIPT_DIR}/start-router.sh"
    sleep 3
    for i in {1..10}; do
        if curl -s http://localhost:20128/v1/models > /dev/null 2>&1; then
            echo -e "${GREEN}9router running on port 20128${NC}"
            break
        fi
        sleep 1
    done
fi

# ============================================
# START BOT (PM2 or tmux)
# ============================================

# Kalau sudah ada di tmux, jalanin langsung
if [ -n "$TMUX" ]; then
    echo -e "${CYAN}Inside tmux session — starting bot...${NC}"
    pm2 flush k-flow 2>/dev/null
    if pm2 list 2>/dev/null | grep -q "k-flow"; then
        pm2 restart k-flow
    else
        pm2 start app.js --name "k-flow" --max-memory-restart 300M --node-args="--max-old-space-size=256"
        pm2 save
    fi
    echo ""
    echo -e "${GREEN}Bot berjalan di PM2!${NC}"
    echo -e "Lihat log: ${CYAN}pm2 logs k-flow${NC}"
    echo -e "Dashboard: ${CYAN}http://localhost:3000${NC}"
    echo ""
    # Tampilkan IP
    WLAN_IP=$(get_wlan_ip)
    if [ -n "$WLAN_IP" ]; then
        echo -e "SSH dari PC: ${CYAN}ssh $(whoami)@$WLAN_IP -p 8022${NC}"
        # Warning kalau HP dan PC beda subnet (misal HP 10.x, PC 192.168.1.x)
        case "$WLAN_IP" in
            192.168.1.*) ;;
            *) echo -e "${YELLOW}WARNING: IP HP ($WLAN_IP) beda subnet dengan PC (192.168.1.x). Pastikan satu WiFi yang sama, atau pakai Tailscale.${NC}" ;;
        esac
    fi
    show_all_ips
    echo ""
    return 2>/dev/null || exit 0
fi

# Kalau belum di tmux, bikin session baru
if command -v tmux &>/dev/null; then
    echo -e "${CYAN}Creating tmux session...${NC}"

    # Kalau session "bot" sudah ada, attach aja
    if tmux has-session -t bot 2>/dev/null; then
        echo -e "${YELLOW}Session 'bot' exists. Attaching...${NC}"
        echo -e "Log out dengan: ${CYAN}Ctrl+B lalu d${NC}"
        echo ""
        tmux attach -t bot
    else
        echo -e "${CYAN}Starting bot in new tmux session...${NC}"
        tmux new-session -d -s bot "cd ~/k-flow 2>/dev/null || cd '$(pwd)'; bash start.sh"
        echo -e "${GREEN}Bot started in tmux session 'bot'!${NC}"
        echo ""
        echo -e "Attach ke session:"
        echo -e "  ${CYAN}tmux attach -t bot${NC}"
        echo ""
        echo -e "Log out dari tmux (bot tetap jalan):"
        echo -e "  ${CYAN}Ctrl+B lalu d${NC}"
        echo ""
        # Tampilkan IP wlan0
        WLAN_IP=$(get_wlan_ip)
        if [ -n "$WLAN_IP" ]; then
            echo -e "SSH dari PC: ${CYAN}ssh $(whoami)@$WLAN_IP -p 8022${NC}"
            case "$WLAN_IP" in
                192.168.1.*) ;;
                *) echo -e "${YELLOW}WARNING: IP HP ($WLAN_IP) beda subnet dengan PC (192.168.1.x). Pastikan satu WiFi yang sama, atau pakai Tailscale.${NC}" ;;
            esac
        fi
        show_all_ips
        echo ""
    fi
else
    # Fallback tanpa tmux
    echo -e "${YELLOW}tmux not found. Starting directly...${NC}"
    pm2 flush k-flow 2>/dev/null
    if pm2 list 2>/dev/null | grep -q "k-flow"; then
        pm2 restart k-flow
    else
        pm2 start app.js --name "k-flow" --max-memory-restart 300M --node-args="--max-old-space-size=256"
        pm2 save
    fi
    echo ""
    echo -e "${GREEN}Bot berjalan di PM2!${NC}"
    echo -e "Lihat log: ${CYAN}pm2 logs k-flow${NC}"
    echo -e "Dashboard: ${CYAN}http://localhost:3000${NC}"
    echo ""
fi
