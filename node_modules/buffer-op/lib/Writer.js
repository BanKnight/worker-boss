let Stream = require("./Stream")

class Writer
{
    constructor(stream)
    {
        this._stream = stream
    }

    append_int64(num)
    {
        this._stream.prepare(8)

        let offset = this._stream.length
        let buffer = this._stream.buffer

        buffer.writeInt64LE(num, offset)

        this._stream.commit(8)
    }

    append_int32(num)
    {
        this._stream.prepare(4)

        let offset = this._stream.length
        let buffer = this._stream.buffer

        buffer.writeInt32LE(num, offset)

        this._stream.commit(4)
    }
    append_uint32(num)
    {
        this._stream.prepare(4)

        let offset = this._stream.length
        let buffer = this._stream.buffer

        buffer.writeUInt32LE(num, offset)

        this._stream.commit(4)
    }
    append_int16(num)
    {
        this._stream.prepare(2)

        let offset = this._stream.length
        let buffer = this._stream.buffer

        buffer.writeInt16LE(num, offset)

        this._stream.commit(2)
    }
    append_uint16(num)
    {
        this._stream.prepare(2)

        let offset = this._stream.length
        let buffer = this._stream.buffer

        buffer.writeUInt16LE(num, offset)

        this._stream.commit(2)
    }
    append_int8(num)
    {
        this._stream.prepare(1)

        let offset = this._stream.length
        let buffer = this._stream.buffer

        buffer.writeInt8(num, offset)

        this._stream.commit(1)
    }
    append_uint8(num)
    {
        this._stream.prepare(1)

        let offset = this._stream.length
        let buffer = this._stream.buffer

        buffer.writeUInt8(num, offset)

        this._stream.commit(1)
    }
    append_double(num)
    {
        this._stream.prepare(8)

        let offset = this._stream.length
        let buffer = this._stream.buffer

        buffer.writeDoubleLE(num, offset)

        this._stream.commit(8)
    }
    append_string(str)
    {
        let len = Buffer.byteLength(str)

        this._stream.prepare(2 + len)

        this.append_uint16(len)

        let offset = this._stream.length
        let buffer = this._stream.buffer

        buffer.write(str, offset, len, "utf8")

        this._stream.commit(len)
    }
    append_bytes(buffer, start, len)
    {
        start = start || 0
        len = len || buffer.length

        this._stream.prepare(2 + len)
        this.append_uint16(len)

        if (buffer instanceof Stream)
        {
            buffer = buffer.buffer
        }
        this._stream.append(buffer, start, len)
    }

    replace_uint16(num, offset)
    {
        let buffer = this._stream.buffer

        buffer.writeUInt16LE(num, offset)
    }

    replace_int32(num, offset)
    {
        let buffer = this._stream.buffer

        buffer.writeInt32LE(num, offset)
    }

    get offset()
    {
        return this._stream.length
    }
}

module.exports = Writer