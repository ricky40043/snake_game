#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.dev-pids"
LOG_DIR="$ROOT_DIR/.dev-logs"

BACKEND_PID="$PID_DIR/backend.pid"
FRONTEND_PID="$PID_DIR/frontend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
PORTS=(3001 5173 5174)

mkdir -p "$PID_DIR" "$LOG_DIR"

is_running() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

start_one() {
  local name="$1"
  local pid_file="$2"
  local log_file="$3"
  shift 3

  if is_running "$pid_file"; then
    echo "$name already running (pid $(cat "$pid_file"))"
    return
  fi

  echo "Starting $name..."
  (
    cd "$ROOT_DIR"
    nohup "$@" > "$log_file" 2>&1 &
    echo $! > "$pid_file"
  )
  sleep 1

  if is_running "$pid_file"; then
    echo "$name started (pid $(cat "$pid_file"))"
  else
    echo "$name failed to start. See $log_file"
    return 1
  fi
}

stop_one() {
  local name="$1"
  local pid_file="$2"

  if ! is_running "$pid_file"; then
    echo "$name is not running"
    rm -f "$pid_file"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  echo "Stopping $name (pid $pid)..."
  kill "$pid"
  rm -f "$pid_file"
}

kill_dev_ports() {
  local port pid command
  for port in "${PORTS[@]}"; do
    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      command="$(ps -p "$pid" -o comm= 2>/dev/null || true)"
      if [[ "$command" =~ (node|npm|vite) ]]; then
        echo "Killing old dev process on port $port (pid $pid, $command)..."
        kill "$pid" 2>/dev/null || true
      else
        echo "Port $port is used by pid $pid ($command); not killing non-node process"
      fi
    done < <(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  done
}

stop_existing() {
  stop_one "frontend" "$FRONTEND_PID"
  stop_one "backend" "$BACKEND_PID"
  kill_dev_ports
}

status_one() {
  local name="$1"
  local pid_file="$2"
  if is_running "$pid_file"; then
    echo "$name running (pid $(cat "$pid_file"))"
  else
    echo "$name stopped"
  fi
}

case "${1:-start}" in
  start)
    stop_existing
    start_one "backend" "$BACKEND_PID" "$BACKEND_LOG" npm --prefix backend run dev
    start_one "frontend" "$FRONTEND_PID" "$FRONTEND_LOG" npm --prefix frontend run dev -- --host 0.0.0.0 --strictPort
    echo
    echo "Backend:  http://localhost:3001"
    echo "Frontend: http://localhost:5173"
    echo "Logs:     $LOG_DIR"
    ;;
  stop)
    stop_existing
    ;;
  restart)
    "$0" stop
    "$0" start
    ;;
  status)
    status_one "backend" "$BACKEND_PID"
    status_one "frontend" "$FRONTEND_PID"
    ;;
  logs)
    echo "Backend log:  $BACKEND_LOG"
    echo "Frontend log: $FRONTEND_LOG"
    ;;
  *)
    echo "Usage: $0 [start|stop|restart|status|logs]"
    exit 1
    ;;
esac
