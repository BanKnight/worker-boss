const boss = require("../lib")

let cmds = {}
let count = 0

boss.on_invoke(function (func_name, ...args)
{
    cmds[func_name](...args)
})

boss.on_call(function (func_name, ...args)
{
    return cmds[func_name](...args)
})

let ping_count = 0
cmds.ping = function (remote_count)
{
    ping_count++
    if (ping_count != remote_count)
    {
        console.error(`count error:${ping_count} ${remote_count}`)
    }
    else if (ping_count % 1000 == 0)
    {
        console.log(`get ping:${ping_count}`)
    }
    // console.log(`get ping:${count}`)

    return ping_count
}

let ping_without_ret_count = 0
cmds.ping_without_ret = function (remote_count)
{
    ping_without_ret_count++
    if (ping_without_ret_count != remote_count)
    {
        console.error(`count error:${ping_without_ret_count} ${remote_count}`)
    }
    else if (ping_without_ret_count % 1000 == 0)
    {
        console.log(`get ping:${ping_without_ret_count}`)
    }
    // console.log(`get ping:${count}`)
}