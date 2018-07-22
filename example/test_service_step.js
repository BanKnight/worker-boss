const boss = require("../lib")

boss.on_invoke(function (func_name, ...args)
{
    console.log(`get invoke:${func_name}(${args})`)
})

boss.on_call(function (func_name, ...args)
{
    console.log(`get call:${func_name}(${args})`)
    return args
})

console.log(`this is step speaking ${process.argv[2]}`)