let boss = require("../lib")
let argv = process.argv

let as_father = async function ()
{
    await boss.init(1)

    let id = await boss.new_worker("./example/test_worker_send", "child")
    for (let i = 0, len = 1000; i < len; ++i)
    {
        boss.send_worker(id, "ping", i)
    }

    console.debug(`has already send msgs`)
}

let as_child = function ()
{
    boss.on_dispatch(function (func, ...args)
    {
        console.log(func, ...args)
    })

    boss.die()
}

let start = async () =>
{
    if (argv.length == 2)       //father
    {
        as_father()
        return
    }

    as_child()
}

start()