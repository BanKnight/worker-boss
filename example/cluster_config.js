const config = module.exports = {}

const clusters = {
    [1]: "127.0.0.1:8221",
    [2]: "127.0.0.1:8222",
}

config.server = {
    cluster: 1,
    clusters: clusters,
}

config.client = {
    cluster: 2,
    clusters: clusters,
}
