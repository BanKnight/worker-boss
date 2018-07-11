const boss = require("../lib")

let cmds = {}

async function start()
{
    await boss.init(1)

    boss.on_invoke(function (func_name, ...args)
    {
        cmds[func_name](...args)
    })

    boss.on_call(function (func_name, ...args)
    {
        return cmds[func_name](...args)
    })

    let id = await boss.new_worker("./example/test_bench_worker.js")

    console.log(`-----new worker back:${id}`)

    // let remote_count = await boss.call_worker(id, "ping", 1)

    // test_call(id)
    test_send(id)
}

start()

function test_call(id)
{
    let count = 0

    setInterval(async () =>
    {
        for (let i = 0, len = 10; i < len; ++i)
        {
            count++
            let remote_count = await boss.call_worker(id, "ping", count)

            if (remote_count != count)
            {
                console.error(`count error:${count} ${remote_count}`)
                process.exit(1)
            }
            else if (count % len == 0)
            {
                console.log(`curr count is ${count}`)
            }
        }
    }, 1000)
}

function test_send(id)
{
    let count = 0
    setInterval(async () =>
    {
        for (let i = 0, len = 1000; i < len; ++i)
        {
            count++
            boss.send_worker(id, "ping_without_ret", count)
        }
    }, 1000)
}