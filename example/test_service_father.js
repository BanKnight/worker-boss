const boss = require("../lib")

async function start()
{
    await boss.init(1)

    for (let i = 0, len = 10; i < len; ++i)
    {
        let id = await boss.new_worker("./example/test_service_child.js", i)

        console.log(`-----new worker back:${id}`)
    }

    setTimeout(() =>
    {
        console.log("I'm going to die")
        boss.die()
    }, 10000)
}

start()








