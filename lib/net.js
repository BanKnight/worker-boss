const net = require("net")
const os = require("os")
const path = require("path")
const buffer_op = require("buffer-op")
const box = buffer_op.box
const awesome = require("awesome-async")

const app = require("./head")
const config = app.config

const md_workers = app.get("workers")
const md_cluster = app.get("cluster")

const me = app.get("net")
const data = me.data

function noop() { }

/**
 * 用于监听其他进程对本进程的信息推送
 */
me.init = async function ()
{
    if (await me._listen() === false)            //监听外部连接上来的
    {
        return false
    }

    if (await me._connect_ceo() === false)       //登录到ceo
    {
        return false
    }
}

me._listen = async function ()
{
    let ear = net.createServer(noop)

    let file = me._gen_file(app.self())

    ear.on("listening", function ()
    {
        awesome.wake(file, true)
    })
    /**
     * 被动连接 本方不需要发送登录
     */
    ear.on('connection', function (conn)
    {
        conn.dispatch = me._before_login

        me._init_conn(conn)
    })

    ear.on("error", function (err)
    {
        console.error(`=================>listen error,${err}`)

        awesome.wake(file, false)
    })

    ear.on("close", function ()
    {
        console.error(`=================>listen close,${file}`)
    })

    ear.listen(file)

    //Todo
    return await awesome.wait(file)
}

me._connect_ceo = async function ()
{
    if (app.is_ceo() == true)
    {
        return
    }

    let worker = md_workers.new_worker_obj(config.cluster)

    await me._connect_worker(worker)

    data._ceo_worker = worker
}

me._connect_worker = async function (worker)
{
    //console.log(`start to connect ${worker.id}`)

    let file = me._gen_file(worker.id)
    let conn = net.connect(file)

    conn.file = file

    conn.on('connect', function ()
    {
        conn.dispatch = me._after_login

        conn.worker = worker
        worker.conn = conn
        worker.retry = 0

        // console.log(`~~~~~~~~~~~~~~~~connect ${worker.id} ok`);

        md_workers._login_remote(worker)
    })

    me._init_conn(conn, worker)

    //等待本端登陆成功
    await awesome.wait(`llogin[${worker.id}]`)
}

me._init_conn = function (conn, worker)
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
        if (worker)
        {
            ++worker.retry

            if (worker.retry > 3)
            {
                console.warn(`connect ${worker.id},err:${err},reconnecting`)
            }

            setTimeout(function ()
            {
                me._connect_worker(worker)
            }, worker.retry * 2000)
        }
    })

    conn.on("close", () =>
    {

        let worker = conn.worker
        if (worker == null)
        {
            return
        }
        //console.log("client close:" + worker.id)

        worker.conn = null
        worker.standby = []

        // data.workers.delete(worker.id)

    })

    //第一个参数必然是发送方的进程id
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

me._gen_file = function (file_name)
{
    if (os.platform == "win32")
    {
        return path.join('\\\\?\\pipe', process.cwd(), `${file_name}-worker.pipe`)
    }

    return path.join(process.cwd(), `${file_name}-worker.sock`)
}
me._before_login = async function (conn, buffer)
{
    let [cmd, ...args] = box.unpack(buffer)

    switch (cmd)
    {
        case "r":
            md_workers._on_resp(conn.worker, ...args)
            break
        case "ic":
            let [session, md_name, func_name, ...other_args] = [...args]

            let md = app.get(md_name)

            // console.log(`recv call:${func_name}`)

            let ret = await md[func_name](conn, ...other_args)

            //隐含了要求:必须第一个包就是登陆
            me._ret_worker(conn.worker, session, ret)

            break
        default:
            console.error("----before login only accept cmd ic/r,but get:" + cmd)
            break
    }
}

me._after_login = async function (conn, buffer)
{
    let [cmd, ...args] = box.unpack(buffer)

    switch (cmd)
    {
        case "i":   //请求
            md_workers._on_invoke(conn.worker, ...args)
            break
        case "c":   //调用
            md_workers._on_call(conn.worker, ...args)
            break
        case "r":   //返回
            md_workers._on_resp(conn.worker, ...args)
            break
        case "ii":
            md_workers._on_inside_invoke(conn.worker, ...args)
            break
        case "ic":
            md_workers._on_inside_call(conn.worker, ...args)
            break
    }
}

me.send_ceo = function (...args)
{
    me._send_worker(data._ceo_worker, ...args)
}

me.call_ceo = function (...args)
{
    return me._call_worker(data._ceo_worker, ...args)
}
//带长度的序列化
me._pack_for_worker = function (worker, ...args)
{
    worker.out_writer.append_int32(0)           //占据位置

    let old_offset = worker.out_writer.offset

    box.pack_any(worker.out_writer, args)

    worker.out_writer.replace_int32(worker.out_writer.offset - old_offset)

    let buffer = worker.out_stream.to_buffer()

    worker.out_stream.clear()

    return buffer
}

/**
 * 发送消息到对端
 * @param {*} worker 
 * @param {*} args 
 */
me.send_worker = function (worker, ...args)
{
    if (typeof (worker) == "number")
    {
        let cluster = worker

        if (cluster > 1 << 13)
        {
            cluster = worker >> 13
        }

        //发往不同集群的,Todo 应该判断
        if (config.cluster != cluster)  
        {
            if (app.is_ceo() == true)
            {
                md_cluster._send(cluster, worker, ...args)
            }
            else
            {
                me.send_ceo("cluster", "_send", cluster, worker, ...args)
            }
            return
        }

        worker = md_workers.get(worker)
    }

    if (worker == null)
    {
        return
    }

    let buffer = me._pack_for_worker(worker, "i", ...args)

    // console.log(`trying to send_worker buffer:${buffer.length},${buffer.byteLength}`)

    if (worker.standby)
    {
        worker.standby.push(buffer)
        return
    }

    worker.conn.write(buffer)
}
/**
 * 发送内部命令
 * @param {*} worker 
 * @param {*} md
 * @param {*} func 
 * @param {*} args 
 */
me._send_worker = async function (worker, md, func, ...args)
{
    if (typeof (worker) == "number")
    {
        worker = md_workers.get(worker)
    }

    let buffer = me._pack_for_worker(worker, "ii", md, func, ...args)

    // console.log(`trying to _send_worker buffer:${buffer.length},${buffer.byteLength}`)

    if (worker.standby)
    {
        worker.standby.push(buffer)
        return
    }

    worker.conn.write(buffer)
}

/**
 * 远程调用对端
 * @param {*} worker 
 * @param {*} func 
 * @param {*} args 
 */
me.call_worker = async function (worker, ...args)
{
    if (typeof (worker) == "number")
    {
        let cluster = worker

        if (cluster > 1 << 13)
        {
            cluster = worker >> 13
        }

        //发往不同集群的,Todo 应该判断
        if (config.cluster != cluster)  
        {
            if (app.is_ceo() == true)
            {
                return md_cluster._call(cluster, worker, ...args)
            }
            else
            {
                return me.call_ceo("cluster", "_call", cluster, worker, ...args)
            }
        }

        worker = md_workers.get(worker)
    }

    let session = ++data.session

    let buffer = me._pack_for_worker(worker, "c", session, ...args)

    // console.log(`trying to call_worker buffer:${buffer.length},${buffer.byteLength}`)

    if (worker.standby)
    {
        worker.standby.push(buffer)
    }
    else
    {
        worker.conn.write(buffer)
    }

    let ret = await awesome.wait(`__c${session}`)

    return ret
}

/**
 * 发送内部命令
 * @param {*} worker 
 * @param {*} md 
 * @param {*} func 
 * @param {*} args 
 */
me._call_worker = async function (worker, md, func, ...args)
{
    if (typeof (worker) == "number")
    {
        worker = md_workers.get(worker)
    }

    let session = ++data.session

    let buffer = me._pack_for_worker(worker, "ic", session, md, func, ...args)

    // console.log(`trying to _call_worker buffer:${buffer.length},${buffer.byteLength}`)

    if (worker.standby)
    {
        worker.standby.push(buffer)
    }
    else
    {
        worker.conn.write(buffer)
    }

    let ret = await awesome.wait(`__c${session}`)

    return ret
}

me._ret_worker = function (worker, session, ret)
{
    if (typeof (worker) == "number")
    {
        worker = md_workers.get(worker)
    }

    let buffer = me._pack_for_worker(worker, "r", session, ret)

    // console.log(`trying to _ret_worker buffer:${buffer.length},${buffer.byteLength}`)

    if (worker.standby)
    {
        worker.standby.push(buffer)
    }
    else
    {
        worker.conn.write(buffer)
    }
}

me.broad = function (...args)
{
    let workers = md_workers.get_all()
    let self = app.self()

    for (let [id, worker] of workers)
    {
        if (id == self)
        {
            continue
        }
        me.send_worker(worker, func, ...args)
    }
}
