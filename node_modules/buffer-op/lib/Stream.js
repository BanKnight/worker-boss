class Stream
{
    constructor(size)
    {
        let tp = typeof (size)

        if (tp == "number" || tp == "undefined")
        {
            size = size || 1024
            this._offset = 0
            this._buffer = Buffer.allocUnsafe(size)
        }
        else if (size instanceof Buffer)
        {
            this._offset = size.length
            this._buffer = size
        }
    }

    append(buffer, start, len)
    {
        this.prepare(len)

        buffer.copy(this._buffer, this._offset, start, start + len)

        this._offset += len
    }

    prepare(left)
    {
        let remaining = this._buffer.length - this._offset;
        if (remaining >= left) 
        {
            return
        }

        let old_buffer = this._buffer

        var new_size = old_buffer.length + (old_buffer.length >> 1) + left
        this._buffer = Buffer.allocUnsafe(new_size)

        old_buffer.copy(this._buffer)
    }

    commit(size)
    {
        this._offset += size
    }

    get length()
    {
        return this._offset
    }

    get buffer()
    {
        return this._buffer
    }

    detach()
    {
        let ret = Buffer.allocUnsafe(this._offset)

        this._buffer.copy(ret, 0, 0, this._offset)

        this._offset = 0
        this._buffer = Buffer.allocUnsafe(0)

        return ret
    }

    clear()
    {
        this._offset = 0
    }

}

module.exports = Stream