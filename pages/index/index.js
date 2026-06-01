const api = require('../../utils/api')
const { getCurrentWeek, getWeekRange } = require('../../utils/week')

Page({
  data: {
    week: 0, weekRange: '', isOdd: true, hasCredential: false
  },

  onShow() {
    const week = getCurrentWeek()
    this.setData({ week, weekRange: getWeekRange(week), isOdd: week % 2 === 1 })
    this.checkCred()
  },

  async checkCred() {
    try {
      const res = await api.get('/api/auth/credential')
      this.setData({ hasCredential: res.hasCredential })
    } catch (_) {}
  },

  goRecord(e) {
    if (!this.data.hasCredential) {
      wx.showToast({ title: '请先配置凭证', icon: 'none' })
      return
    }
    const type = e.currentTarget.dataset.type
    wx.navigateTo({ url: `/pages/record/record?type=${type}&week=${this.data.week}` })
  },

  goSettings() {
    wx.switchTab({ url: '/pages/settings/settings' })
  }
})
