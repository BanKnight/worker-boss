# worker-boss
a lib for nodejs to create multy process and still have a good feeling

# why we use this
+ convenien way to create multy process
+ less cost to send message to another process

# boss.init(cluster_id)
the first process must use this method to tell what the cluster id is
```js
const boss = require("worker-boss")

await boss.init(1)
```

# boss.new_worker(file,...args)
creat a new worker that is running in another process
```js
let id = await boss.new_worker("./example/test_service_step.js",1,2,3)
```

# boss.invoke_worker(target_worker,func_name,...args)
do a remote invoke to the target_worker,and the target worker must regist a callback
```js
boss.invoke_worker(id, "test_123")
```

# boss.call_worker(target_worker,func_name,...args)
do a rpc to the target_worker,and the target worker must regist a callback
```js
let ret = await boss.call_worker(id, "test_123", false)
console.log(`get result:${ret}`)
```

# boss.on_invoke(function (func_name, ...args){...})
regist invoke callback
```js
boss.on_invoke(function (func_name, ...args)
{
    console.log(`get call:${func_name}(${args})`)
    return args
})
```

# boss.on_call(function (func_name, ...args){})
regist a rpc callback
```js
boss.on_call(function (func_name, ...args)
{
    console.log(`get call:${func_name}(${args})`)
    return args
})
```

# full example
[github](https://github.com/BanKnight/worker-boss/blob/master/example/test_service_father.js)

