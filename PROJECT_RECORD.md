# HIT 批量录入助手 — 项目记录

## 概述

哈尔滨工业大学学工系统批量数据录入工具，支持微信小程序 + 服务端 Playwright 自动化。

- **服务器**: 118.190.208.230 (2核2G, Tencent Cloud)
- **仓库**: https://github.com/wiseliang/HIT-RECORDER
- **最后更新**: 2026-06-09

---

## 系统架构

```
miniprogram/          # 微信小程序前端（本仓库）
server/               # Node.js 后端服务
  ├── app.js          # Express 入口
  ├── config/         # 数据库、环境变量
  ├── models/         # 数据模型 (MySQL)
  ├── routes/         # REST API
  ├── services/       # Playwright 自动化引擎
  │   ├── browser.js  # Chromium 管理 (CDP/Launch 双模式)
  │   ├── login.js    # SSO 登录 (密码/二维码/MFA)
  │   ├── companion.js / talk.js  # 录入引擎
  │   ├── orchestrator.js         # 录入任务编排
  │   ├── gradeQuery.js           # 成绩查询引擎
  │   └── gradeOrchestrator.js    # 成绩查询编排
  └── utils/
scripts/              # PM2 配置、数据库初始化、Chrome 启动脚本
```

---

## 小程序页面

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | pages/index | 功能入口，显示当前周次 |
| 录入配置 | pages/record | 登录(密码/二维码/MFA) + 周次学生选择 |
| 进度 | pages/progress | 2秒轮询，实时进度，MFA验证码，截图诊断 |
| 结果 | pages/result | 录入结果统计 |
| 历史 | pages/history | 历史任务列表 |
| 设置 | pages/settings | 工号密码配置 |
| 成绩查询 | pages/gradeQuery | 登录 + 查询条件选择 |
| 成绩结果 | pages/gradeResult | 结果展示 + 导出 + 截图诊断 |

---

## 登录流程

### 密码登录
```
学工系统 → SSO(ids.hit.edu.cn) → 填凭证 → AES加密 → 提交
  ├── 图片验证码 → 前端输入 → 继续
  ├── MFA验证码 → 获取验证码 → 前端输入 → 登录
  └── 登录成功 → 保存cookies → 进入系统
```

### 二维码登录
```
ivpn/学工系统 → SSO → 捕获QR码 → 前端展示
  → 用户HIT APP扫码 → 检测success_qr → 等跳转
  ├── 直接登录成功
  ├── MFA验证码 → 获取验证码 → 前端输入 → 登录
  └── session有效 → 跳过扫码直接登录
```

### 成绩查询登录
```
ivpn.hitwh.edu.cn → SSO → QR扫码 → ivpn portal → 新教务系统 → SSO → 教务平台
```

---

## 关键配置

### 浏览器 (browser.js)
- **CDP模式**: 连外部Chrome，`USE_CDP=true, CDP_URL=http://127.0.0.1:9222`
- **Launch模式**: Playwright自启Chromium（开发/降级用）
- `locale: zh-CN` — 中文页面
- `userAgent` — 伪装普通Chrome
- `MAX_CONTEXTS: 2` — 2核2G优化

### Chrome启动 (start-chrome.sh)
```bash
--headless=new --remote-debugging-port=9222
--disable-blink-features=AutomationControlled  # 去webdriver标记
--window-size=1920,1080
--user-data-dir=/root/chrome-data
```

### PM2配置
```js
script: '/root/hit-record/server/app.js'
max_memory_restart: '800M'
node_args: '--max-old-space-size=512'
max_restarts: 5
restart_delay: 5000
```

### 数据库 (MySQL)
- `connectionLimit: 3` — 2核优化
- 表: credentials, tasks, session_cache, weekly_summary, grade_tasks

---

## API端点

### 认证 `/api/auth`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /login | 微信登录 |
| POST | /credential | 保存凭证 |
| GET | /credential | 查询凭证 |
| POST | /start-login | 开始登录学工系统(密码) |
| POST | /submit-captcha | 提交图片验证码 |
| POST | /submit-code | 提交MFA验证码 |
| POST | /resend-code | 重发验证码 |
| POST | /qrcode-start | 获取二维码(target: xuegong/ivpn) |
| POST | /qrcode-wait | 等待扫码完成(检测MFA) |
| POST | /qrcode-submit-code | 提交QR流程MFA验证码 |
| POST | /qrcode-screenshot | 截图诊断(所有会话来源) |
| GET | /student-list | 获取学生列表 |
| POST | /release | 释放登录会话 |

### 任务 `/api/task`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /create | 创建录入任务 |
| GET | /:uuid | 查询任务进度 |
| POST | /:uuid/submit-code | 任务中提交验证码 |
| POST | /:uuid/resend-code | 重发验证码 |

### 成绩查询 `/api/grade`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /start-query | 创建查询任务 |
| GET | /:uuid | 查询进度/结果 |
| POST | /:uuid/submit-code | 提交验证码 |
| GET | /:uuid/export | 导出数据 |
| GET | /:uuid/student/:idx/courses | 单个学生课程 |
| GET | /:uuid/diagnose | 页面诊断(含截图) |

---

## 内存优化 (2核2G)

| 优化项 | 值 | 节省 |
|--------|-----|------|
| Chromium --single-process | 单进程 | ~200MB |
| Chromium --max-old-space-size | 256MB | 防OOM |
| MAX_CONTEXTS | 2 | ~100MB |
| IDLE_SHUTDOWN | 60s | 快速回收 |
| MySQL connectionLimit | 3 | ~70MB |
| Node.js --max-old-space-size | 512MB | 防泄漏 |
| PM2 max_memory_restart | 800M | 留余量 |

---

## 已知问题 & 待解决

1. **成绩查询 portal→教务系统**: Avalon框架渲染的"新教务系统"链接，常规点击无法触发导航，需要研究Avalon ms-click事件机制
2. **滑块验证码**: 偶尔出现，目前通过CDP模式(--disable-blink-features=AutomationControlled)规避
3. **每30秒SIGINT重启**: 已通过删除wait_ready、增加unhandledRejection兜底、改用绝对路径PM2配置解决

---

## 部署流程

```bash
# 1. 启动Chrome CDP
nohup /root/hit-record/scripts/start-chrome.sh > /tmp/chrome.log 2>&1 &

# 2. 部署服务端
cd /root && tar -xzf hit-record-full-deploy.tar.gz
cp hit-record-full/server/* /root/hit-record/server/ -r
cp hit-record-full/scripts/* /root/hit-record/scripts/ -r

# 3. 重启
pm2 delete hit-record-server
pm2 start /root/hit-record/scripts/pm2.config.js
pm2 save

# 4. 验证
curl http://localhost:3000/api/health
```
