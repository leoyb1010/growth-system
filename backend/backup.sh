#!/bin/bash
# Growth System SQLite 自动备份脚本
# 用法: ./backup.sh [daily|weekly|manual]
# crontab 示例:
#   每日凌晨2点: 0 2 * * * /path/to/backup.sh daily
#   每周日凌晨3点: 0 3 * * 0 /path/to/backup.sh weekly

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_FILE="${SCRIPT_DIR}/growth_system.sqlite"
BACKUP_DIR="${SCRIPT_DIR}/backups"
MODE="${1:-manual}"
DATE=$(date +%Y%m%d_%H%M)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p "${BACKUP_DIR}"

# 检查数据库文件存在
if [ ! -f "${DB_FILE}" ]; then
  echo "[${TIMESTAMP}] ERROR: 数据库文件不存在: ${DB_FILE}" >&2
  exit 1
fi

# 检查数据库完整性
INTEGRITY=$(sqlite3 "${DB_FILE}" "PRAGMA integrity_check;" 2>&1)
if [[ "${INTEGRITY}" != *"ok"* ]]; then
  echo "[${TIMESTAMP}] ERROR: 数据库完整性检查失败: ${INTEGRITY}" >&2
  exit 1
fi

# 使用 SQLite 内置备份（安全热备，不锁表）
BACKUP_FILE="${BACKUP_DIR}/growth_system_${MODE}_${DATE}.sqlite"
sqlite3 "${DB_FILE}" ".backup '${BACKUP_FILE}'"

# 验证备份文件
if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[${TIMESTAMP}] ERROR: 备份文件未生成: ${BACKUP_FILE}" >&2
  exit 1
fi

BACKUP_SIZE=$(stat -f%z "${BACKUP_FILE}" 2>/dev/null || stat -c%s "${BACKUP_FILE}" 2>/dev/null)
DB_SIZE=$(stat -f%z "${DB_FILE}" 2>/dev/null || stat -c%s "${DB_FILE}" 2>/dev/null)

# ====== 备份恢复验证 ======
TEMP_RESTORE="${BACKUP_DIR}/_verify_restore.sqlite"
cp "${BACKUP_FILE}" "${TEMP_RESTORE}"
VERIFY_INTEGRITY=$(sqlite3 "${TEMP_RESTORE}" "PRAGMA integrity_check;" 2>&1)

if [[ "${VERIFY_INTEGRITY}" != *"ok"* ]]; then
  echo "[${TIMESTAMP}] FATAL: 备份验证失败(integrity_check): ${VERIFY_INTEGRITY}" >&2
  rm -f "${TEMP_RESTORE}"
  exit 1
fi

# 验证备份中的表数量与原库一致
BACKUP_TABLE_COUNT=$(sqlite3 "${TEMP_RESTORE}" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>&1)
DB_TABLE_COUNT=$(sqlite3 "${DB_FILE}" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>&1)

if [ "${BACKUP_TABLE_COUNT}" != "${DB_TABLE_COUNT}" ]; then
  echo "[${TIMESTAMP}] FATAL: 备份表数量(${BACKUP_TABLE_COUNT})与原库(${DB_TABLE_COUNT})不一致" >&2
  rm -f "${TEMP_RESTORE}"
  exit 1
fi

rm -f "${TEMP_RESTORE}"
echo "[${TIMESTAMP}] ✅ 备份验证通过 (${BACKUP_TABLE_COUNT} 张表, 完整性ok)"
# ====== 验证完成 ======

echo "[${TIMESTAMP}] ✅ 备份成功: ${BACKUP_FILE} (${BACKUP_SIZE} bytes, 源DB: ${DB_SIZE} bytes)"

# 清理旧备份
# daily: 保留7天
# weekly: 保留4周
# manual: 保留30天
case "${MODE}" in
  daily)
    find "${BACKUP_DIR}" -name "growth_system_daily_*.sqlite" -mtime +7 -delete 2>/dev/null
    echo "[${TIMESTAMP}] 已清理7天前的daily备份"
    ;;
  weekly)
    find "${BACKUP_DIR}" -name "growth_system_weekly_*.sqlite" -mtime +28 -delete 2>/dev/null
    echo "[${TIMESTAMP}] 已清理4周前的weekly备份"
    ;;
  manual)
    find "${BACKUP_DIR}" -name "growth_system_manual_*.sqlite" -mtime +30 -delete 2>/dev/null
    echo "[${TIMESTAMP}] 已清理30天前的manual备份"
    ;;
esac
