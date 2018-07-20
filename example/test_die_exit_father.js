const boss = require("../lib")

async function start()
{
    await boss.init(1)

    for (let i = 0, len = 50; i < len; ++i)
    {
        await boss.new_worker("./example/test_die_exit_son.js", i)
    }

    console.log(`-----!!!new worker done:${boss.count()}`)

    await boss.die()

}

start()








