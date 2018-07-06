let awesome = require("../lib")

async function thread(thread_name)
{
    console.log(`[${Date.now()}] ${thread_name} begin to get lock`)

    await awesome.lock("mutex")

    console.log(`[${Date.now()}] ${thread_name} get lock`)

    setTimeout(()=>
    {
        console.log(`[${Date.now()}] ${thread_name} unlock`)

        awesome.unlock("mutex")

    },3000)
}

awesome.safe_lock("mutex",()=>
{
    console.log("do something1")
})

awesome.safe_lock("mutex",()=>
{
    console.log("do something2")
})

for(let i = 0;i < 3;++i)
{
    setImmediate(()=>
    {
        thread(`thread_${i}`)
    })
}


