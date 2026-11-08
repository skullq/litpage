#!/usr/bin/env bash
# ==============================================================================
# Litpage Application Control Script (Start / Stop / Restart / Status / Logs)
# ==============================================================================

set -e

# Resolve script and project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PID_FILE="${ROOT_DIR}/.litpage.pid"
LOG_DIR="${ROOT_DIR}/logs"
LOG_FILE="${LOG_DIR}/dev.log"

WEB_PORT=5173
SERVER_PORT=3001

# Color formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

is_port_in_use() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    lsof -i:"${port}" -sTCP:LISTEN -t >/dev/null 2>&1
  elif command -v fuser >/dev/null 2>&1; then
    fuser "${port}/tcp" >/dev/null 2>&1
  elif command -v ss >/dev/null 2>&1; then
    ss -lnt | grep -qE "(:|\])${port}\b"
  else
    (echo > /dev/tcp/127.0.0.1/"${port}") >/dev/null 2>&1
  fi
}

get_pid() {
  if [ -f "${PID_FILE}" ]; then
    cat "${PID_FILE}" 2>/dev/null || true
  fi
}

is_running() {
  local pid
  pid=$(get_pid)
  if [ -n "${pid}" ] && kill -0 "${pid}" 2>/dev/null; then
    return 0
  fi
  if pgrep -f "scripts/dev.mjs" >/dev/null 2>&1; then
    return 0
  fi
  if is_port_in_use "${WEB_PORT}" || is_port_in_use "${SERVER_PORT}"; then
    return 0
  fi
  return 1
}

do_start() {
  echo -e "${BOLD}${CYAN}[Litpage]${NC} 프로그램 시작을 준비합니다..."

  if is_running; then
    local pid
    pid=$(get_pid)
    echo -e "${YELLOW}이미 프로그램이 실행 중입니다.${NC}"
    if [ -n "${pid}" ]; then
      echo -e "  - PID: ${BOLD}${pid}${NC}"
    fi
    echo -e "  - Web URL:    ${GREEN}http://localhost:${WEB_PORT}${NC}"
    echo -e "  - Server API: ${GREEN}http://localhost:${SERVER_PORT}${NC}"
    echo -e "\n종료 후 다시 시작하려면: ${BOLD}./stop.sh${NC} 또는 ${BOLD}./start.sh restart${NC}"
    exit 0
  fi

  # Ensure log directory exists
  mkdir -p "${LOG_DIR}"

  cd "${ROOT_DIR}"

  echo -e "${CYAN}백그라운드에서 Litpage 개발 서버를 시작합니다...${NC}"
  # Run completely detached from current terminal session using setsid
  setsid node scripts/dev.mjs > "${LOG_FILE}" 2>&1 < /dev/null &
  local new_pid=$!
  sleep 1

  # Check if dev.mjs process is running and record PID
  local dev_pid
  dev_pid=$(pgrep -f "node scripts/dev.mjs" | head -n 1 || true)
  if [ -n "${dev_pid}" ]; then
    echo "${dev_pid}" > "${PID_FILE}"
    echo -e "  - PID: ${BOLD}${dev_pid}${NC}"
  else
    echo "${new_pid}" > "${PID_FILE}"
    echo -e "  - PID: ${BOLD}${new_pid}${NC}"
  fi

  echo -e "  - 로그 파일: ${BOLD}${LOG_FILE}${NC}"
  echo -n "서버 초기화 대기 중"

  # Wait for web & server ports to open (up to 15 seconds)
  local ready=0
  for i in $(seq 1 15); do
    echo -n "."
    if is_port_in_use "${SERVER_PORT}" && is_port_in_use "${WEB_PORT}"; then
      ready=1
      break
    fi
    sleep 1
  done
  echo ""

  if [ "${ready}" -eq 1 ]; then
    echo -e "\n${BOLD}${GREEN}✔ Litpage가 성공적으로 시작되었습니다!${NC}"
    echo -e "----------------------------------------------------"
    echo -e "  ${BOLD}웹 접속 주소:${NC}     ${GREEN}http://localhost:${WEB_PORT}${NC}"
    echo -e "  ${BOLD}API 서버 주소:${NC}    ${GREEN}http://localhost:${SERVER_PORT}${NC}"
    echo -e "  ${BOLD}로그 확인:${NC}        ${CYAN}./scripts/run.sh logs${NC} (또는 tail -f ${LOG_FILE})"
    echo -e "  ${BOLD}프로그램 종료:${NC}    ${RED}./stop.sh${NC} (또는 ./scripts/run.sh stop)"
    echo -e "----------------------------------------------------"
  else
    echo -e "\n${YELLOW}⚠ 서버가 시작 중입니다 (포트 준비까지 조금 더 걸릴 수 있습니다).${NC}"
    echo -e "로그 확인: ${BOLD}tail -f ${LOG_FILE}${NC}"
  fi
}

do_stop() {
  echo -e "${BOLD}${CYAN}[Litpage]${NC} 프로그램을 종료합니다..."

  local pid
  pid=$(get_pid)

  # 1. Kill main process from PID file if alive
  if [ -n "${pid}" ] && kill -0 "${pid}" 2>/dev/null; then
    echo -e "  - PID ${pid} 프로세스에 종료 신호(SIGTERM) 전송..."
    kill "${pid}" 2>/dev/null || true

    for i in $(seq 1 5); do
      if ! kill -0 "${pid}" 2>/dev/null; then
        break
      fi
      sleep 0.5
    done

    if kill -0 "${pid}" 2>/dev/null; then
      echo -e "  - PID ${pid} 강제 종료(SIGKILL) 전송..."
      kill -9 "${pid}" 2>/dev/null || true
    fi
  fi

  # 2. Clean up any remaining dev script processes
  pkill -f "scripts/dev.mjs" 2>/dev/null || true

  # 3. Clean up any listening processes on ports 5173 & 3001
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${WEB_PORT}/tcp" "${SERVER_PORT}/tcp" >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti:"${WEB_PORT},${SERVER_PORT}" 2>/dev/null || true)
    if [ -n "${pids}" ]; then
      echo "${pids}" | xargs -r kill -9 2>/dev/null || true
    fi
  fi

  # 4. Remove PID file
  rm -f "${PID_FILE}"

  # Give OS 0.5s to free ports
  sleep 0.5

  echo -e "${BOLD}${GREEN}✔ Litpage가 정상적으로 종료되었습니다.${NC}"
}

do_status() {
  echo -e "${BOLD}${CYAN}[Litpage 상태 확인]${NC}"
  local pid
  pid=$(get_pid)
  local dev_pids
  dev_pids=$(pgrep -f "scripts/dev.mjs" 2>/dev/null || true)
  local web_active=0
  local server_active=0

  if is_port_in_use "${WEB_PORT}"; then web_active=1; fi
  if is_port_in_use "${SERVER_PORT}"; then server_active=1; fi

  if [ -n "${dev_pids}" ]; then
    echo -e "  - 실행 상태:   ${GREEN}${BOLD}RUNNING (실행 중)${NC}"
    echo -e "  - 메인 PID:    ${BOLD}${dev_pids}${NC}"
  elif [ "${web_active}" -eq 1 ] || [ "${server_active}" -eq 1 ]; then
    echo -e "  - 실행 상태:   ${YELLOW}${BOLD}PARTIAL / DETACHED (포트 활성)${NC}"
  else
    echo -e "  - 실행 상태:   ${RED}${BOLD}STOPPED (중지됨)${NC}"
    return 0
  fi

  echo -e "  - Web 포트 (${WEB_PORT}):     $([ "${web_active}" -eq 1 ] && echo -e "${GREEN}정상 (http://localhost:${WEB_PORT})${NC}" || echo -e "${RED}중지됨${NC}")"
  echo -e "  - Server 포트 (${SERVER_PORT}):  $([ "${server_active}" -eq 1 ] && echo -e "${GREEN}정상 (http://localhost:${SERVER_PORT})${NC}" || echo -e "${RED}중지됨${NC}")"

  if [ -f "${LOG_FILE}" ]; then
    echo -e "\n${BOLD}[최근 로그 5줄]${NC}"
    tail -n 5 "${LOG_FILE}" | sed 's/^/  /'
  fi
}

do_logs() {
  if [ ! -f "${LOG_FILE}" ]; then
    mkdir -p "${LOG_DIR}"
    touch "${LOG_FILE}"
  fi
  echo -e "${BOLD}${CYAN}[Litpage 실시간 로그] (종료: Ctrl+C)${NC}"
  echo -e "----------------------------------------------------"
  tail -f "${LOG_FILE}"
}

show_help() {
  echo -e "${BOLD}사용법: $0 {start|stop|restart|status|logs}${NC}"
  echo ""
  echo -e "  ${GREEN}start${NC}    : Litpage 백그라운드 실행"
  echo -e "  ${RED}stop${NC}     : 실행 중인 Litpage 완전 종료"
  echo -e "  ${YELLOW}restart${NC}  : 프로그램 재시작 (stop -> start)"
  echo -e "  ${CYAN}status${NC}   : 실행 여부 및 포트 상태 확인"
  echo -e "  ${BLUE}logs${NC}     : 실시간 로그 출력 (Ctrl+C로 나가기)"
  echo ""
  echo -e "단축 실행 파일:"
  echo -e "  ${BOLD}./start.sh${NC}   (시작)"
  echo -e "  ${BOLD}./stop.sh${NC}    (종료)"
  echo -e "  ${BOLD}./status.sh${NC}  (상태)"
}

case "$1" in
  start)
    do_start
    ;;
  stop)
    do_stop
    ;;
  restart)
    do_stop
    sleep 1
    do_start
    ;;
  status)
    do_status
    ;;
  logs|log)
    do_logs
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    show_help
    exit 1
    ;;
esac
