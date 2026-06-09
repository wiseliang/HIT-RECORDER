const api = require('../../utils/api')

Page({
  data: {
    type: 'companion', week: 0, typeName: '',
    loginStep: 'init', code: '', checking: false, submitting: false, recording: false,

    // 学生
    students: [], selectedCount: 0, loadingStudents: false,

    // 周次（多选，默认勾选本周）
    weeks: [],

    // 陪伴
    pbTypes: ['共同上课', '共同进餐', '共上自习', '共同运动'],
    pbType: '共同上课',

    // 谈话
    scenes: ['走访寝室', '走访课堂'],
    scene: '走访寝室',

    // 工作内容
    contentText: ''
  },

  onLoad(options) {
    const { type, week } = options
    const currentWeek = parseInt(week) || 1
    const typeNames = { companion: '录入陪伴', talk: '录入谈话', batch: '一键录入', 'fill-missing': '查询补录' }

    // 构建周次列表：每项 {val, checked, typeHint}
    const weekList = []
    for (let w = 1; w <= currentWeek; w++) {
      weekList.push({
        val: w,
        checked: w === currentWeek,  // 默认勾选本周
        typeHint: w % 2 === 1 ? '陪伴' : '谈话'
      })
    }

    this.setData({
      type, week: currentWeek,
      typeName: typeNames[type] || '录入',
      weeks: weekList,
      pbType: '共同上课',
      scene: '走访寝室',
      contentText: type === 'companion' ? '查课' : '查寝'
    })
  },

  // ===== 登录 =====
  async checkLogin() {
    this.setData({ checking: true })
    try {
      const res = await api.post('/api/auth/start-login', { openid: wx.getStorageSync('openid') })
      if (res.loginFailed) {
        // 登录卡在 authserver，展示截图帮助排查
        this.setData({
          loginStep: 'loginFailed',
          loginFailedMsg: res.message,
          loginFailedScreenshot: res.screenshot,
          loginFailedDiag: res.diag
        })
      } else if (res.needsCaptcha) {
        this.setData({ loginStep: 'needCaptcha', captchaImage: res.captchaImage })
      } else if (res.needsCode) {
        this.setData({ loginStep: 'needCode' })
      } else {
        this.setData({ loginStep: 'done' })
      }
    } catch (e) {
      wx.showModal({ title: '登录失败', content: e.message, showCancel: false })
    } finally { this.setData({ checking: false }) }
  },

  onCaptchaInput(e) { this.setData({ captchaText: e.detail.value }) },

  async submitCaptcha() {
    const text = (this.data.captchaText || '').trim()
    if (!text) { wx.showToast({ title: '请输入验证码', icon: 'none' }); return }
    this.setData({ submitting: true })
    try {
      const res = await api.post('/api/auth/submit-captcha', {
        openid: wx.getStorageSync('openid'), captcha: text
      })
      if (res.needsCaptcha) {
        this.setData({ captchaImage: res.captchaImage, captchaText: '' })
        wx.showToast({ title: '验证码错误，请重试', icon: 'none' })
      } else if (res.needsCode) {
        this.setData({ loginStep: 'needCode' })
      } else {
        this.setData({ loginStep: 'done' })
      }
    } catch (e) {
      wx.showModal({ title: '提交失败', content: e.message, showCancel: false })
    } finally { this.setData({ submitting: false }) }
  },

  onCodeInput(e) { this.setData({ code: e.detail.value }) },

  async resendCode() {
    this.setData({ resending: true })
    try {
      await api.post('/api/auth/resend-code', { openid: wx.getStorageSync('openid') })
      wx.showToast({ title: '已重新发送', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: e.message || '重发失败', icon: 'none' })
    } finally {
      this.setData({ resending: false })
    }
  },

  async submitCode() {
    const code = this.data.code.trim()
    if (code.length < 4) { wx.showToast({ title: '请输入完整验证码', icon: 'none' }); return }
    this.setData({ submitting: true })

    // QR 登录的 MFA 走不同端点
    if (this.data.isQrMfa) {
      try {
        const res = await api.post('/api/auth/qrcode-submit-code', { openid: wx.getStorageSync('openid'), code })
        if (res.success) {
          wx.showToast({ title: 'MFA 验证成功！', icon: 'success' })
          this.setData({ loginStep: 'done', isQrMfa: false })
        } else {
          wx.showToast({ title: res.message || '验证失败', icon: 'none' })
        }
      } catch (e) {
        wx.showModal({ title: '提交失败', content: e.message, showCancel: false })
      } finally { this.setData({ submitting: false }) }
      return
    }

    try {
      await api.post('/api/auth/submit-code', { openid: wx.getStorageSync('openid'), code })
      wx.showToast({ title: '验证成功', icon: 'success' })
      this.setData({ loginStep: 'done' })
    } catch (e) {
      wx.showModal({ title: '验证失败', content: e.message, showCancel: false })
    } finally { this.setData({ submitting: false }) }
  },

  // ===== 学生列表 =====
  async loadStudents() {
    this.setData({ loadingStudents: true })
    try {
      const firstChecked = this.data.weeks.find(w => w.checked)
      const targetWeek = firstChecked ? firstChecked.val : this.data.week
      const res = await api.get(`/api/auth/student-list?week=${targetWeek}`)
      const students = (res.students || []).map(s => ({ ...s, _checked: true, _hasRecord: false }))
      this.setData({ students, selectedCount: students.length })
    } catch (e) {
      wx.showModal({ title: '加载失败', content: e.message, showCancel: false })
    } finally { this.setData({ loadingStudents: false }) }
  },

  // ===== 周次多选 =====
  toggleWeek(e) {
    const val = parseInt(e.currentTarget.dataset.val)
    const weeks = this.data.weeks.map(w =>
      w.val === val ? { ...w, checked: !w.checked } : w
    )
    const allChecked = weeks.every(w => w.checked)
    this.setData({ weeks, weekAllChecked: allChecked })
  },

  toggleAllWeeks() {
    const allChecked = !this.data.weekAllChecked
    const weeks = this.data.weeks.map(w => ({ ...w, checked: allChecked }))
    this.setData({ weeks, weekAllChecked: allChecked })
  },

  // ===== 学生勾选 =====
  toggleStudent(e) {
    const idx = parseInt(e.currentTarget.dataset.index)
    const students = this.data.students.map(s =>
      s.index === idx ? { ...s, _checked: !s._checked } : s
    )
    const allChecked = students.every(s => s._checked)
    this.setData({ students, selectedCount: students.filter(s => s._checked).length, studentAllChecked: allChecked })
  },

  toggleAllStudents() {
    const allChecked = !this.data.studentAllChecked
    const students = this.data.students.map(s => ({ ...s, _checked: allChecked }))
    this.setData({ students, selectedCount: allChecked ? students.length : 0, studentAllChecked: allChecked })
  },

  selectPbType(e) {
    const t = e.currentTarget.dataset.type
    this.setData({ pbType: t, contentText: t === '共同上课' ? '查课' : '' })
  },

  selectScene(e) {
    const s = e.currentTarget.dataset.scene
    this.setData({ scene: s, contentText: s === '走访寝室' ? '查寝' : '查课' })
  },

  onContent(e) { this.setData({ contentText: e.detail.value }) },

  // ===== 开始录入 =====
  async startRecord() {
    const { type, students, pbType, scene, contentText, weeks } = this.data
    this.setData({ recording: true })

    const selectedWeeks = weeks.filter(w => w.checked).map(w => w.val)

    const options = {}
    if (type === 'companion') {
      options.pbType = pbType
      options.content = contentText || undefined
    } else if (type === 'talk') {
      options.scene = scene
      options.content = contentText || undefined
    }

    // 筛选学生
    const selected = students.filter(s => s._checked)
    if (selected.length < students.length && selected.length > 0) {
      options.studentIndices = selected.map(s => s.index)
    }

    // 多周次
    if (type !== 'batch' && selectedWeeks.length > 0) {
      options.weeks = selectedWeeks
    }

    try {
      const res = await api.post('/api/task/create', {
        openid: wx.getStorageSync('openid'),
        type,
        week: type === 'batch' ? 0 : (selectedWeeks[0] || 1),
        options
      })
      wx.navigateTo({
        url: `/pages/progress/progress?taskUuid=${res.taskUuid}&type=${type}&week=${selectedWeeks[0] || 1}`
      })
    } catch (e) {
      wx.showModal({ title: '创建失败', content: e.message, showCancel: false })
    } finally { this.setData({ recording: false }) }
  },

  // ===== 二维码登录 =====
  async startQrLogin() {
    this.setData({ checking: true })
    try {
      const res = await api.post('/api/auth/qrcode-start', { openid: wx.getStorageSync('openid') })
      if (res.loggedIn) {
        // session 有效，SSO 自动跳过，直接登录成功
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
    } finally { this.setData({ checking: false }) }
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
      }
      // 扫码成功但需要 MFA 验证码
      else if (res.needsMfa) {
        this.setData({ loginStep: 'needCode', code: '', isQrMfa: true })
      }
      else {
        wx.showToast({ title: '尚未扫码，请扫描后再试', icon: 'none' })
      }
    } catch (e) {
      wx.showModal({ title: '验证失败', content: e.message, showCancel: false })
    } finally { this.setData({ checkingQr: false }) }
  },

  async submitQrMfaCode() {
    const code = this.data.code.trim()
    if (code.length < 4) { wx.showToast({ title: '请输入完整验证码', icon: 'none' }); return }
    this.setData({ submitting: true })
    try {
      const res = await api.post('/api/auth/qrcode-submit-code', { openid: wx.getStorageSync('openid'), code })
      if (res.success) {
        wx.showToast({ title: 'MFA 验证成功！', icon: 'success' })
        this.setData({ loginStep: 'done' })
      } else {
        wx.showToast({ title: res.message || '验证失败', icon: 'none' })
      }
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
  }
})
