let awesome = require("../lib")

async function producer()
{
    awesome.wake("consumer", "first")

    for (let i = 0; i < 14; ++i)
    {
        await awesome.wait("producer")

        awesome.wake("consumer", i)
    }
}

async function consumer()
{
    for (let i = 0; i < 15; ++i)
    {
        let msg = await awesome.wait("consumer")

        console.log("get msg:" + msg)

        await awesome.wake("producer")
    }
}
setImmediate(consumer)
setImmediate(producer)
