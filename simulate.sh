#!/bin/sh
# Serve the app locally and open it in simulation mode.
# Usage: ./simulate.sh [-38.04,144.47 | YMAV] [alt_ft] [track_degM] [gs_kt]
POS=${1:-YMAV}; ALT=${2:-1500}; TRK=${3:-}; GS=${4:-0}
cd "$(dirname "$0")/app"
URL="http://localhost:8765/index.html?sim=$POS&alt=$ALT&trk=$TRK&gs=$GS"
echo "Open: $URL   (Ctrl+C to stop)"
( sleep 1; (command -v open >/dev/null && open "$URL") || (command -v xdg-open >/dev/null && xdg-open "$URL") ) &
python3 -m http.server 8765
