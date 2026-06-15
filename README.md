# HIT 批量录入助手

哈尔滨工业大学（威海）学工系统批量数据录入工具。微信小程序 + Node.js 后端 + Playwright 自动化。

- **仓库**: https://github.com/wiseliang/HIT-RECORDER
- **服务器**: 118.190.208.230 (腾讯云 2核2G)
- **最后更新**: 2026-06-15

---

## 系统架构

```
miniprogram/          # 微信小程序前端
server/               # Node.js 后端服务
  ├── app.js          # Express 入口
  ├── config/         # 数据库、环境变量
  ├── models/         # 数据模型 (MySQL)
  ├── routes/         # REST API
  ├── services/       # Playwright 自动化引擎
  │   ├── browser.js  # Chromium 管理 (CDP/Launch 双模式)
  │   ├── login.js    # SSO 登录 (密码/二维码/MFA)
  │   ├── companion.js # 陪伴录入引擎
  │   ├── talk.js     # 谈话录入引擎
  │   ├── navigator.js # 页面导航、Kendo UI 操作
  │   ├── orchestrator.js # 任务编排 (单周/多周/批量/补录)
  │   ├── gradeQuery.js # 成绩查询引擎 (需校园网)
  │   ├── gradeOrchestrator.js # 成绩查询编排
  │   └── calendarUpdater.js # 校历自动更新
  └── utils/
scripts/              # PM2 配置、数据库初始化
```

---

## 功能清单

| 功能 | 说明 | 状态 |
|------|------|:--:|
| **录入陪伴** | 奇数周批量录入陪伴记录（上课/进餐/自习/运动） | ✅ |
| **录入谈话** | 偶数周批量录入谈话记录（走访寝室/课堂） | ✅ |
| **一键录入** | 第1周~当前周自动扫描，补录所有缺失 | ✅ |
| **查询补录** | 扫描缺失记录，force 强制补录 | ✅ |
| **多周次选择** | 从第1周到当前周多选 | ✅ |
| **学生筛选** | 全选/反选，只录勾选学生 | ✅ |
| **验证码交互** | 图片验证码 + MFA 验证码输入 | ✅ |
| **实时进度** | 2 秒轮询，进度条+成功/跳过/失败计数 | ✅ |
| **历史记录** | 按时间倒序查看历史录入 | ✅ |
| **凭证管理** | AES 加密存储工号和密码 | ✅ |
| **周次基准** | 手动设置第1周周一 + 自动校历更新 | ✅ |
| **成绩查询** | 教务系统成绩查询与导出 | ⚠️ 需校园网 |
| **二维码登录** | HIT APP 扫码登录 | ✅ |

---

## 后端 API

### 认证 `/api/auth`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/login` | 微信登录 (dev模式用code生成openid) |
| POST | `/credential` | 保存学号密码 (AES加密) |
| GET | `/credential` | 查询凭证状态 |
| POST | `/start-login` | 开始登录学工系统 (密码) |
| POST | `/submit-captcha` | 提交图片验证码 |
| POST | `/submit-code` | 提交MFA验证码 |
| POST | `/resend-code` | 重发验证码 |
| POST | `/qrcode-start` | 获取二维码 |
| POST | `/qrcode-wait` | 等待扫码完成 |
| POST | `/qrcode-submit-code` | 提交QR流程MFA验证码 |
| GET | `/student-list` | 获取学生列表 |
| POST | `/release` | 释放登录会话 |

### 任务 `/api/task`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/create` | 创建录入任务 |
| GET | `/:uuid` | 查询任务进度 |
| POST | `/:uuid/submit-code` | 任务中提交验证码 |

### 历史 `/api/history`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 历史任务列表 |

### 周次 `/api/week`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/current` | 获取当前周次信息 |
| POST | `/set-start-date` | 手动设置第1周周一 |
| POST | `/update-calendar` | 自动抓取校历更新基准日 |
| GET | `/check-calendar` | 检查是否需要更新校历 |

### 成绩查询 `/api/grade`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/login-start` | 开始 ivpn 登录链 |
| POST | `/login-submit-code` | 提交验证码 |
| POST | `/start-query` | 创建查询任务 |
| GET | `/:uuid` | 查询进度/结果 |
| GET | `/:uuid/export` | 导出数据 |

---

## 一键录入 / 查询补录 逻辑

### 流程
```
遍历第1周 → 当前周:
  1. 扫描学生列表 (getCompletionStatus)
  2. 正则匹配 "差(\d+)次" 获取 needCount
  3. needCount > 0 的学生 → force 强制补录 needCount 次
  4. 奇数周录陪伴 / 偶数周录谈话
  5. 保存后检查 grid 行数确认成功
```

### force 模式
跳过单条去重 (`#xq_th_grid` / `#xq_pb_grid` 检查)，直接新增记录。

---

## 服务器部署

### 环境要求
- Node.js 18+
- MySQL 8.0+
- Chromium (Playwright)
- PM2

### 部署步骤
```bash
# 1. 安装依赖
cd server && npm install
npx playwright install chromium --with-deps

# 2. 配置环境变量 (.env)
PORT=3000
DB_HOST=localhost
DB_PASSWORD=your_password
DB_NAME=hit_record
ENCRYPTION_KEY=32位随机密钥
USE_CDP=true
CDP_URL=http://127.0.0.1:9222

# 3. 初始化数据库
mysql -u root -p < scripts/init-db.sql

# 4. 启动 Chrome CDP
bash scripts/start-chrome.sh

# 5. 启动服务
pm2 start scripts/pm2.config.js
pm2 save
```

### 数据库表
| 表名 | 用途 |
|------|------|
| `credentials` | 用户凭证 (AES加密) |
| `tasks` | 录入任务 (进度、结果) |
| `grade_tasks` | 成绩查询任务 |
| `weekly_summary` | 按周汇总 |
| `session_cache` | 学工系统 cookies 缓存 |

### 辅助服务
```bash
# 启动 jwts ticket 重定向服务 (成绩查询用)
pm2 start jwts_redirect.js --name jwts-redirect

# iptables 端口转发 (成绩查询用)
iptables -t nat -A OUTPUT -p tcp --dport 80 -d 127.0.0.1 -j REDIRECT --to-port 8888
```

---

## 周次计算

- 基准日: 2026-03-09 (第1周周一)
- 奇数周 = 陪伴 (录入陪伴)
- 偶数周 = 谈话 (录入谈话)
- 修改基准: 设置页 → 周次基准日期 → 选择新学期第1周周一
- 自动更新: `POST /api/week/update-calendar` 从 jwc.hitwh.edu.cn 抓取校历

---

## 关键技术要点

### 登录流程
```
打开登录页 → SSO 统一认证 → AES 加密密码
  ├─ 无验证码 → 登录成功
  ├─ 图片验证码 → 截图返回前端 → 用户输入
  └─ MFA → 发送验证码 → 用户输入 → 信任此设备
```

### Kendo UI 操作
必须用 Kendo API 操作下拉框，不能 DOM 直接赋值:
```javascript
const widget = $('#garz_zc').data('kendoDropDownList')
widget.select(index)
widget.trigger('change')
```

### 学年度/学期级联
周次下拉框依赖学年度和学期选择。`ensureAcademicFilters()` 自动扫描页面 Kendo 下拉框并设置正确的学年度和学期。

### 保存验证
保存后检查 grid 行数 (`#xq_pb_grid` / `#xq_th_grid` tbody tr) 确认录入成功，不再依赖弹窗状态检测。

### 按钮多语言
中英双语匹配: `获取验证码`/`Obtain`、`登录`/`Sign in`、`信任此设备`/`Trust this device`

### 去重逻辑
- 陪伴: 检查 `#xq_pb_grid` 行数
- 谈话: 检查 `#xq_th_grid` 行数
- force 模式: 跳过去重，强制录入

### 浏览器并发
- 单 Chromium 实例 + 2 个独立 Context
- 空闲 60 秒自动关闭释放内存

### 信任设备优化
优先点击「信任此设备」而非「仅本次登录」，减少 MFA 验证次数。

---

## 微信小程序

### 开发
1. 微信开发者工具 → 导入 `miniprogram/` 目录
2. 详情 → 本地设置 → 勾选「不校验合法域名」
3. 编译预览

### 页面结构
```
pages/
├── index/          # 首页 — 周次状态 + 功能入口
├── record/         # 录入页 — 登录 + 周次/学生选择 + 配置
├── progress/       # 进度页 — 实时进度 + 验证码
├── result/         # 结果页 — 统计 + 日志
├── settings/       # 设置页 — 凭证 + 周次基准
├── history/        # 历史记录
├── gradeQuery/     # 成绩查询 (已隐藏)
└── gradeResult/    # 成绩结果 (已隐藏)
```

---

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 无法选择周次 | 学年度/学期未设置 | 自动调用 ensureAcademicFilters |
| 保存成功但学工系统无记录 | Kendo 表单需 API 赋值 | 优先使用 widget.value() |
| 验证码不显示 | 页面语言为英文 | 已支持中英双语匹配 |
| SSO session 过期 | 长时间未操作 | 自动重新登录 |
| 名字显示"已完成" | 状态文字被误识别 | 已排除状态关键词 |

---

## 维护更新

### 更新周次基准
- 设置页 → 手动选择新学期第1周周一
- 或 `POST /api/week/update-calendar` 自动抓取校历

### 添加新的录制类型
1. `server/services/` 新增引擎 (参考 `companion.js`)
2. `server/services/orchestrator.js` 新增类型处理
3. 数据库 `tasks.type` ENUM 新增值
4. 前端新增入口和配置项
