let awesome = require("../lib")

let players = {}

async function thread(name)
{
    console.log(`${name} start wait`)

    let [is_captured, player] = await awesome.capture("player")

    if (is_captured)
    {
        console.log(`${name} start load player`)

        player = { id: 1, name: "test" }

        players[player.id] = player

        awesome.share("player", player)

        console.log(`${name} stop load player`)
    }
    else
    {
        console.log(`${name} get the player success:${player.name}`)
    }
}

for (let i = 0; i < 5; ++i)
{
    setImmediate(() =>
    {
        thread(`thread_${i}`)
    })
}
