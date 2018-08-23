let boss = require("../lib")
let argv = process.argv

let as_father = async function ()
{
    await boss.init(1)

    let id = await boss.new_worker(__filename, "child")
    for (let i = 0, len = 1000; i < len; ++i)
    {
        boss.send_worker(id, "ping", i)
    }

    let ret = await boss.call_worker(id, "test", 10)

    console.debug(`has already send msgs:${ret}`)
}

let as_child = function ()
{
    boss.on_dispatch(function (func, ...args)
    {
        console.log(func, ...args)

        return "ceshi"
    })

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