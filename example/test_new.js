let boss = require("../lib")
let argv = process.argv

let as_father = async function ()
{
    await boss.init(1)

    let len = 30
    for (let i = 0; i < len; ++i)
    {
        await boss.new_worker(__filename, i)
    }

    console.debug(`finish creating ${len} child`)

    await boss.die()
}

let as_child = function ()
{
    console.debug(`this is child: ${argv[2]}`)
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