const api = require('../../utils/api')

Page({
  data: {
    week: 0, weekRange: '', isOdd: true, hasCredential: false
  },

  onShow() {
    api.get('/api/week/current').then(r => {
      this.setData({ week: r.week, weekRange: r.weekRange, isOdd: r.isOdd })
    }).catch(() => wx.showToast({ title: '无法获取当前周次', icon: 'none' }))
    this.checkCred()
  },

  async checkCred() {
    try {
      const res = await api.get('/api/auth/credential')
      this.setData({ hasCredential: res.hasCredential })
    } catch (_) {}
  },

  goRecord(e) {
    if (!this.data.week) return
    if (!this.data.hasCredential) {
      wx.showToast({ title: '请先配置凭证', icon: 'none' })
      return
    }
    const type = e.currentTarget.dataset.type
    wx.navigateTo({ url: `/pages/record/record?type=${type}&week=${this.data.week}` })
  },

  goGradeQuery() {
    if (!this.data.hasCredential) {
      wx.showToast({ title: '请先配置凭证', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/gradeQuery/gradeQuery' })
  },

  goSettings() {
    wx.switchTab({ url: '/pages/settings/settings' })
  }
})
