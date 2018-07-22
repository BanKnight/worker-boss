const boss = require("../lib")

async function wrap()
{
    for (let i = 0, len = 10; i < len; ++i)
    {
        let id = await boss.new_worker("./example/test_service_step.js", i)

        let ret = await boss.call_worker(id, "test_123", false)

        console.log(`get result:${ret}`)
    }
}

wrap()

console.log(`this is child speaking ${process.argv[2]}`)