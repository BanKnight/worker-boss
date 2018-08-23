const app = require("./head")

const md_basic = app.get("basic")
const md_net = app.get("net")
const md_workers = app.get("workers")
const md_dispatcher = app.get("dispatcher")

app.self = md_basic.self
app.is_ceo = md_basic.is_ceo

app.call_worker = md_net.call_worker
app.send_worker = md_net.send_worker

app.on_dispatch = md_dispatcher.on_dispatch

app.new_worker = md_workers.new_worker
app.die = md_workers.die
