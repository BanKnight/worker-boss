const boss = require("../lib")

console.log("this is step speaking")

boss.on_invoke(function (func_name, ...args)
{
    console.log(`get invoke:${func_name}(${args})`)
})

boss.on_call(function (func_name, ...args)
{
    console.log(`get call:${func_name}(${args})`)
    return args
})












