const boss = require("../lib")

// console.dir(process.env)

async function start()
{
    await boss.init()

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
}

start()










