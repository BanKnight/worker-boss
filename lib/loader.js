const boss = require("./index")

async function start()
{
    await boss.init()

    process.argv.splice(1, 1)

    // console.log("loader begin to load:" + process.argv[1])

    require(process.argv[1])
}

start()
