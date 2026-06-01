const api = require('../../utils/api')

Page({
  data: {
    items: [],
    total: 0,
    page: 1
  },

  onShow() {
    this.loadHistory()
  },

  async loadHistory() {
    try {
      const res = await api.get('/api/history', {
        openid: wx.getStorageSync('openid'),
        page: 1,
        pageSize: 50
      })
      // 格式化日期
      const items = (res.items || []).map(item => ({
        ...item,
        createdAt: item.createdAt ? item.createdAt.slice(0, 10) : ''
      }))
      this.setData({ items, total: res.total })
    } catch (_) {}
  },

  viewDetail(e) {
    const taskUuid = e.currentTarget.dataset.taskuuid
    if (taskUuid) {
      wx.navigateTo({
        url: `/pages/result/result?taskUuid=${taskUuid}`
      })
    }
  }
})
