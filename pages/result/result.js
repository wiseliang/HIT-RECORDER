const api = require('../../utils/api')

Page({
  data: {
    taskUuid: '',
    week: 0,
    type: 'companion',
    typeName: '',
    total: 0,
    progress: { processed: 0, success: 0, skipped: 0, error: 0 },
    errors: [],
    duration: '',
    allSuccess: false
  },

  onLoad(options) {
    this.setData({ taskUuid: options.taskUuid })
    this.loadResult()
  },

  async loadResult() {
    try {
      const task = await api.get(`/api/task/${this.data.taskUuid}`)
      const typeNames = {
        companion: '录入陪伴',
        talk: '录入谈话'
      }

      // 计算用时
      let duration = ''
      if (task.startedAt && task.completedAt) {
        const start = new Date(task.startedAt)
        const end = new Date(task.completedAt)
        const sec = Math.round((end - start) / 1000)
        if (sec < 60) duration = `${sec}秒`
        else duration = `${Math.floor(sec / 60)}分${sec % 60}秒`
      }

      this.setData({
        week: task.week,
        type: task.type,
        typeName: typeNames[task.type] || task.type,
        total: task.total,
        progress: task.progress,
        errors: task.errors || [],
        duration,
        allSuccess: task.progress.error === 0
      })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  goAgain() {
    const { type, week } = this.data
    wx.redirectTo({
      url: `/pages/record/record?type=${type}&week=${week}`
    })
  }
})
