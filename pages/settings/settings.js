const api = require('../../utils/api')
const { getCurrentWeek, getWeekRange } = require('../../utils/week')

Page({
  data: {
    studentId: '',
    password: '',
    hasCredential: false,
    maskedId: '',
    saving: false,

    // 周次基准
    week1Date: '',
    currentWeek: 0,
    weekRange: '',
    newStartDate: '',
    settingWeek: false
  },

  onShow() {
    this.checkCredential()
    this.loadWeekInfo()
  },

  async checkCredential() {
    const openid = wx.getStorageSync('openid')
    if (!openid) return

    try {
      const res = await api.get('/api/auth/credential')
      this.setData({
        hasCredential: res.hasCredential
      })
    } catch (_) {}
  },

  onStudentId(e) {
    this.setData({ studentId: e.detail.value })
  },

  onPassword(e) {
    this.setData({ password: e.detail.value })
  },

  async saveCredential() {
    const { studentId, password } = this.data
    if (!studentId.trim()) {
      wx.showToast({ title: '请输入学号', icon: 'none' })
      return
    }
    if (!password.trim()) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }

    this.setData({ saving: true })

    try {
      await api.post('/api/auth/credential', {
        openid: wx.getStorageSync('openid'),
        studentId: studentId.trim(),
        password: password.trim()
      })

      wx.showToast({ title: '保存成功', icon: 'success' })

      const masked = studentId.trim().replace(/.(?=.{2})/g, '*')
      this.setData({
        hasCredential: true,
        maskedId: masked,
        password: ''
      })
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  async clearCredential() {
    wx.showModal({
      title: '确认清除',
      content: '清除后需要重新配置学号密码才能使用',
      success: async (res) => {
        if (res.confirm) {
          // 简单标记清除：在服务器端需要额外接口，这里先做本地标记
          this.setData({
            hasCredential: false,
            maskedId: '',
            studentId: ''
          })
          wx.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  },

  // ===== 周次基准 =====
  loadWeekInfo() {
    const week = getCurrentWeek()
    this.setData({
      currentWeek: week,
      weekRange: getWeekRange(week),
      week1Date: '2026-03-09'
    })
  },

  onDateChange(e) {
    this.setData({ newStartDate: e.detail.value })
  },

  async setWeekStart() {
    const { newStartDate } = this.data
    if (!newStartDate) {
      wx.showToast({ title: '请先选择日期', icon: 'none' })
      return
    }

    const d = new Date(newStartDate.replace(/-/g, '/'))
    if (d.getDay() !== 1) {
      const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      wx.showModal({
        title: '日期不是周一',
        content: `选择的日期是${dayNames[d.getDay()]}，请选择周一`,
        showCancel: false
      })
      return
    }

    this.setData({ settingWeek: true })
    try {
      const res = await api.post('/api/week/set-start-date', { date: newStartDate })
      wx.showToast({ title: '周次基准已更新', icon: 'success' })
      this.setData({
        week1Date: res.newDate,
        currentWeek: res.currentWeek,
        weekRange: res.weekRange,
        newStartDate: ''
      })
    } catch (e) {
      wx.showModal({ title: '更新失败', content: e.message, showCancel: false })
    } finally {
      this.setData({ settingWeek: false })
    }
  }
})
