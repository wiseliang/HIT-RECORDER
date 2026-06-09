const api = require('../../utils/api')

Page({
  data: {
    taskUuid: '',
    type: 'companion',
    week: 0,
    status: 'running',
    total: 0,
    percent: 0,
    progress: { processed: 0, success: 0, skipped: 0, error: 0 },
    currentStudent: 0,
    errors: [],
    code: '',
    submitting: false
  },

  timer: null,

  onLoad(options) {
    this.setData({ taskUuid: options.taskUuid, type: options.type, week: options.week })
    this.startPolling()
  },

  onUnload() {
    this.stopPolling()
  },

  startPolling() {
    this.timer = setInterval(() => this.fetchProgress(), 2000)
    this.fetchProgress()
  },

  stopPolling() {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  },

  async fetchProgress() {
    try {
      const task = await api.get(`/api/task/${this.data.taskUuid}`)
      const percent = task.total > 0 ? Math.round((task.progress.processed / task.total) * 100) : 0

      this.setData({
        status: task.status,
        total: task.total,
        progress: task.progress,
        currentStudent: task.currentStudent,
        errors: task.errors || [],
        percent,
        fetchError: '',  // 清除之前的错误
        // captcha 相关
        needsCaptcha: task.needsCaptcha || false,
        captchaImage: task.captchaImage || ''
      })

      if (task.status === 'completed' || task.status === 'failed') {
        this.stopPolling()
        setTimeout(() => {
          wx.redirectTo({ url: `/pages/result/result?taskUuid=${this.data.taskUuid}` })
        }, 1500)
      }
    } catch (e) {
      // 轮询失败不静默，显示错误让用户知道
      console.error('轮询进度失败:', e.message)
      this.setData({ fetchError: '网络异常，正在重试...' })
    }
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value })
  },

  async resendCode() {
    this.setData({ resending: true })
    try {
      await api.post(`/api/task/${this.data.taskUuid}/resend-code`, {})
      wx.showToast({ title: '已重新发送', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: e.message || '重发失败', icon: 'none' })
    } finally {
      this.setData({ resending: false })
    }
  },

  async submitCode() {
    const code = this.data.code.trim()
    if (!code || code.length < 4) {
      wx.showToast({ title: '请输入完整验证码', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      await api.post(`/api/task/${this.data.taskUuid}/submit-code`, { code })
      wx.showToast({ title: '已提交', icon: 'success' })
      // 状态会自动变回 running
    } catch (e) {
      const msg = e.message || '提交失败'
      wx.showToast({ title: msg, icon: 'none', duration: 3000 })
      // 如果验证码会话已过期，跳回首页重新来
      if (msg.includes('过期') || msg.includes('重新发起')) {
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' })
        }, 2000)
      }
    } finally {
      this.setData({ submitting: false })
    }
  },

  async testScreenshot() {
    this.setData({ testingQr: true })
    try {
      const res = await api.post('/api/auth/qrcode-screenshot', {
        openid: wx.getStorageSync('openid'),
        taskUuid: this.data.taskUuid
      })
      this.setData({ testScreenshot: res.screenshot, testDiag: res.diag })
    } catch (e) {
      wx.showToast({ title: e.message || '截图失败', icon: 'none' })
    } finally { this.setData({ testingQr: false }) }
  },

  goResult() {
    wx.redirectTo({ url: `/pages/result/result?taskUuid=${this.data.taskUuid}` })
  }
})
