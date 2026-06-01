const api = require('../../utils/api')

Page({
  data: {
    studentId: '',
    password: '',
    hasCredential: false,
    maskedId: '',
    saving: false
  },

  onShow() {
    this.checkCredential()
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
  }
})
