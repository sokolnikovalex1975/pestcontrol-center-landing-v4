#!/bin/bash
# Скрипт выкладки по FTP (28.10.2026: ускоренная версия и отложенные счётчики).
# Запуск — в «Терминале» на Mac: в песочнице Perplexity нет доступа к сети.
# Рядом со скриптом должны лежать pkg/ (файлы для сайта), MANIFEST.sha256 (shasum -a 256 по pkg/)
# и временный .netrc с доступом FTP (chmod 600, удаляется в режимах deploy и cleanup).
# Для новой выкладки задайте NAME, BK, ORDER, REPLACED и EXPECTED_BEFORE в deploy.conf.
# Работает с curl и bash 3.2 (macOS).
#   bash run_all.sh check     — подключение и список файлов
#   bash run_all.sh backup    — копия заменяемых файлов (REPLACED) + сверка с EXPECTED_BEFORE
#   bash run_all.sh upload    — загрузка файлов (ORDER) + сверка (только после backup)
#   bash run_all.sh deploy    — backup + upload одним запуском
#   bash run_all.sh rollback  — вернуть прежние файлы из копии
#   bash run_all.sh cleanup   — удалить временный .netrc и архив
set -u
D="$(cd "$(dirname "$0")" && pwd)"
cd "$D" || exit 1
MODE="${1:-check}"
NAME="pestcontrol-deploy-2026-10-28"
BK="before-perf_2026-10-28_ftp.zip"
ORDER="fonts/inter-ru-wght-normal.woff2 fonts/inter-ru-wght-italic.woff2
img/step1-720.webp img/step2-720.webp img/step4-720.webp
img/ind-bakery-720.webp img/ind-retail-720.webp img/ind-kitchen-720.webp
img/ind-warehouse-720.webp img/ind-pharma-720.webp img/ind-hotel-room-720.webp
img/case-food-720.webp img/case-hotel-720.webp
app.min.js index.php legal.css privacy/index.php soglasie/index.php style.css app.js"
REPLACED="index.php style.css app.js legal.css privacy/index.php soglasie/index.php"
# sha256 текущих (до выкладки) файлов, как их отдаёт сайт 28.10.2026
EXPECTED_BEFORE="0fa368bb3227ffd96f0f85c6e52b365643c17e2306dcb1cb9df3dd033247a369  index.php
5b45860ec0353760f4a81212d203aa60214581413137b9d922b0c334af8c1aab  style.css
1be7bd7fa7b6226738b71768a3174788a408eea2119133fc6a6c65edb096c74a  app.js
13a2217a20dd9ac913fe0ee3e0c4ff03d958aeeb66765efe14b3a03633729443  legal.css
6278e66ce7064fc518cc74e784154ba976b8d3493ed1dffdebe36cb78c3ba386  privacy/index.php
4f12209f6186e8b694e5fe0371dd5faa1c295a5689dd12e15d1afec500589e35  soglasie/index.php"

# Списки файлов и ожидаемые суммы для конкретной выкладки можно задать в deploy.conf рядом со скриптом
[ -f "$D/deploy.conf" ] && . "$D/deploy.conf"
KEEP="$HOME/$NAME"
HOST="${FTP_HOST:-vh402.timeweb.ru}"
NETRC="$D/.netrc"
LOG="$D/deploy.log"
TLS=""
SITE=""
exec > >(tee -a "$LOG") 2>&1

keep_copy() {
  mkdir -p "$KEEP"
  [ -f "$BK" ] && cp -p "$BK" "$KEEP/"
  [ -d backup ] && rm -rf "$KEEP/backup" && cp -Rp backup "$KEEP/backup"
  cp -p run_all.sh MANIFEST.sha256 "$KEEP/" 2>/dev/null
  cp -p "$LOG" "$KEEP/deploy.log" 2>/dev/null
}
finish() {
  rc=$?
  if [ "$MODE" = deploy ] || [ "$MODE" = cleanup ]; then
    rm -P "$NETRC" 2>/dev/null || rm -f "$NETRC"
    rm -f "/tmp/$NAME.zip" .tls .site .gate_ok
    echo "== netrc removed"
  fi
  keep_copy
  echo "== backup and log kept in: $KEEP"
  echo "== EXIT CODE $rc"
}
trap finish EXIT

echo "== $(date '+%Y-%m-%d %H:%M:%S %Z') mode=$MODE host=$HOST"
[ "$MODE" = cleanup ] && exit 0
[ -f "$NETRC" ] || { echo "ERROR: .netrc not found"; exit 10; }
chmod 600 "$NETRC"

u() { if [ -n "$SITE" ]; then echo "ftp://$HOST/$SITE/$1"; else echo "ftp://$HOST/$1"; fi; }
c() { curl -sS --netrc-file "$NETRC" $TLS --connect-timeout 20 --max-time 120 "$@"; }


# 1. Подключение (FTP с TLS, потом без него); выбранный режим запоминается
connect() {
  if [ -f .tls ]; then
    TLS="$(cat .tls)"
    ROOTLIST=$(c --list-only "ftp://$HOST/" 2>&1) || { echo "ERROR: FTP connection failed [${TLS:-none}]: $(echo "$ROOTLIST" | tail -1)"; exit 11; }
  else
    ok=0
    for opts in "--ssl-reqd" "--ssl-reqd -k" ""; do
      TLS="$opts"
      ROOTLIST=$(c --list-only "ftp://$HOST/" 2>&1); rc=$?
      echo "probe opts=[$opts] rc=$rc"
      if [ $rc -eq 0 ]; then ok=1; break; else echo "$ROOTLIST" | tail -1; fi
    done
    [ $ok = 1 ] || { echo "ERROR: FTP connection failed"; exit 11; }
    printf '%s' "$TLS" > .tls
  fi
  ROOTLIST=$(echo "$ROOTLIST" | tr -d '\r' | sed 's|.*/||')
  echo "== connected, TLS opts: [${TLS:-none}]"
}
has_site() { echo "$1" | grep -qx 'index.php' && echo "$1" | grep -qx 'send.php'; }
detect_site() {
  PH=$(c --list-only "ftp://$HOST/public_html/" 2>/dev/null | tr -d '\r' | sed 's|.*/||')
  if has_site "$PH"; then SITE="public_html"
  elif has_site "$ROOTLIST"; then SITE=""
  else echo "ERROR: site folder with index.php and send.php not found"; echo "root: $(echo $ROOTLIST)"; echo "public_html: $(echo $PH)"; exit 12; fi
  echo "== site folder: /${SITE}"
}
rollback_now() {
  echo "!! rolling back replaced files"
  for f in $REPLACED; do c -T "backup/$f" "$(u "$f")" && echo "restored $f" || echo "FAIL restore $f"; done
}
do_backup() {
  rm -f .gate_ok
  for f in $REPLACED; do mkdir -p "backup/$(dirname "$f")"; done
  for f in $REPLACED; do
    if c -o "backup/$f" "$(u "$f")"; then echo "backup ok $f $(wc -c < "backup/$f" | tr -d ' ')"; else echo "ERROR: backup failed $f"; exit 13; fi
  done
  rm -f "$BK"
  (cd backup && zip -q -r -X "../$BK" .) && echo "backup zip: $(wc -c < "$BK" | tr -d ' ') bytes"
  keep_copy
  echo "--- php tags in backup:"; for f in $REPLACED; do case "$f" in *.php) echo "backup/$f: $(grep -c '<?' "backup/$f")";; esac; done
  if ! (cd backup && echo "$EXPECTED_BEFORE" | shasum -a 256 -c -); then
    if [ "${FORCE:-0}" != 1 ]; then echo "ERROR: server files differ from the analysed version, upload cancelled"; exit 14; fi
    echo "WARNING: differences ignored (FORCE=1)"
  fi
  touch .gate_ok
  echo "== BACKUP OK, gate passed"
}
do_upload() {
  [ -f .gate_ok ] || { echo "ERROR: run backup first"; exit 18; }
  for f in $REPLACED; do [ -s "backup/$f" ] || { echo "ERROR: backup/$f missing"; exit 18; }; done
  (cd pkg && shasum -a 256 -c ../MANIFEST.sha256 > /dev/null) || { echo "ERROR: package checksum mismatch"; exit 15; }
  echo "== package checksums OK"
  for f in $ORDER; do
    if c --ftp-create-dirs -T "pkg/$f" "$(u "$f")"; then echo "up $f"; else echo "ERROR: upload failed $f"; rollback_now; exit 16; fi
  done
  rm -rf verify && mkdir -p verify
  for f in $ORDER; do mkdir -p "verify/$(dirname "$f")"; c -o "verify/$f" "$(u "$f")" || echo "verify download failed $f"; done
  if (cd verify && shasum -a 256 -c ../MANIFEST.sha256 > ../verify.txt 2>&1); then
    echo "== VERIFY OK: all $(wc -l < MANIFEST.sha256 | tr -d ' ') files on server match the package"
  else
    grep -v ': OK' verify.txt; echo "ERROR: verify mismatch"; rollback_now; exit 17
  fi
  rm -f .gate_ok
  echo "== DEPLOY DONE"
}

connect
detect_site
case "$MODE" in
  check)
    echo "--- LIST site:"; c "$(u '')" | tr -d '\r'
    for sub in fonts img privacy soglasie; do echo "--- LIST $sub/:"; c "$(u "$sub/")" | tr -d '\r' | head -60; done
    ;;
  backup) do_backup ;;
  upload) do_upload ;;
  deploy) do_backup; do_upload ;;
  rollback)
    for f in $REPLACED; do [ -s "backup/$f" ] || { echo "ERROR: backup/$f missing"; exit 18; }; done
    for f in $REPLACED; do c -T "backup/$f" "$(u "$f")" && echo "restored $f" || echo "FAIL restore $f"; done
    ;;
  *) echo "usage: $0 check|backup|upload|deploy|rollback|cleanup"; exit 2 ;;
esac
exit 0
