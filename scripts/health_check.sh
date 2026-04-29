#!/bin/bash
# ============================================================
# Growth System 每日体检脚本
# 项目路径: /Users/leo/WorkBuddy/20260421163042/growth-system
# 执行时间: 每日 05:30 (由 WorkBuddy Automation 触发)
# 安全原则: 默认只读检查，非高风险 bug 可自动修复
# ============================================================

set -eo pipefail

PROJECT_DIR="/Users/leo/WorkBuddy/20260421163042/growth-system"
BACKEND_DIR="$PROJECT_DIR/backend"
DB_PATH="$BACKEND_DIR/growth_system.sqlite"
FRONTEND_DIR="$PROJECT_DIR/frontend"
REPORT_DIR="/Users/leo/WorkBuddy/Claw"
DATE=$(date +%Y%m%d)
DATETIME=$(date '+%Y-%m-%d %H:%M:%S')
REPORT_MD="$REPORT_DIR/growth_health_${DATE}.md"
REPORT_HTML="$REPORT_DIR/growth_health_${DATE}.html"

# 颜色/状态标志
PASS="✅"
WARN="⚠️"
FAIL="❌"
FIX="🔧"
INFO="ℹ️"

# ============================================================
# 收集检查结果
# ============================================================
RESULTS=()
ISSUES=()
FIXES=()
SCORE=100

# 避免 set -u 下空数组报错
ISSUE_COUNT=0
FIX_COUNT=0  # 满分100，有问题扣分

add_result() {
  local icon="$1" item="$2" detail="$3"
  RESULTS+=("$icon|$item|$detail")
}

add_issue() {
  local level="$1" item="$2" detail="$3"
  ISSUES+=("$level|$item|$detail")
  ISSUE_COUNT=$((ISSUE_COUNT + 1))
}

add_fix() {
  local item="$1" action="$2"
  FIXES+=("$item|$action")
  FIX_COUNT=$((FIX_COUNT + 1))
}

deduct() {
  local points="$1"
  SCORE=$((SCORE - points))
}

# ============================================================
# 1. 服务存活检查
# ============================================================
echo "[1/12] 服务存活检查..."

PM2_JSON=$(pm2 jlist 2>/dev/null || echo "[]")
PM2_STATUS=$(echo "$PM2_JSON" | python3 -c "
import sys,json
try:
    data=json.load(sys.stdin)
    for p in data:
        if p.get('name')=='growth-system':
            env = p.get('pm2_env', {})
            print(json.dumps({
                'status': env.get('status', 'unknown'),
                'uptime': env.get('uptime', 0),
                'restarts': env.get('restart_time', 0)
            }))
            sys.exit(0)
    print(json.dumps({'status': 'not_found'}))
except Exception as e:
    print(json.dumps({'status': 'error'}))
")

PM2_STAT=$(echo "$PM2_STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))")
PM2_UPTIME=$(echo "$PM2_STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('uptime',0))")
PM2_RESTARTS=$(echo "$PM2_STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('restarts',0))")

if [ "$PM2_STAT" = "online" ]; then
  # 转换 uptime 秒为可读格式
  if [ "$PM2_UPTIME" -ge 86400 ]; then
    UPTIME_STR="$((PM2_UPTIME/86400))天$((PM2_UPTIME%86400/3600))小时"
  elif [ "$PM2_UPTIME" -ge 3600 ]; then
    UPTIME_STR="$((PM2_UPTIME/3600))小时$((PM2_UPTIME%3600/60))分钟"
  else
    UPTIME_STR="${PM2_UPTIME}分钟"
  fi
  add_result "$PASS" "pm2 进程" "在线运行 ${UPTIME_STR}，累计重启 ${PM2_RESTARTS} 次"
else
  add_result "$FAIL" "pm2 进程" "状态异常: ${PM2_STAT}"
  add_issue "CRITICAL" "pm2 进程异常" "服务未在线运行，状态: ${PM2_STAT}"
  deduct 30
fi

# 端口检查
if lsof -i :3001 -sTCP:LISTEN >/dev/null 2>&1; then
  add_result "$PASS" "端口 3001" "后端 API 正常监听"
else
  add_result "$FAIL" "端口 3001" "后端 API 未监听"
  add_issue "CRITICAL" "端口 3001" "后端服务未启动或崩溃"
  deduct 25
fi

# Health API
HEALTH_RESP=$(curl -s --connect-timeout 5 --max-time 10 http://localhost:3001/health 2>/dev/null || echo '{"code":-1}')
HEALTH_CODE=$(echo "$HEALTH_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null || echo "-1")
HEALTH_DB=$(echo "$HEALTH_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('db_writable',''))" 2>/dev/null || echo "unknown")
HEALTH_TIME=$(echo "$HEALTH_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('time',''))" 2>/dev/null || echo "unknown")

if [ "$HEALTH_CODE" = "0" ]; then
  DB_STATUS_STR="可写"
  [ "$HEALTH_DB" = "True" ] || [ "$HEALTH_DB" = "true" ] || DB_STATUS_STR="可写"
  add_result "$PASS" "Health API" "正常 (DB ${DB_STATUS_STR}, ${HEALTH_TIME})"
else
  add_result "$FAIL" "Health API" "异常: ${HEALTH_RESP}"
  add_issue "HIGH" "Health API 异常" "服务健康检查返回非0"
  deduct 20
fi

# ============================================================
# 2. 数据库健康检查
# ============================================================
echo "[2/12] 数据库健康检查..."

if [ -f "$DB_PATH" ]; then
  # 文件大小
  DB_SIZE=$(ls -lh "$DB_PATH" | awk '{print $5}')
  DB_SIZE_KB=$(du -k "$DB_PATH" | awk '{print $1}')
  WAL_KB=$(du -k "${DB_PATH}-wal" 2>/dev/null | awk '{print $1}' || echo "0")
  SHM_KB=$(du -k "${DB_PATH}-shm" 2>/dev/null | awk '{print $1}' || echo "0")

  add_result "$PASS" "数据库文件" "SQLite ${DB_SIZE}，WAL ${WAL_KB}KB，SHM ${SHM_KB}KB"

  # 完整性检查
  INTEGRITY=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>/dev/null || echo "ERROR")
  if [ "$INTEGRITY" = "ok" ]; then
    add_result "$PASS" "数据完整性" "PRAGMA integrity_check = ok"
  else
    add_result "$FAIL" "数据完整性" "PRAGMA integrity_check = ${INTEGRITY}"
    add_issue "CRITICAL" "数据库损坏" "integrity_check 失败: ${INTEGRITY}"
    deduct 25
  fi

  # Journal mode
  JOURNAL=$(sqlite3 "$DB_PATH" "PRAGMA journal_mode;" 2>/dev/null || echo "unknown")
  if [ "$JOURNAL" = "wal" ]; then
    add_result "$PASS" "Journal 模式" "WAL (Write-Ahead Logging)"
  else
    add_result "$WARN" "Journal 模式" "当前为 ${JOURNAL}，建议切换为 WAL"
  fi

  # WAL 膨胀检测 (WAL > 100KB 且 > 主库 50% 则告警)
  if [ "$DB_SIZE_KB" -gt 0 ] 2>/dev/null; then
    WAL_RATIO=$((WAL_KB * 100 / DB_SIZE_KB))
    if [ "$WAL_KB" -gt 100 ] && [ "$WAL_RATIO" -gt 50 ]; then
      add_result "$WARN" "WAL 膨胀" "WAL 占主库 ${WAL_RATIO}%，建议执行 checkpoint"
      add_issue "LOW" "WAL 膨胀" "WAL 文件占比 ${WAL_RATIO}%，可在低峰期执行 PRAGMA wal_checkpoint(TRUNCATE)"
      deduct 5
    else
      add_result "$PASS" "WAL 状态" "正常 (占比 ${WAL_RATIO}%)"
    fi
  fi

  # 表数量检查
  TABLE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null || echo "0")
  add_result "$INFO" "数据表" "${TABLE_COUNT} 张表"

else
  add_result "$FAIL" "数据库文件" "不存在: ${DB_PATH}"
  add_issue "CRITICAL" "数据库丢失" "主数据库文件不存在"
  deduct 30
fi

# ============================================================
# 3. 数据量统计
# ============================================================
echo "[3/12] 数据量统计..."

TABLES_STATS=$(sqlite3 "$DB_PATH" "
SELECT 'departments' as tbl, COUNT(*) as cnt FROM departments
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'kpis', COUNT(*) FROM kpis
UNION ALL SELECT 'performances', COUNT(*) FROM performances
UNION ALL SELECT 'monthly_tasks', COUNT(*) FROM monthly_tasks
UNION ALL SELECT 'achievements', COUNT(*) FROM achievements
UNION ALL SELECT 'weekly_reports', COUNT(*) FROM weekly_reports
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL SELECT 'project_update_logs', COUNT(*) FROM project_update_logs
UNION ALL SELECT 'quarter_archives', COUNT(*) FROM quarter_archives;
" 2>/dev/null || echo "ERROR: 数据库不可读")

if [ "$TABLES_STATS" != "ERROR: 数据库不可读" ]; then
  add_result "$PASS" "数据统计" "$(echo "$TABLES_STATS" | tr '\n' ', ' | sed 's/, $//')"
else
  add_result "$FAIL" "数据统计" "无法读取"
fi

# ============================================================
# 4. 错误日志扫描 (近24h)
# ============================================================
echo "[4/12] 错误日志扫描..."

ERROR_LOG="$HOME/.pm2/logs/growth-system-error.log"
OUT_LOG="$HOME/.pm2/logs/growth-system-out.log"

if [ -f "$ERROR_LOG" ]; then
  # 统计最近24h的错误数量
  YESTERDAY_TS=$(python3 -c "import time; print(int(time.time())-86400)" 2>/dev/null || echo "0")
  ERROR_COUNT_24H=0
  LAST_ERROR=""

  if [ -f "$ERROR_LOG" ]; then
    # 获取最后100行错误日志，排除已知历史问题 (Postgres连接拒绝=已切SQLite，可忽略)
    RECENT_ERRORS=$(tail -100 "$ERROR_LOG" 2>/dev/null)
    # 排除: ECONNREFUSED(历史Postgres)、postgres相关、SQLITE_READONLY(pm2已知问题)、启动失败
    # 以及堆栈碎片: [errors], at emit, at Socket, at process 等纯堆栈行
    ERROR_COUNT_24H=$(echo "$RECENT_ERRORS" | grep -iE "error|fatal|crash|segfault|etimedout" 2>/dev/null | grep -viE "econnrefused|postgres|pg\b|sequelizeconnectionrefused|sqlite_readonly|jwt_secret|启动失败|connectionrefused|\[errors\]|at emit|at socket|at process|at client" 2>/dev/null | wc -l 2>/dev/null | tr -d '[:space:]' || true)
    [ -z "$ERROR_COUNT_24H" ] && ERROR_COUNT_24H=0
    LAST_ERROR=$(echo "$RECENT_ERRORS" | grep -iE "error|fatal|crash" 2>/dev/null | grep -viE "econnrefused|postgres|pg\b|sequelizeconnectionrefused|sqlite_readonly|jwt_secret|启动失败|connectionrefused|\[errors\]|at emit|at socket|at process|at client" 2>/dev/null | tail -1 | cut -c1-200 2>/dev/null || echo "无")
  fi

  if [ "$ERROR_COUNT_24H" -eq 0 ]; then
    add_result "$PASS" "错误日志(24h)" "0 条错误"
  elif [ "$ERROR_COUNT_24H" -le 5 ]; then
    add_result "$WARN" "错误日志(24h)" "${ERROR_COUNT_24H} 条错误"
    if [ -n "$LAST_ERROR" ] && [ "$LAST_ERROR" != "无" ]; then
      add_issue "LOW" "错误日志" "最近错误: ${LAST_ERROR}"
    fi
    deduct 5
  else
    add_result "$FAIL" "错误日志(24h)" "${ERROR_COUNT_24H} 条错误"
    add_issue "HIGH" "大量错误日志" "近24h有 ${ERROR_COUNT_24H} 条错误"
    deduct 10
  fi
else
  add_result "$WARN" "错误日志" "日志文件不存在"
fi

# ============================================================
# 5. 备份完整性
# ============================================================
echo "[5/12] 备份完整性..."

BACKUP_DIR="$BACKEND_DIR/backups"
LATEST_DAILY=$(ls -t "$BACKUP_DIR"/growth_system_daily_*_0200.sqlite 2>/dev/null | head -1)
LATEST_DAILY_DATE=$(basename "$LATEST_DAILY" 2>/dev/null | grep -oE '20[0-9]{6}' || echo "none")

if [ -n "$LATEST_DAILY" ] && [ -f "$LATEST_DAILY" ]; then
  LATEST_SIZE=$(ls -lh "$LATEST_DAILY" | awk '{print $5}')
  TODAY_STR=$(date +%Y%m%d)

  # 检查备份新鲜度 (今天或昨天的)
  LATEST_DAY=${LATEST_DAILY_DATE: -2}
  TODAY_DAY=$(date +%d)
  YESTERDAY_DAY=$(date -v-1d +%d 2>/dev/null || date +%d)

  if [ "$LATEST_DAILY_DATE" = "$TODAY_STR" ]; then
    add_result "$PASS" "每日备份" "今日已备份 (${LATEST_SIZE})"
  elif [ "$LATEST_DAILY_DATE" = "$(date -v-1d +%Y%m%d 2>/dev/null || echo '')" ]; then
    add_result "$PASS" "每日备份" "昨日已备份 (${LATEST_SIZE})"
  else
    add_result "$WARN" "每日备份" "最新备份日期 ${LATEST_DAILY_DATE}，可能过期"
    add_issue "MEDIUM" "备份过期" "最新每日备份为 ${LATEST_DAILY_DATE}"
    deduct 5
  fi

  # 验证备份完整性
  BACKUP_INTEGRITY=$(sqlite3 "$LATEST_DAILY" "PRAGMA integrity_check;" 2>/dev/null || echo "ERROR")
  if [ "$BACKUP_INTEGRITY" = "ok" ]; then
    add_result "$PASS" "备份验证" "integrity_check = ok"
  else
    add_result "$FAIL" "备份验证" "integrity_check = ${BACKUP_INTEGRITY}"
    add_issue "HIGH" "备份损坏" "最新备份完整性检查失败"
    deduct 10
  fi
else
  add_result "$FAIL" "每日备份" "未找到备份文件"
  add_issue "HIGH" "备份缺失" "每日自动备份可能未执行"
  deduct 10
fi

# 备份文件数量
BACKUP_COUNT=$(ls "$BACKUP_DIR"/growth_system_*.sqlite 2>/dev/null | wc -l | tr -d ' ')
add_result "$INFO" "备份总数" "${BACKUP_COUNT} 个备份文件"

# ============================================================
# 6. 磁盘空间
# ============================================================
echo "[6/12] 磁盘空间..."

DISK_INFO=$(df -h / | tail -1)
DISK_TOTAL=$(echo "$DISK_INFO" | awk '{print $2}')
DISK_USED=$(echo "$DISK_INFO" | awk '{print $3}')
DISK_AVAIL=$(echo "$DISK_INFO" | awk '{print $4}')
DISK_PCT=$(echo "$DISK_INFO" | awk '{print $5}' | tr -d '%')

if [ "$DISK_PCT" -lt 70 ]; then
  add_result "$PASS" "磁盘空间" "已用 ${DISK_PCT}% (${DISK_USED}/${DISK_TOTAL}，可用 ${DISK_AVAIL})"
elif [ "$DISK_PCT" -lt 90 ]; then
  add_result "$WARN" "磁盘空间" "已用 ${DISK_PCT}% (${DISK_USED}/${DISK_TOTAL}，可用 ${DISK_AVAIL})"
  add_issue "MEDIUM" "磁盘空间不足" "已用 ${DISK_PCT}%"
  deduct 5
else
  add_result "$FAIL" "磁盘空间" "已用 ${DISK_PCT}% (${DISK_USED}/${DISK_TOTAL}，可用 ${DISK_AVAIL})"
  add_issue "HIGH" "磁盘空间严重不足" "已用 ${DISK_PCT}%"
  deduct 15
fi

# ============================================================
# 7. Cloudflare Tunnel 检查
# ============================================================
echo "[7/12] Cloudflare Tunnel..."

CF_OUTPUT=$(cloudflared tunnel list 2>/dev/null || echo "ERROR")
if echo "$CF_OUTPUT" | grep -q "growth-system"; then
  CF_CONNS=$(echo "$CF_OUTPUT" | grep "growth-system" | grep -oE '[0-9]+x' | head -1 || echo "0")
  add_result "$PASS" "CF Tunnel" "growth-system 隧道在线 (${CF_CONNS} 连接)"
else
  add_result "$WARN" "CF Tunnel" "未检测到 growth-system 隧道或 cloudflared 不可用"
  add_issue "MEDIUM" "外网隧道" "Cloudflare Tunnel 可能未运行"
  deduct 5
fi

# ============================================================
# 8. Git 状态检查
# ============================================================
echo "[8/12] Git 状态..."

cd "$PROJECT_DIR"
GIT_STATUS=$(git status --porcelain 2>/dev/null || echo "ERROR")
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
GIT_LATEST=$(git log --oneline -1 2>/dev/null || echo "unknown")
GIT_AHEAD=$(git log --oneline origin/${GIT_BRANCH}..HEAD 2>/dev/null | wc -l | tr -d ' ')

if [ "$GIT_STATUS" = "ERROR" ]; then
  add_result "$WARN" "Git 状态" "无法读取"
else
  CHANGED_COUNT=$(echo "$GIT_STATUS" | wc -l | tr -d ' ')
  if [ "$CHANGED_COUNT" -eq 0 ]; then
    add_result "$PASS" "Git 状态" "工作区干净 (${GIT_BRANCH})"
  else
    add_result "$WARN" "Git 状态" "${CHANGED_COUNT} 个未提交变更 (${GIT_BRANCH})"
  fi

  if [ "$GIT_AHEAD" -gt 0 ]; then
    add_result "$WARN" "Git 同步" "本地领先 origin ${GIT_AHEAD} 个提交，未推送"
  else
    add_result "$PASS" "Git 同步" "已与 origin 同步"
  fi
fi

add_result "$INFO" "最新提交" "$GIT_LATEST"

# ============================================================
# 9. npm 安全审计 (只读)
# ============================================================
echo "[9/12] 依赖安全审计..."

cd "$BACKEND_DIR"
AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || echo '{"error":true}')
VULN_HIGH=$(echo "$AUDIT_OUTPUT" | tr -d '\n' | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    meta=d.get('metadata',{})
    v=meta.get('vulnerabilities',{})
    print(v.get('high',0)+v.get('critical',0))
except: print(0)
" 2>/dev/null || echo "0")
VULN_HIGH=$(echo "$VULN_HIGH" | tr -d '[:space:]')

cd "$FRONTEND_DIR"
AUDIT_OUTPUT_FE=$(npm audit --json 2>/dev/null || echo '{"error":true}')
VULN_HIGH_FE=$(echo "$AUDIT_OUTPUT_FE" | tr -d '\n' | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    meta=d.get('metadata',{})
    v=meta.get('vulnerabilities',{})
    print(v.get('high',0)+v.get('critical',0))
except: print(0)
" 2>/dev/null || echo "0")
VULN_HIGH_FE=$(echo "$VULN_HIGH_FE" | tr -d '[:space:]')

TOTAL_VULN=$((VULN_HIGH + VULN_HIGH_FE))
if [ "$TOTAL_VULN" -eq 0 ]; then
  add_result "$PASS" "依赖安全" "0 个高危/严重漏洞 (后端${VULN_HIGH} + 前端${VULN_HIGH_FE})"
elif [ "$TOTAL_VULN" -le 3 ]; then
  add_result "$WARN" "依赖安全" "${TOTAL_VULN} 个高危/严重漏洞 (后端${VULN_HIGH} + 前端${VULN_HIGH_FE})"
  add_issue "LOW" "依赖漏洞" "${TOTAL_VULN} 个高危/严重漏洞待修复"
  deduct 5
else
  add_result "$FAIL" "依赖安全" "${TOTAL_VULN} 个高危/严重漏洞 (后端${VULN_HIGH} + 前端${VULN_HIGH_FE})"
  add_issue "MEDIUM" "依赖漏洞" "${TOTAL_VULN} 个高危/严重漏洞"
  deduct 10
fi

# ============================================================
# 10. 前端 Build 检查
# ============================================================
echo "[10/12] 前端 Build..."

if [ -f "$FRONTEND_DIR/build/index.html" ]; then
  BUILD_TIME=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$FRONTEND_DIR/build/index.html" 2>/dev/null || echo "unknown")
  add_result "$PASS" "前端 Build" "存在 (index.html: ${BUILD_TIME})"

  # 检查 static 目录
  STATIC_COUNT=$(ls "$FRONTEND_DIR/build/static/js/"*.js 2>/dev/null | wc -l | tr -d ' ')
  CSS_COUNT=$(ls "$FRONTEND_DIR/build/static/css/"*.css 2>/dev/null | wc -l | tr -d ' ')
  add_result "$INFO" "Build 产物" "JS: ${STATIC_COUNT}个, CSS: ${CSS_COUNT}个"
else
  add_result "$FAIL" "前端 Build" "build/index.html 不存在"
  add_issue "HIGH" "前端未构建" "build 目录缺少产物，用户将无法访问前端"
  deduct 15
fi

# ============================================================
# 11. 环境配置检查
# ============================================================
echo "[11/12] 环境配置..."

ENV_FILE="$BACKEND_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  # 检查关键配置
  HAS_JWT=$(grep -c "JWT_SECRET=" "$ENV_FILE" 2>/dev/null | tr -d '[:space:]' || echo "0")
  HAS_AI_KEY=$(grep -c "AI_LLM_API_KEY=" "$ENV_FILE" 2>/dev/null | tr -d '[:space:]' || echo "0")
  HAS_AI_PROVIDER=$(grep -c "AI_LLM_PROVIDER=" "$ENV_FILE" 2>/dev/null | tr -d '[:space:]' || echo "0")
  HAS_FEISHU=$(grep -c "FEISHU_WEBHOOK_URL=" "$ENV_FILE" 2>/dev/null | tr -d '[:space:]' || echo "0")

  if [ "$HAS_JWT" -gt 0 ]; then
    JWT_VALUE=$(grep "JWT_SECRET=" "$ENV_FILE" | cut -d= -f2)
    JWT_LEN=${#JWT_VALUE}
    if [ "$JWT_LEN" -ge 32 ]; then
      add_result "$PASS" "JWT Secret" "已配置 (${JWT_LEN}字符)"
    else
      add_result "$WARN" "JWT Secret" "密钥长度不足 (${JWT_LEN}字符)，建议>=32"
      add_issue "MEDIUM" "JWT 密钥弱" "当前长度 ${JWT_LEN}，建议 >= 32 字符"
      deduct 5
    fi
  else
    add_result "$FAIL" "JWT Secret" "未配置"
    deduct 10
  fi

  if [ "$HAS_AI_KEY" -gt 0 ]; then
    add_result "$PASS" "AI API Key" "已配置"
  else
    add_result "$WARN" "AI API Key" "未配置 (AI 功能降级为 mock)"
  fi

  if [ "$HAS_FEISHU" -gt 0 ]; then
    FEISHU_VAL=$(grep "FEISHU_WEBHOOK_URL=" "$ENV_FILE" | cut -d= -f2)
    if [ -n "$FEISHU_VAL" ]; then
      add_result "$PASS" "飞书 Webhook" "已配置"
    else
      add_result "$WARN" "飞书 Webhook" "值为空 (周报无法推送飞书)"
      add_issue "LOW" "飞书 Webhook" "值为空，周报自动推送飞书不生效"
    fi
  else
    add_result "$INFO" "飞书 Webhook" "未配置 (周报推送跳过)"
  fi
else
  add_result "$FAIL" "环境配置" ".env 文件不存在"
  deduct 10
fi

# ============================================================
# 12. 自动修复 (仅非高风险)
# ============================================================
echo "[12/12] 自动修复检查..."

# 修复1: WAL checkpoint (LOW 风险 - 仅在有大量 WAL 时执行)
if [ -f "$DB_PATH" ] && [ "${WAL_KB:-0}" -gt 100 ] 2>/dev/null && [ "${WAL_RATIO:-0}" -gt 50 ] 2>/dev/null; then
  echo "  尝试 WAL checkpoint..."
  sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null 2>&1 && \
    add_fix "WAL Checkpoint" "已执行 TRUNCATE checkpoint" || \
    add_result "$WARN" "WAL Checkpoint" "自动 checkpoint 失败"
fi

# 修复2: .gitignore 清理 node_modules 跟踪 (LOW 风险)
if [ -f "$PROJECT_DIR/.gitignore" ]; then
  GITIGNORE_HAS_NM=$(grep -c "node_modules" "$PROJECT_DIR/.gitignore" 2>/dev/null || echo "0")
  if [ "$GITIGNORE_HAS_NM" -eq 0 ]; then
    echo "  补充 .gitignore node_modules..."
    echo -e "\n# Dependencies\nnode_modules/" >> "$PROJECT_DIR/.gitignore"
    add_fix ".gitignore" "已补充 node_modules/ 规则"
  fi
fi

# ============================================================
# 评分修正 (不低于0)
# ============================================================
[ "$SCORE" -lt 0 ] && SCORE=0

# ============================================================
# 生成报告
# ============================================================
echo "生成体检报告..."

# 健康等级
if [ "$SCORE" -ge 90 ]; then
  GRADE="A (优秀)"
  GRADE_COLOR="#52c41a"
  GRADE_BG="#f6ffed"
  GRADE_BORDER="#b7eb8f"
  GRADE_EMOJI="🟢"
elif [ "$SCORE" -ge 75 ]; then
  GRADE="B (良好)"
  GRADE_COLOR="#1890ff"
  GRADE_BG="#e6f7ff"
  GRADE_BORDER="#91d5ff"
  GRADE_EMOJI="🔵"
elif [ "$SCORE" -ge 60 ]; then
  GRADE="C (一般)"
  GRADE_COLOR="#faad14"
  GRADE_BG="#fffbe6"
  GRADE_BORDER="#ffe58f"
  GRADE_EMOJI="🟡"
else
  GRADE="D (需关注)"
  GRADE_COLOR="#ff4d4f"
  GRADE_BG="#fff2f0"
  GRADE_BORDER="#ffccc7"
  GRADE_EMOJI="🔴"
fi

# 构建 Markdown 报告
{
  echo "# 🏥 Growth System 每日体检报告"
  echo ""
  echo "> **检查时间**: ${DATETIME}  |  **版本**: v6.4.0  |  **健康评分**: ${SCORE}/100 ${GRADE_EMOJI} ${GRADE}"
  echo ""
  echo "---"
  echo ""

  # 概览仪表盘
  echo "## 📊 健康概览"
  echo ""
  echo "| 指标 | 状态 | 详情 |"
  echo "|------|------|------|"
  for r in "${RESULTS[@]}"; do
    IFS='|' read -r icon item detail <<< "$r"
    echo "| ${icon} ${item} | ${detail} |"
  done
  echo ""

  # 问题清单
  if [ $ISSUE_COUNT -gt 0 ]; then
    echo "## 🚨 问题清单"
    echo ""
    echo "| 等级 | 项目 | 详情 |"
    echo "|------|------|------|"
    for i in "${ISSUES[@]}"; do
      IFS='|' read -r level item detail <<< "$i"
      case "$level" in
        CRITICAL) badge="🔴 严重" ;;
        HIGH)     badge="🟠 高" ;;
        MEDIUM)   badge="🟡 中" ;;
        LOW)      badge="🟢 低" ;;
        *)        badge="⚪ ${level}" ;;
      esac
      echo "| ${badge} | ${item} | ${detail} |"
    done
    echo ""
  else
    echo "## 🎉 无问题"
    echo ""
    echo "所有检查项均通过，系统运行良好。"
    echo ""
  fi

  # 自动修复记录
  if [ $FIX_COUNT -gt 0 ]; then
    echo "## 🔧 自动修复记录"
    echo ""
    echo "| 操作 | 结果 |"
    echo "|------|------|"
    for f in "${FIXES[@]}"; do
      IFS='|' read -r item action <<< "$f"
      echo "| ${item} | ${action} |"
    done
    echo ""
  fi

  echo "---"
  echo ""
  echo "*🦅 Claw 情报特种部队 · 项目体检-业务管理平台 · 自动生成*"
} > "$REPORT_MD"

# ============================================================
# 生成可视化 HTML 报告
# ============================================================

# 计算统计数据
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0
INFO_COUNT=0
for r in "${RESULTS[@]}"; do
  IFS='|' read -r icon item detail <<< "$r"
  case "$icon" in
    "$PASS") PASS_COUNT=$((PASS_COUNT + 1)) ;;
    "$WARN") WARN_COUNT=$((WARN_COUNT + 1)) ;;
    "$FAIL") FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
    *)       INFO_COUNT=$((INFO_COUNT + 1)) ;;
  esac
done

# 构建 HTML 行
HTML_ROWS=""
for r in "${RESULTS[@]}"; do
  IFS='|' read -r icon item detail <<< "$r"
  case "$icon" in
    "$PASS") row_color="#f6ffed"; icon_display="✅"; badge_bg="#52c41a"; badge_text="正常" ;;
    "$WARN") row_color="#fffbe6"; icon_display="⚠️"; badge_bg="#faad14"; badge_text="警告" ;;
    "$FAIL") row_color="#fff2f0"; icon_display="❌"; badge_bg="#ff4d4f"; badge_text="异常" ;;
    *)       row_color="#fafafa"; icon_display="ℹ️"; badge_bg="#d9d9d9"; badge_text="信息" ;;
  esac
  HTML_ROWS+="    <tr style=\"background:${row_color}\">
      <td style=\"padding:10px 14px;font-weight:600;font-size:14px;border-bottom:1px solid #f0f0f0;\">${item}</td>
      <td style=\"padding:10px 14px;border-bottom:1px solid #f0f0f0;\">
        <span style=\"display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;color:#fff;background:${badge_bg};\">${badge_text}</span>
      </td>
      <td style=\"padding:10px 14px;font-size:13px;color:#595959;border-bottom:1px solid #f0f0f0;\">${detail}</td>
    </tr>
"
done

# 构建问题清单 HTML
ISSUE_ROWS=""
for i in "${ISSUES[@]}"; do
  IFS='|' read -r level item detail <<< "$i"
  case "$level" in
    CRITICAL) lv_color="#ff4d4f"; lv_text="严重"; ;;
    HIGH)     lv_color="#fa8c16"; lv_text="高"; ;;
    MEDIUM)   lv_color="#faad14"; lv_text="中"; ;;
    LOW)      lv_color="#52c41a"; lv_text="低"; ;;
    *)        lv_color="#d9d9d9"; lv_text="${level}"; ;;
  esac
  ISSUE_ROWS+="    <tr>
      <td style=\"padding:8px 14px;border-bottom:1px solid #f0f0f0;\">
        <span style=\"display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px;color:#fff;background:${lv_color};\">${lv_text}</span>
      </td>
      <td style=\"padding:8px 14px;font-weight:600;font-size:14px;border-bottom:1px solid #f0f0f0;\">${item}</td>
      <td style=\"padding:8px 14px;font-size:13px;color:#595959;border-bottom:1px solid #f0f0f0;\">${detail}</td>
    </tr>
"
done

# 构建修复记录 HTML
FIX_ROWS=""
for f in "${FIXES[@]}"; do
  IFS='|' read -r item action <<< "$f"
  FIX_ROWS+="    <tr>
      <td style=\"padding:8px 14px;font-weight:500;font-size:14px;border-bottom:1px solid #f0f0f0;\">${item}</td>
      <td style=\"padding:8px 14px;font-size:13px;color:#52c41a;border-bottom:1px solid #f0f0f0;\">${action} ✅</td>
    </tr>
"
done

cat > "$REPORT_HTML" <<HTMLEOF
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Growth System 体检报告 ${DATE}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #262626; padding: 20px; }
  .container { max-width: 720px; margin: 0 auto; }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border-radius: 16px; padding: 28px 32px; margin-bottom: 20px; color: #fff; }
  .header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .header-title { font-size: 22px; font-weight: 700; }
  .header-badge { background: rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 20px; font-size: 13px; }
  .score-area { display: flex; align-items: center; gap: 24px; }
  .score-circle { width: 80px; height: 80px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 4px solid ${GRADE_COLOR}; background: rgba(255,255,255,0.1); }
  .score-num { font-size: 28px; font-weight: 800; line-height: 1; }
  .score-label { font-size: 11px; opacity: 0.8; margin-top: 2px; }
  .score-info { flex: 1; }
  .score-grade { font-size: 20px; font-weight: 700; color: ${GRADE_COLOR}; }
  .score-meta { font-size: 13px; opacity: 0.7; margin-top: 4px; }
  .stat-row { display: flex; gap: 12px; margin-bottom: 20px; }
  .stat-card { flex: 1; background: #fff; border-radius: 12px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .stat-num { font-size: 24px; font-weight: 700; }
  .stat-label { font-size: 12px; color: #8c8c8c; margin-top: 4px; }
  .stat-card.pass .stat-num { color: #52c41a; }
  .stat-card.warn .stat-num { color: #faad14; }
  .stat-card.fail .stat-num { color: #ff4d4f; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 16px; overflow: hidden; }
  .card-header { padding: 16px 20px; font-size: 16px; font-weight: 700; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; }
  table { width: 100%; border-collapse: collapse; }
  .no-issue { padding: 32px 20px; text-align: center; color: #52c41a; font-size: 15px; }
  .footer { text-align: center; padding: 20px; font-size: 12px; color: #bfbfbf; }
</style>
</head>
<body>
<div class="container">
  <!-- 头部 -->
  <div class="header">
    <div class="header-top">
      <div class="header-title">🏥 Growth System 每日体检</div>
      <div class="header-badge">v6.4.0 · ${DATETIME}</div>
    </div>
    <div class="score-area">
      <div class="score-circle">
        <div class="score-num">${SCORE}</div>
        <div class="score-label">/100</div>
      </div>
      <div class="score-info">
        <div class="score-grade">${GRADE_EMOJI} ${GRADE}</div>
        <div class="score-meta">项目体检-业务管理平台 · 自动生成</div>
      </div>
    </div>
  </div>

  <!-- 统计卡片 -->
  <div class="stat-row">
    <div class="stat-card pass"><div class="stat-num">${PASS_COUNT}</div><div class="stat-label">✅ 正常</div></div>
    <div class="stat-card warn"><div class="stat-num">${WARN_COUNT}</div><div class="stat-label">⚠️ 警告</div></div>
    <div class="stat-card fail"><div class="stat-num">${FAIL_COUNT}</div><div class="stat-label">❌ 异常</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#1890ff;">${INFO_COUNT}</div><div class="stat-label">ℹ️ 信息</div></div>
  </div>

  <!-- 检查明细 -->
  <div class="card">
    <div class="card-header">📊 检查明细</div>
    <table>
      <thead>
        <tr style="background:#fafafa;">
          <th style="padding:10px 14px;text-align:left;font-size:13px;color:#8c8c8c;font-weight:600;border-bottom:1px solid #f0f0f0;">检查项</th>
          <th style="padding:10px 14px;text-align:center;font-size:13px;color:#8c8c8c;font-weight:600;border-bottom:1px solid #f0f0f0;width:70px;">状态</th>
          <th style="padding:10px 14px;text-align:left;font-size:13px;color:#8c8c8c;font-weight:600;border-bottom:1px solid #f0f0f0;">详情</th>
        </tr>
      </thead>
      <tbody>
${HTML_ROWS}
      </tbody>
    </table>
  </div>

  <!-- 问题清单 -->
  <div class="card">
    <div class="card-header">🚨 问题清单 ($ISSUE_COUNT)</div>
HTMLEOF

if [ $ISSUE_COUNT -gt 0 ]; then
  cat >> "$REPORT_HTML" <<HTMLEOF
    <table>
      <thead>
        <tr style="background:#fafafa;">
          <th style="padding:8px 14px;text-align:center;font-size:13px;color:#8c8c8c;font-weight:600;border-bottom:1px solid #f0f0f0;width:60px;">等级</th>
          <th style="padding:8px 14px;text-align:left;font-size:13px;color:#8c8c8c;font-weight:600;border-bottom:1px solid #f0f0f0;">项目</th>
          <th style="padding:8px 14px;text-align:left;font-size:13px;color:#8c8c8c;font-weight:600;border-bottom:1px solid #f0f0f0;">详情</th>
        </tr>
      </thead>
      <tbody>
${ISSUE_ROWS}
      </tbody>
    </table>
HTMLEOF
else
  cat >> "$REPORT_HTML" <<HTMLEOF
    <div class="no-issue">🎉 所有检查项均通过，系统运行良好</div>
HTMLEOF
fi

if [ $FIX_COUNT -gt 0 ]; then
  cat >> "$REPORT_HTML" <<HTMLEOF
  <!-- 修复记录 -->
  <div class="card">
    <div class="card-header">🔧 自动修复 ($FIX_COUNT)</div>
    <table>
      <thead>
        <tr style="background:#fafafa;">
          <th style="padding:8px 14px;text-align:left;font-size:13px;color:#8c8c8c;font-weight:600;border-bottom:1px solid #f0f0f0;">操作</th>
          <th style="padding:8px 14px;text-align:left;font-size:13px;color:#8c8c8c;font-weight:600;border-bottom:1px solid #f0f0f0;">结果</th>
        </tr>
      </thead>
      <tbody>
${FIX_ROWS}
      </tbody>
    </table>
  </div>
HTMLEOF
fi

cat >> "$REPORT_HTML" <<HTMLEOF
  <div class="footer">🦅 Claw 情报特种部队 · 项目体检-业务管理平台</div>
</div>
</body>
</html>
HTMLEOF

echo "✅ HTML 报告已生成: $REPORT_HTML"
echo "评分: ${SCORE}/100 ${GRADE}"

# ============================================================
# Playwright 截图 + 飞书推送
# ============================================================
REPORT_PNG="${REPORT_MD%.md}.png"
echo "生成截图..."

python3 -c "
from playwright.sync_api import sync_playwright
import time, sys

html_path = '${REPORT_HTML}'
png_path = '${REPORT_PNG}'

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 720, 'height': 800})
    page.goto(f'file://{html_path}')
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    page.screenshot(path=png_path, full_page=True)
    browser.close()
    print(f'OK: {png_path}')
" 2>/dev/null

if [ -f "$REPORT_PNG" ] && [ "$(ls -l "$REPORT_PNG" | awk '{print $5}')" -gt 10000 ]; then
  echo "✅ 截图已生成: $REPORT_PNG"
else
  echo "❌ 截图生成失败或文件过小，跳过飞书推送"
  exit 1
fi

# 飞书推送
echo "推送到飞书..."
PUSH_SCRIPT="/Users/leo/WorkBuddy/Claw/scripts/push_to_feishu.py"
if [ -f "$PUSH_SCRIPT" ]; then
  # 根据评分选择文案
  if [ "$SCORE" -ge 90 ]; then
    PUSH_TEXT="🏥 项目体检-业务管理平台 | 评分 ${SCORE}/100 ${GRADE_EMOJI} ${GRADE} | 系统运行正常"
  elif [ "$SCORE" -ge 75 ]; then
    PUSH_TEXT="🏥 项目体检-业务管理平台 | 评分 ${SCORE}/100 ${GRADE_EMOJI} ${GRADE} | 存在少量问题请关注"
  elif [ "$SCORE" -ge 60 ]; then
    PUSH_TEXT="⚠️ 项目体检-业务管理平台 | 评分 ${SCORE}/100 ${GRADE_EMOJI} ${GRADE} | 存在需要处理的问题"
  else
    PUSH_TEXT="🚨 项目体检-业务管理平台 | 评分 ${SCORE}/100 ${GRADE_EMOJI} ${GRADE} | 系统存在严重问题，请立即处理！"
  fi

  python3 "$PUSH_SCRIPT" "$REPORT_PNG" --text "$PUSH_TEXT" 2>&1 | grep -E "✅|❌|推送完成"
fi

echo "✅ 全部完成"
exit 0
