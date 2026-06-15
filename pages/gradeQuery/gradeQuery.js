const api = require('../../utils/api')

Page({
  data: {
    // 登录
    loginStep: 'init',  // init | qrcode | needCode | done
    checkLoginResult: null,

    // 查询条件
    years: ['2022', '2023', '2024'],
    selectedYear: 0,
    schools: ['信息科学与工程学院'],
    selectedSchool: 0,
    majors: ['自动化'],
    selectedMajor: 0,
    extractCourses: true,
    querying: false
  },

  onShow() {
    this.checkCred()
  },

  async checkCred() {
    try {
      const res = await api.get('/api/auth/credential')
      if (!res.hasCredential) {
        wx.showToast({ title: '请先在设置页配置工号和密码', icon: 'none' })
      }
    } catch (_) {}
  },

  onYearChange(e) { this.setData({ selectedYear: parseInt(e.detail.value) }) },
  onSchoolChange(e) { this.setData({ selectedSchool: parseInt(e.detail.value) }) },
  onMajorChange(e) { this.setData({ selectedMajor: parseInt(e.detail.value) }) },
  toggleExtractCourses() { this.setData({ extractCourses: !this.data.extractCourses }) },

  // ===== 密码登录（成绩查询专用，走完整 ivpn 登录链） =====
  async checkLogin() {
    this.setData({ checking: true })
    try {
      const res = await api.post('/api/grade/login-start', {
        openid: wx.getStorageSync('openid'),
        mode: 'password'
      })
      this.handleLoginResult(res)
    } catch (e) {
      wx.showModal({ title: '登录失败', content: e.message, showCancel: false })
    } finally { this.setData({ checking: false }) }
  },

  // 处理登录响应
  handleLoginResult(res) {
    if (res.error) {
      wx.showModal({ title: '登录失败', content: res.error, showCancel: false })
    } else if (res.done) {
      this.setData({ loginStep: 'done' })
    } else if (res.loginFailed) {
      this.setData({
        loginStep: 'loginFailed',
        loginFailedMsg: res.message,
        loginFailedScreenshot: res.screenshot
      })
    } else if (res.needsCaptcha) {
      this.setData({ loginStep: 'needCaptcha', captchaImage: res.captchaImage })
    } else if (res.needsCode) {
      this.setData({ loginStep: 'needCode', code: '', isQrMfa: false })
    } else if (res.hasQrCode) {
      this.setData({ loginStep: 'qrcode', qrcodeImage: res.qrcode, qrMessage: res.message })
    } else {
      this.setData({ loginStep: 'done' })
    }
  },

  async submitCode() {
    const code = this.data.code.trim()
    if (code.length < 4) { wx.showToast({ title: '请输入完整验证码', icon: 'none' }); return }
    this.setData({ submitting: true })
    try {
      const res = await api.post('/api/grade/login-submit-code', {
        openid: wx.getStorageSync('openid'), code
      })
      this.handleLoginResult(res)
    } catch (e) {
      wx.showModal({ title: '提交失败', content: e.message, showCancel: false })
    } finally { this.setData({ submitting: false }) }
  },

  onCodeInput(e) { this.setData({ code: e.detail.value }) },
  onCaptchaInput(e) { this.setData({ captchaText: e.detail.value }) },

  async submitCaptcha() {
    const text = (this.data.captchaText || '').trim()
    if (!text) { wx.showToast({ title: '请输入验证码', icon: 'none' }); return }
    this.setData({ submitting: true })
    try {
      const res = await api.post('/api/grade/login-submit-code', {
        openid: wx.getStorageSync('openid'), code: text
      })
      this.handleLoginResult(res)
    } catch (e) {
      wx.showModal({ title: '提交失败', content: e.message, showCancel: false })
    } finally { this.setData({ submitting: false }) }
  },

  // ===== 二维码登录 =====
  async startQrLogin() {
    this.setData({ qrLoading: true })
    try {
      const res = await api.post('/api/auth/qrcode-start', {
        openid: wx.getStorageSync('openid'),
        target: 'ivpn'
      })
      if (res.loggedIn) {
        wx.showToast({ title: '已登录，无需扫码', icon: 'success' })
        this.setData({ loginStep: 'done' })
      } else if (res.hasQrCode) {
        this.setData({ loginStep: 'qrcode', qrcodeImage: res.qrcode, qrMessage: res.message })
      } else if (res.needsMfa) {
        this.setData({ loginStep: 'needCode', code: '', isQrMfa: true })
      } else {
        wx.showToast({ title: res.message || '获取二维码失败', icon: 'none' })
      }
    } catch (e) {
      wx.showModal({ title: '获取二维码失败', content: e.message, showCancel: false })
    } finally { this.setData({ qrLoading: false }) }
  },

  saveQrcode() {
    if (!this.data.qrcodeImage) return
    wx.getImageInfo({
      src: this.data.qrcodeImage,
      success: (imgInfo) => {
        wx.saveImageToPhotosAlbum({
          filePath: imgInfo.path,
          success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
          fail: () => wx.showToast({ title: '保存失败，请长按图片保存', icon: 'none' })
        })
      },
      fail: () => wx.showToast({ title: '请长按二维码图片保存', icon: 'none' })
    })
  },

  async checkQrLogin() {
    this.setData({ checkingQr: true })
    try {
      const res = await api.post('/api/auth/qrcode-wait', { openid: wx.getStorageSync('openid') })
      if (res.loggedIn) {
        wx.showToast({ title: '扫码登录成功！', icon: 'success' })
        this.setData({ loginStep: 'done' })
      } else if (res.needsMfa) {
        this.setData({ loginStep: 'needCode', code: '', isQrMfa: true })
      } else {
        wx.showToast({ title: '尚未扫码，请扫描后再试', icon: 'none' })
      }
    } catch (e) {
      wx.showModal({ title: '验证失败', content: e.message, showCancel: false })
    } finally { this.setData({ checkingQr: false }) }
  },

  async submitGradeMfa() {
    const code = this.data.code.trim()
    if (code.length < 4) { wx.showToast({ title: '请输入完整验证码', icon: 'none' }); return }
    this.setData({ submitting: true })
    try {
      const res = await api.post('/api/grade/login-submit-code', {
        openid: wx.getStorageSync('openid'), code
      })
      this.handleLoginResult(res)
    } catch (e) {
      wx.showModal({ title: '提交失败', content: e.message, showCancel: false })
    } finally { this.setData({ submitting: false }) }
  },

  async testQrScreenshot() {
    this.setData({ testingQr: true })
    try {
      const res = await api.post('/api/auth/qrcode-screenshot', { openid: wx.getStorageSync('openid') })
      this.setData({ testScreenshot: res.screenshot, testDiag: res.diag })
    } catch (e) {
      wx.showToast({ title: e.message || '截图失败', icon: 'none' })
    } finally { this.setData({ testingQr: false }) }
  },

  // ===== 开始查询 =====
  async startQuery() {
    const { years, selectedYear, schools, selectedSchool, majors, selectedMajor, extractCourses } = this.data
    if (this.data.querying) return
    this.setData({ querying: true })
    try {
      const res = await api.post('/api/grade/start-query', {
        openid: wx.getStorageSync('openid'),
        year: years[selectedYear] || '2022',
        school: schools[selectedSchool] || '信息科学与工程学院',
        major: majors[selectedMajor] || '自动化',
        extractCourses
      })
      wx.navigateTo({ url: `/pages/gradeResult/gradeResult?taskUuid=${res.taskUuid}` })
    } catch (e) {
      wx.showModal({ title: '查询失败', content: e.message || '创建查询任务失败', showCancel: false })
    } finally {
      this.setData({ querying: false })
    }
  }
})
