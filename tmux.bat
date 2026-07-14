@echo off
REM ============================================
REM K-Flow tmux Connect (PC)
REM ============================================
REM
REM Cara pakai:
REM   1. Copy file ini ke folder yang ada di PATH Windows
REM      (contoh: C:\Users\NamaLo\bin\)
REM   2. Buka terminal, ketik: tmux
REM
REM Atau langsung jalankan:
REM   .\tmux.bat
REM

REM Ganti IP ini dengan IP Termux kamu
REM Cek IP di Termux: ifconfig
set TERMUX_IP=192.168.1.35
set TERMUX_PORT=8022

echo Connecting to Termux (%TERMUX_IP%:%TERMUX_PORT%)...
echo.

ssh %TERMUX_IP% -p %TERMUX_PORT% -t "tmux attach -t bot || tmux new -s bot"

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Gagal connect. Pastikan:
    echo   1. Termux sudah jalan
    echo   2. SSH server aktif (ketik 'sshd' di Termux)
    echo   3. IP benar (cek dengan 'ifconfig' di Termux)
    echo   4. HP dan PC di WiFi yang sama
    echo.
    pause
)
