let boss = require("../lib")
let argv = process.argv

if (argv.length < 3)
{
    console.log("required more args")
    return
}

let as_father = async function ()
{
    await boss.init(1)

    let id = await boss.new_worker(__filename, "son")

    boss.send_worker(id, "ping")
}

let as_son = async function ()
{
    let id = await boss.new_worker(__filename, "child")

    boss.send_worker(id, "test")
}

let as_child = function ()
{
    console.log("speaking")

    setTimeout(() =>
    {
        boss.die()
    }, 1000)
}

boss.on_dispatch(function (func_name, ...args)
{
    console.debug(func_name, ...args)
})

let start = async () =>
{
    switch (argv[2])
    {
        case "father":
            as_father()
            break
        case "son":
            as_son()
            break
        case "child":
            as_child()
            break
    }
}

start()