const app = require("./head")
const config = app.config
const me = app.get("basic")
const data = me.data

/**
 * 总的初始化入口
 * @param {集群的id} cluster 
 */
me.init = async function ()
{
    config.mode = config.mode || (process.env.boss_mode || "vm")

    process.env.boss_mode = config.mode

    me.init_env()
}

/**
 * 
 */
me.init_env = function ()
{
    if (config.cluster)     //集群
    {
        data.ceo = true
        data.id = config.cluster
        data.cluster = config.cluster
    }
    else
    {
        data.ceo = false
        data.id = parseInt(process.env.worker_id)
        data.cluster = data.id >> 13

        config.cluster = data.cluster
    }

    {   //修改输出

        if (global.old_console == null)
        {
            global.old_console = Object.assign({}, console)
        }
        let methods = ["log", "info", "debug", "warn", "error"]
        for (let method of methods)
        {
            console[method] = function (...args)
            {
                old_console[method](`${new Date().toLocaleString().replace('T', ' ').substr(0, 19)} [${data.id}]`, ...args)
            }
        }
    }
}

me.self = function ()
{
    return data.id
}

me.is_ceo = function ()
{
    return data.ceo
}



