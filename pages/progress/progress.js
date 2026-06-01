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
        percent
      })

      if (task.status === 'completed' || task.status === 'failed') {
        this.stopPolling()
        setTimeout(() => {
          wx.redirectTo({ url: `/pages/result/result?taskUuid=${this.data.taskUuid}` })
        }, 1500)
      }
    } catch (_) {}
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value })
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
      wx.showToast({ title: e.message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  goResult() {
    wx.redirectTo({ url: `/pages/result/result?taskUuid=${this.data.taskUuid}` })
  }
})
