const net = require("net")
const os = require("os")
const util = require("util")
const path = require("path")
const buffer_op = require("buffer-op")
const box = buffer_op.box
const awesome = require("awesome-async")

const boss = require("./head")
const data = boss.data

function noop() { }

/**
 * 用于监听其他进程对本进程的信息推送
 */
boss._init_net = async function ()
{
    await boss._listen()            //监听外部连接上来的

    await boss._connect_ceo()       //登录到ceo
}

boss._listen = async function ()
{
    let ear = net.createServer(noop)

    /**
     * 被动连接 本方不需要发送登录
     */
    ear.on('connection', function (conn)
    {
        conn.dispatch = boss._before_login

        boss._init_conn(conn)
    })

    ear.listen(boss._gen_file(boss.id))
}

boss._connect_ceo = async function ()
{
    if (boss.ceo == true)
    {
        return
    }

    let worker = boss._new_woker_obj(boss.cluster)

    data.workers.set(boss.cluster, worker)

    await boss._connect_worker(worker)

    data._ceo_worker = worker
}

boss._connect_worker = async function (worker)
{
    console.log(`start to connect ${worker.id}`)

    let conn = net.connect(boss._gen_file(worker.id))

    conn.on('connect', function ()
    {
        boss._init_conn(conn)

        conn.dispatch = boss._after_login

        conn.worker = worker
        worker.conn = conn

        console.log(`connect ${worker.id} ok`);

        boss._login_remote(worker)
    })

    //等待本端登陆成功
    await awesome.wait(`llogin[${worker.id}]`)
}

boss._init_conn = function (conn)
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

    conn.on("close", () =>
    {
        let worker = conn.worker
        if (worker == null)
        {
            console.log("client close")
            return
        }
        console.log("client close:" + worker.id)

        worker.conn = null
        worker.standby = []

        data.workers.delete(worker.id)

        process.exit(1)
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

boss._gen_file = function (file_name)
{
    if (os.platform == "win32")
    {
        return path.join('\\\\?\\pipe', process.cwd(), `${file_name}.pipe`)
    }
    return path.join(process.cwd(), `${file_name}.sock`)
}
boss._before_login = async function (conn, buffer)
{
    let [cmd, ...args] = box.unpack(buffer)

    switch (cmd)
    {
        case "r":
            boss._on_resp(conn.worker, ...args)
            break
        case "ic":
            let [session, func_name, ...other_args] = [...args]

            // console.log(`recv call:${func_name}`)

            let ret = await boss[func_name](conn, ...other_args)

            //隐含了要求:必须第一个包就是登陆
            boss._ret_worker(conn.worker, session, ret)

            break
        default:
            console.error("----before login only accept cmd ic/r,but get:" + cmd)
            break
    }
}

boss._after_login = async function (conn, buffer)
{
    let [cmd, ...args] = box.unpack(buffer)

    switch (cmd)
    {
        case "i":   //请求
            boss._on_invoke(conn.worker, ...args)
            break
        case "c":   //调用
            boss._on_call(conn.worker, ...args)
            break
        case "r":   //返回
            boss._on_resp(conn.worker, ...args)
            break
        case "ii":
            boss._on_inside_invoke(conn.worker, ...args)
            break
        case "ic":
            boss._on_inside_call(conn.worker, ...args)
            break
    }
}

boss.send_ceo = async function (func, ...args)
{
    boss._send_worker(data._ceo_worker, func, ...args)
}

boss.call_ceo = async function (func, ...args)
{
    let ret = await boss._call_worker(data._ceo_worker, func, ...args)

    return ret
}
//带长度的序列化
boss._pack_for_worker = function (worker, ...args)
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
boss.send_worker = async function (worker, ...args)
{
    if (typeof (worker) == "number")
    {
        worker = data.workers.get(worker)
    }

    if (worker == null)
    {
        return
    }

    let buffer = boss._pack_for_worker(worker, "i", ...args)

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
 * @param {*} func 
 * @param {*} args 
 */
boss._send_worker = async function (worker, func, ...args)
{
    if (typeof (worker) == "number")
    {
        worker = data.workers.get(worker)
    }

    let buffer = boss._pack_for_worker(worker, "ii", func, ...args)

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
boss.call_worker = async function (worker, func, ...args)
{
    if (typeof (worker) == "number")
    {
        worker = data.workers.get(worker)
    }

    let session = ++data.session

    let buffer = boss._pack_for_worker(worker, "c", session, func, ...args)

    // console.log(`trying to call_worker buffer:${buffer.length},${buffer.byteLength}`)

    if (worker.standby)
    {
        worker.standby.push(buffer)
    }
    else
    {
        worker.conn.write(buffer)
    }

    let ret = await awesome.wait(session)

    return ret
}

/**
 * 发送内部命令
 * @param {*} worker 
 * @param {*} func 
 * @param {*} args 
 */
boss._call_worker = async function (worker, func, ...args)
{
    if (typeof (worker) == "number")
    {
        worker = data.workers.get(worker)
    }

    let session = ++data.session

    let buffer = boss._pack_for_worker(worker, "ic", session, func, ...args)

    // console.log(`trying to _call_worker buffer:${buffer.length},${buffer.byteLength}`)

    if (worker.standby)
    {
        worker.standby.push(buffer)
    }
    else
    {
        worker.conn.write(buffer)
    }

    let ret = await awesome.wait(session)

    return ret
}

boss._ret_worker = function (worker, session, ret)
{
    if (typeof (worker) == "number")
    {
        worker = data.workers.get(worker)
    }

    let buffer = boss._pack_for_worker(worker, "r", session, ret)

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
