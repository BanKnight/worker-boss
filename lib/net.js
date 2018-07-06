const net = require("net")
const os = require("os")
const path = require("path")
const box = require("buffer-op").box
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
        })

        conn.dispatch = boss._before_login

        //第一个参数必然是发送方的进程id
        conn.on("data", (data) =>          
        {
            let buffer = Buffer.from(data)

            conn.dispatch(conn, buffer)
        })
    })

    ear.listen(boss._gen_file(boss.id))
}

boss._connect_ceo = async function ()
{
    if (boss.ceo == true)
    {
        return
    }

    let worker = { id: boss.cluster, standby: [] }

    data.workers.set(boss.cluster, worker)

    await boss._connect_worker(worker)

    data._ceo_worker = worker
}

boss._connect_worker = async function (worker)
{
    console.log(`start to connect ${worker.id}`)

    let conn = net.connect(boss._gen_file(worker.id))

    conn.on("close", () =>
    {
        let worker = conn.worker

        if (worker == null)
        {
            return
        }

        worker.conn = null
        worker.standby = []

        //Todo confirm this
        data.workers.delete[worker.id]
    })

    conn.on('connect', function ()
    {
        conn.worker = worker
        worker.conn = conn

        console.log(`connect ${worker.id} ok`);

        boss._login_remote(worker)
    })

    conn.dispatch = boss._after_login

    conn.on("data", (data) =>          
    {
        let buffer = Buffer.from(data)

        conn.dispatch(conn, buffer)
    })

    //等待本端登陆成功
    await awesome.wait(`llogin[${worker.id}]`)
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

            console.log(`recv call:${func_name}`)

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

    let buffer = box.pack("i", ...args).detach()

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

    let buffer = box.pack("ii", func, ...args).detach()

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

    let buffer = box.pack("c", session, func, ...args).detach()

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
    let buffer = box.pack("ic", session, func, ...args).detach()

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

    let buffer = box.pack("r", session, ret).detach()

    if (worker.standby)
    {
        worker.standby.push(buffer)
    }
    else
    {
        worker.conn.write(buffer)
    }
}
