const boss = require("../lib")

async function start()
{
    await boss.init(1)

    boss.on_invoke(function (func_name, ...args)
    {
        console.log(`get invoke:${func_name}(${args})`)
    })

    boss.on_call(function (func_name, ...args)
    {
        console.log(`get call:${func_name}(${args})`)
        return true
    })

    for (let i = 0, len = 1; i < len; ++i)
    {
        let id = await boss.new_worker("./example/test_service_child.js", 1, 2, 3)

        console.log(`-----new worker back:${id}`)
    }
}

start()








