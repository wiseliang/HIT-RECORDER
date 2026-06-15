const api = require('../../utils/api')

Page({
  data: {
    taskUuid: '',
    status: '',
    year: '', school: '', major: '',

    // 统计
    studentCount: 0,
    courseProgress: 0,
    avgGpa: 0,
    totalFailed: 0,
    currentPhase: '',

    // 数据
    students: [],
    summary: {},

    // UI 状态
    expandedIndex: -1,
    loadingCourses: false,
    currentCourses: [],
    currentStudentName: '',

    // 导出
    plainText: '',
    csvData: '',

    // 验证码
    needsCaptcha: false,
    captchaImage: '',
    code: '',
    submitting: false,

    // 标签
    activeTab: 'students',  // 'students' | 'courses'

    // 诊断
    diagnosing: false,
    diagResult: null
  },

  timer: null,

  onLoad(options) {
    this.setData({ taskUuid: options.taskUuid })
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
      const task = await api.get(`/api/grade/${this.data.taskUuid}`)

      // 检查是否需要验证码
      if (task.needsCaptcha) {
        this.setData({
          needsCaptcha: true,
          captchaImage: task.captchaImage,
          status: task.status
        })
        return
      }

      if (task.status === 'awaiting_code' && !task.needsCaptcha) {
        // MFA 验证码
        this.setData({
          status: 'awaiting_code',
          currentPhase: task.currentPhase || '需要HIT APP验证码',
          needsCaptcha: false
        })
        return
      }

      this.setData({
        status: task.status,
        qrcode: task.qrcode || '',
        year: task.year,
        school: task.school,
        major: task.major,
        studentCount: task.studentCount,
        courseProgress: task.courseProgress,
        avgGpa: task.avgGpa,
        totalFailed: task.totalFailed,
        currentPhase: task.currentPhase || '',
        summary: task.summary || {}
      })

      if (task.results && Array.isArray(task.results)) {
        this.setData({ students: task.results })
      }

      if (task.status === 'completed' || task.status === 'failed') {
        this.stopPolling()
        // 加载导出数据
        if (task.status === 'completed') {
          this.loadExportData()
        }
      }
    } catch (_) {}
  },

  async loadExportData() {
    try {
      const data = await api.get(`/api/grade/${this.data.taskUuid}/export?format=json`)
      this.setData({
        plainText: data.plainText || '',
        csvData: data.csvData || ''
      })
    } catch (_) {}
  },

  // ===== 验证码提交 =====
  onCodeInput(e) {
    this.setData({ code: e.detail.value })
  },

  async submitCaptchaOrCode() {
    const code = this.data.code.trim()
    if (!code || code.length < 4) {
      wx.showToast({ title: '请输入验证码', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      await api.post(`/api/grade/${this.data.taskUuid}/submit-code`, { code })
      this.setData({ needsCaptcha: false, status: 'running', code: '' })
      wx.showToast({ title: '已提交', icon: 'success' })
      this.startPolling()
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // ===== 课程展开 =====
  async toggleStudentCourses(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    const student = this.data.students[index]
    if (!student) return

    // 如果已展开则收起
    if (this.data.expandedIndex === index) {
      this.setData({ expandedIndex: -1, currentCourses: [], currentStudentName: '' })
      return
    }

    // 如果已有课程数据，直接显示
    if (student.coursesExtracted && student.courses && student.courses.length > 0) {
      this.setData({
        expandedIndex: index,
        currentCourses: student.courses,
        currentStudentName: student.name
      })
      return
    }

    // 从服务器加载
    this.setData({ loadingCourses: true })
    try {
      const res = await api.get(`/api/grade/${this.data.taskUuid}/student/${index}/courses`)
      this.setData({
        expandedIndex: index,
        currentCourses: res.courses || [],
        currentStudentName: student.name,
        loadingCourses: false
      })
    } catch (e) {
      wx.showToast({ title: '加载课程失败', icon: 'none' })
      this.setData({ loadingCourses: false })
    }
  },

  // ===== 标签切换 =====
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  // ===== 导出 =====
  copyToClipboard() {
    if (!this.data.plainText) {
      wx.showToast({ title: '暂无数据可复制', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: this.data.plainText,
      success() {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' })
      }
    })
  },

  copyCsv() {
    if (!this.data.csvData) {
      wx.showToast({ title: '暂无CSV数据', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: this.data.csvData,
      success() {
        wx.showToast({ title: 'CSV已复制，可粘贴到Excel', icon: 'success' })
      }
    })
  },

  async runDiagnose() {
    this.setData({ diagnosing: true, diagResult: null })
    try {
      const res = await api.get(`/api/grade/${this.data.taskUuid}/diagnose`)
      this.setData({ diagResult: res })
      if (res.screenshot) {
        wx.showToast({ title: '诊断完成，含截图', icon: 'success' })
      } else {
        wx.showToast({ title: '诊断完成', icon: 'success' })
      }
    } catch (e) {
      wx.showToast({ title: '诊断失败: ' + (e.message || '未知'), icon: 'none' })
    } finally {
      this.setData({ diagnosing: false })
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

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
