const api = require('./utils/api')

App({
  globalData: {
    openid: '',
    hasCredential: false
  },

  onLaunch() {
    this.testNetwork()
  },

  async testNetwork() {
    // 先测试基础连通性
    wx.showLoading({ title: '连接服务器...' })
    try {
      const health = await api.get('/api/health')
      console.log('✅ 服务器连通:', health)
      wx.hideLoading()
      this.doLogin()
    } catch (e) {
      wx.hideLoading()
      console.error('❌ 网络不通:', e.message)
      wx.showModal({
        title: '网络诊断',
        content: `无法连接服务器\n${api.BASE_URL}\n\n错误：${e.message}\n\n请检查：\n1. 开发者工具详情→本地设置→勾选"不校验合法域名"\n2. 电脑能否访问该地址`,
        showCancel: false
      })
    }
  },

  async doLogin() {
    const openid = wx.getStorageSync('openid')
    if (openid) {
      this.globalData.openid = openid
      return
    }

    try {
      const res = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject })
      })

      const data = await api.post('/api/auth/login', { code: res.code })
      wx.setStorageSync('openid', data.openid)
      this.globalData.openid = data.openid
      this.globalData.hasCredential = data.hasCredential
      console.log('✅ 登录成功, openid:', data.openid)
    } catch (e) {
      console.error('Login failed:', e)
    }
  }
})
