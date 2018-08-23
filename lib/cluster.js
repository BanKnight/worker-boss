const net = require("net")
const buffer_op = require("buffer-op")
const awesome = require("awesome-async")

const box = buffer_op.box

const app = require("./head")

const config = app.config

const md_workers = app.get("workers")
const md_net = app.get("net")
const md_dispatcher = app.get("dispatcher")

const me = app.get("cluster")
const data = me.data

/**
 * config.clusters = {
 *  [1] : address,
 *  [2] : address,
 *  [3] : address,
 * }
 */
me.init = async function ()
{
    if (app.is_ceo() == false)
    {
        return
    }

    if (config.clusters == null)
    {
        return
    }

    await me._listen()

    await me._connect_others()
}

me._listen = async function ()
{
    let this_config = config.clusters[app.self()]

    let address = this_config.split(":")
    let master = net.createServer()

    master.on("listening", function ()
    {
        awesome.wake(this_config)
    })

    master.on('connection', function (conn)
    {
        conn.dispatch = me._before_login

        me._init_cluster(conn)
    })

    master.on("error", function (err)
    {
        console.error(`=================>listen error,${err}`)
    })

    master.on("close", function ()
    {
        console.error(`=================>listen close,${file}`)
    })

    master.listen(address[1])

    await awesome.wait(this_config)
}

/**
 * 连接id比自己小的
 */
me._connect_others = async function ()
{
    for (let id in config.clusters)
    {
        id = parseInt(id)

        if (app.self() <= id)
        {
            continue
        }

        let cluster = me._new_cluster(id)

        cluster.address = config.clusters[id]

        me._connect_cluster(cluster)
    }
}

me._new_cluster = function (id)
{
    let cluster = {
        id: id,
        standby: [],
        retry: 0,
    }

    cluster.out_stream = new buffer_op.Stream()
    cluster.out_writer = new buffer_op.Writer(cluster.out_stream)

    data.clusters.set(id, cluster)

    return cluster
}

me._connect_cluster = function (cluster)
{
    let address = cluster.address.split(":")
    let conn = net.connect(address[1], address[0])

    conn.on('connect', function ()
    {
        conn.dispatch = me._after_login

        conn.cluster = cluster

        cluster.conn = conn
        cluster.retry = 0

        me._login_remote(cluster)
    })

    me._init_cluster(conn, cluster, true)
}

me._init_cluster = function (conn, cluster)
{
    let decoder = {
        wait: 0,
        in_buffers: [],
        in_buffer_bytes: 0,
        in_stream: new buffer_op.Stream(),
    }

    let fetch = function (count)
    {
        if (decoder.in_buffer_bytes < count)
        {
            return
        }
        let copied_count = 0
        let buffer = Buffer.allocUnsafe(count)

        while (copied_count < count)
        {
            let first = decoder.in_buffers[0]
            let this_count = first[1].byteLength - first[0]
            let this_copy_count = (this_count + copied_count) <= count ? this_count : count - copied_count

            first[1].copy(buffer, copied_count, first[0], first[0] + this_copy_count)

            copied_count += this_copy_count

            if (this_count == this_copy_count)      //删除掉第一个
            {
                decoder.in_buffers.shift()
            }
            else
            {
                first[0] += this_copy_count
            }
        }
        decoder.in_buffer_bytes -= count

        return buffer
    }

    conn.decoder = decoder

    conn.on("error", function (err)
    {
        if (cluster == null)
        {
            return
        }
        // 表示是connect

        console.error(`cluster[${cluster.id}],err:${err}`)

        ++cluster.retry

        cluster.retry = Math.max(cluster.retry, 5)

        setTimeout(function ()
        {
            me._connect_cluster(cluster)
        }, cluster.retry * 2000)

    })

    conn.on("close", () =>
    {
        let this_cluster = conn.cluster
        if (this_cluster == null)
        {
            return
        }

        conn.cluster = null

        this_cluster.conn = null
        this_cluster.standby = []

        console.error(`cluster[${this_cluster.id}],closed`)
    })

    conn.on("data", (data) =>          
    {
        // console.log(`recv buffer:${data.byteLength}`)

        decoder.in_buffers.push([0, Buffer.from(data)])
        decoder.in_buffer_bytes += data.byteLength

        while (true)
        {
            if (decoder.wait == 0)
            {
                let buffer = fetch(4)
                if (buffer == null)
                {
                    break
                }
                decoder.wait = buffer.readInt32LE()            //读出长度

                // console.log("read head:" + decoder.wait)
            }
            else
            {
                let buffer = fetch(decoder.wait)
                if (buffer == null)
                {
                    break
                }
                decoder.wait = 0
                conn.dispatch(conn, buffer)
            }
        }
    })
}

me._login_remote = async function (cluster)
{
    let standby = cluster.standby

    cluster.standby = null

    let buffer = me._pack(cluster, config.cluster, cluster.address)

    cluster.conn.write(buffer)

    for (let buffer of standby)
    {
        cluster.conn.write(buffer)
    }

    console.info(`connect cluster[${cluster.id}] ok`)
}

me._send = function (cluster, target, ...args)
{
    if (typeof cluster == "number")
    {
        cluster = data.clusters.get(cluster)
    }

    let buffer = me._pack(cluster, "s", target, ...args)

    if (cluster.standby)
    {
        cluster.standby.push(buffer)
        return
    }

    cluster.conn.write(buffer)
}

me._call = async function (cluster, target, ...args)
{
    if (typeof cluster == "number")
    {
        cluster = data.clusters.get(cluster)
    }

    let session = ++data.session

    let buffer = me._pack(cluster, "c", target, session, ...args)

    if (cluster.standby)
    {
        cluster.standby.push(buffer)
    }
    else
    {
        cluster.conn.write(buffer)
    }

    let ret = await awesome.wait(`__cl${session}`)

    return ret
}

me._ret = function (cluster, session, ret)
{
    if (typeof (cluster) == "number")
    {
        cluster = data.clusters.get(cluster)
    }

    let buffer = me._pack(cluster, "r", session, ret)

    // console.log(`trying to _ret_worker buffer:${buffer.length},${buffer.byteLength}`)

    if (cluster.standby)
    {
        cluster.standby.push(buffer)
    }
    else
    {
        cluster.conn.write(buffer)
    }
}
//带长度的序列化
me._pack = function (cluster, ...args)
{
    cluster.out_writer.append_int32(0)           //占据位置

    let old_offset = cluster.out_writer.offset

    box.pack_any(cluster.out_writer, args)

    cluster.out_writer.replace_int32(cluster.out_writer.offset - old_offset)

    let buffer = cluster.out_stream.to_buffer()

    cluster.out_stream.clear()

    return buffer
}

/**
 * 对端发过来的第一个包
 * @param {*} conn 
 * @param {*} buffer 
 */
me._before_login = function (conn, buffer)
{
    let [id, address] = box.unpack(buffer)

    let cluster = me._new_cluster(id)

    cluster.address = address

    conn.cluster = cluster
    cluster.conn = conn

    for (let buffer of cluster.standby)
    {
        conn.write(buffer)
    }

    cluster.standby = null

    //console.log(`recv login from: ${id}`)

    conn.dispatch = me._after_login

    console.log(`recv cluster[${id}] login:${cluster.address}`)

}

me._after_login = async function (conn, buffer)
{
    let [cmd, target, ...args] = box.unpack(buffer)

    switch (cmd)
    {
        case "s":
            if (target == app.self())
            {
                md_dispatcher.dispatch(...args)
            }
            else
            {
                md_net.send_worker(target, ...args)
            }
            break
        case "c":
            {
                let [session, ...left_args] = args
                let ret
                if (target == app.self())
                {
                    ret = await md_dispatcher.dispatch(...left_args)
                }
                else
                {
                    ret = await md_net.call_worker(target, ...left_args)
                }

                me._ret(conn.cluster, session, ret)
            }
            break
        case "r":
            {
                let [ret] = args
                awesome.wake(`__cl${target}`, ret)
            }
            break
        default:
            break
    }
}



