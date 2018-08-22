const app = require("./head")

app.define("basic", {
    ctor: (data) =>
    {
        data.id = 0
        data.cluster = 0
        data.is_ceo = false
    }
})
app.define("workers", {
    ctor: (data) =>
    {
        data.workers = new Map()
        data.id_helper = 0
        data.standby = []
    }
})

app.define("cluster", {
    ctor: (data) =>
    {
        data.clusters = new Map()
    }
})

app.define("net", {
    ctor: (data) =>
    {
        data.session = 0
    }
})
