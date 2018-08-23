let boss = require("../lib")
let argv = process.argv

let as_father = async function ()
{
    await boss.init(1)

    console.debug("speaking")

    let id = await boss.new_worker(__filename, "child")

    boss.send_worker(id, "ping")

    let ret = await boss.call_worker(id, "echo", "this is a sentence")

    console.debug("get back from", id, ret)

    await boss.die()
}

let as_child = function ()
{
    console.debug("speaking", boss.self())

    boss.on_dispatch(function (func_name, arg)
    {
        switch (func_name)
        {
            case "ping":
                console.log("get ping")
                break
            case "echo":
                console.log("return echo")
                return arg
                break
        }
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