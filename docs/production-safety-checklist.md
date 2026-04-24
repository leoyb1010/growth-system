# 生产安全 Checklist

_最后更新：2026-04-24_

---

## 一、发布前备份步骤

```bash
# 1. 创建带时间戳的备份目录
cd /Users/leo/WorkBuddy/20260421163042/growth-system
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p backups/$TS

# 2. 备份 SQLite 数据库文件
for f in backend/growth_system.sqlite backend/growth_system.sqlite-wal backend/growth_system.sqlite-shm; do
  [ -f "$f" ] && cp "$f" backups/$TS/
done

# 3. 导出 schema 快照
sqlite3 backend/growth_system.sqlite ".schema" > backups/$TS/schema.sql

# 4. 导出关键表行数
sqlite3 backend/growth_system.sqlite "
select 'users', count(*) from users
union all select 'departments', count(*) from departments
union all select 'projects', count(*) from projects
union all select 'kpis', count(*) from kpis
union all select 'monthly_tasks', count(*) from monthly_tasks
union all select 'achievements', count(*) from achievements
union all select 'weekly_reports', count(*) from weekly_reports;
" > backups/$TS/row-counts.txt

# 5. 确认备份
ls -la backups/$TS/
```

---

## 二、发布后 Smoke Test

```bash
# 前端构建
cd frontend && npm run build

# 后端启动（先 stop 旧进程）
pm2 delete growth-system 2>/dev/null || true
cd backend && DB_DIALECT=sqlite NODE_ENV=production node src/app.js &
# 或用 start-prod.sh

# API 测试
curl -s http://localhost:3001/api/auth/me | head -c 200
# 需要带 token 的测试：
# TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"xxx"}' | jq -r '.token')
# curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/dashboard | jq '.success'
```

---

## 三、回滚步骤

```bash
# 1. 回滚代码
git checkout main
git branch -D codex/prod-safety-baseline  # 如果要删分支

# 2. 恢复数据库（如需）
pm2 stop growth-system 2>/dev/null || true
TS=<备份时间戳>
cp backups/$TS/growth_system.sqlite backend/growth_system.sqlite
cp backups/$TS/growth_system.sqlite-wal backend/growth_system.sqlite-wal 2>/dev/null || true
cp backups/$TS/growth_system.sqlite-shm backend/growth_system.sqlite-shm 2>/dev/null || true

# 3. 重启服务
./start-prod.sh
```

---

## 四、禁止命令列表

| 命令 | 原因 |
|------|------|
| `sequelize.sync({ force: true })` | 会重建表，清空所有数据 |
| `DROP TABLE` | 不可恢复 |
| `TRUNCATE` | 不可恢复 |
| `DELETE FROM xxx`（无 WHERE） | 不可恢复 |
| `rm backend/growth_system.sqlite*` | 删库 |
| 在代码中硬编码密钥/Token | 安全泄露 |

---

## 五、环境变量清单

| 变量 | 必须设置 | 说明 |
|------|---------|------|
| `NODE_ENV` | ✅ | 生产环境必须为 `production` |
| `JWT_SECRET` | ✅ | 强随机密钥，禁止使用默认值 |
| `DB_DIALECT` | ✅ | `sqlite` 或 `postgres` |
| `DB_STORAGE` | SQLite时 | 数据库文件绝对路径 |
| `PORT` | 可选 | 默认 3001 |
| `AI_LLM_PROVIDER` | AI功能 | `deepseek` 或 `mock` |
| `AI_LLM_API_KEY` | AI功能 | DeepSeek API Key |
| `AI_LLM_MODEL` | AI功能 | 如 `deepseek-chat` |
| `AI_LLM_BASE_URL` | AI功能 | 如 `https://api.deepseek.com` |
| `ENABLE_PUBLIC_REGISTER` | 可选 | 默认 `false`，禁止公开注册 |

### 生成强 JWT_SECRET

```bash
openssl rand -hex 32
```

---

## 六、数据库文件位置

| 文件 | 路径 |
|------|------|
| SQLite 数据库 | `backend/growth_system.sqlite` |
| WAL 日志 | `backend/growth_system.sqlite-wal` |
| SHM 共享内存 | `backend/growth_system.sqlite-shm` |
| 备份目录 | `backups/` |

---

## 七、负责人确认项

- [ ] 发布前已执行备份
- [ ] JWT_SECRET 已设置强随机值
- [ ] AI API Key 未硬编码在代码中
- [ ] 公开注册已关闭（ENABLE_PUBLIC_REGISTER != true）
- [ ] 前端 build 通过
- [ ] 关键 API smoke test 通过
- [ ] 发布后行数对比无异常减少

---

## 基线数据（2026-04-24 23:39）

| 表 | 行数 |
|----|------|
| users | 4 |
| departments | 2 |
| projects | 11 |
| kpis | 12 |
| monthly_tasks | 2 |
| achievements | 1 |
| weekly_reports | 33 |
