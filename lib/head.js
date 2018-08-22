const app = module.exports = {}

app.config = {}
app.modules = {}
app.sorted_mds = []

app.define = function (name, info)
{
    let md = app.get(name)
    if (md)
    {
        throw new Error(`${name} is already defined`)
    }

    info = info || {}

    md = {
        name: name,
        data: {},
    }

    md.ctor = info.ctor || function () { }

    md.ctor(md.data)

    app.modules[name] = md
    app.sorted_mds.push(md)

    return md
}

app.get = function (name)
{
    return app.modules[name]
}

app.init = async function (config)
{
    if (typeof config == "object")
    {
        app.config = Object.assign(app.config, config)
    }
    else if (typeof config == "number")
    {
        app.config.cluster = config
    }
    //else 子 worker

    for (let md of app.sorted_mds)
    {
        if (md.init)
        {
            let ret = await md.init()
            if (ret === false)
            {
                console.log(`init -- ${md.name} failed`)
                return false
            }
        }
    }
    return true
}
