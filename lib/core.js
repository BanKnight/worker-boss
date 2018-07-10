const boss = require("./head")
const data = boss.data

/**
 * 总的初始化入口
 * @param {集群的id} cluster 
 */
boss.init = async function (cluster)
{
    data.mode = process.env.boss_mode || "process" //如果没有设置 那就是多进程的写法

    await boss._init_basic(cluster)
    await boss._init_net()                         //用于监听别的进程发给自己的信息
    await boss._init_workers()
}

/**
 * 
 */
boss._init_basic = function (cluster)
{
    if (cluster)
    {
        boss.ceo = true
        boss.cluster = cluster
        boss.id_helper = 1
        boss.id = cluster
    }
    else
    {
        boss.ceo = false
        boss.id = parseInt(process.env.worker_id)
        boss.cluster = boss.id >> 13
    }

    {   //修改输出
        data.old_log = console.log
        data.old_err = console.error

        console.log = function (content)
        {
            data.old_log(`[${boss.id}] ${content}`)
        }

        console.error = function (content)
        {
            data.old_err(`[${boss.id}] ${content}`)
        }
    }
}
