const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
test('mini program includes bearer token and stores a verified login',async()=>{
  const store={openid:'legacy',authToken:'old-token'};let sent
  const wx={getStorageSync:k=>store[k],setStorageSync:(k,v)=>store[k]=v,request:options=>{sent=options;options.success({statusCode:200,data:{success:true}})},login:options=>options.success({code:'real-wx-code'})}
  const context={wx,console,module:{exports:{}}}
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../utils/api.js'),'utf8'),context)
  await context.module.exports.get('/api/auth/credential')
  assert.equal(sent.header.Authorization,'Bearer old-token')
  let app
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),{wx,console,App:a=>app=a,require:()=>({post:async(p,data)=>{
    assert.equal(data.code,'real-wx-code');return {openid:'verified-wx-user',token:'new-token',hasCredential:true}
  }})})
  await app.doLogin()
  assert.equal(store.openid,'verified-wx-user');assert.equal(store.authToken,'new-token')
})
