let config = require("./cluster_config")
let boss = require("../lib")

if (process.argv.length < 2)
{
    console.error("required more args")
    process.exit(1)
}

let name = process.argv[2]

async function start()
{
    switch (name)
    {
        case "server":
            {
                await boss.init(config.server)
            }
            break
        case "client":
            {
                await boss.init(config.client)

                let ret = await boss.call_worker(1, "echo", "this is a centence")

                console.debug(`get ret:`, ret)

                boss.die()
            }
            break
    }
}

start()

boss.on_dispatch(function (func_name, ...args)
{
    console.debug(func_name, ...args)

    return args[0]
})
