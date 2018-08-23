const awesome = require("awesome-async")

const app = require("./head")
const config = app.config

const me = app.get("dispatcher")
const data = me.data

me.on_dispatch = function (cb)
{
    data.dispatch = cb

    awesome.wake("__dispatch")
}

me.dispatch = async function (...args)
{
    if (data.dispatch == null)
    {
        await awesome.wait("__dispatch")
    }

    return await data.dispatch(...args)
}

