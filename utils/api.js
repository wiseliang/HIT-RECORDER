// Cloudflare Tunnel（临时域名，重启会变）
// Cloudflare Tunnel URL（服务器重启后会变，需同步更新）
const BASE_URL = 'https://terrorists-solaris-trail-care.trycloudflare.com'
// 原直连: 'https://118.190.208.230'
// 原服务器直连: 'https://118.190.208.230'

function request(method, path, data) {
  const openid = wx.getStorageSync('openid')
  const header = {
    'Content-Type': 'application/json'
  }
  const token = wx.getStorageSync('authToken')
  if (token) header.Authorization = 'Bearer ' + token
  if (openid) {
    header['x-openid'] = openid
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method,
      data,
      header,
      timeout: 90000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          const msg = (res.data && res.data.error) || `HTTP ${res.statusCode}`
          reject(new Error(msg))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg))
      }
    })
  })
}

module.exports = {
  get: (path, data) => request('GET', path, data),
  post: (path, data) => request('POST', path, data),
  BASE_URL
}
