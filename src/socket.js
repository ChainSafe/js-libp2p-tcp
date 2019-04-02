'use strict'

const debug = require('debug')
const log = debug('libp2p:tcp:socket')

const c = require('./constants')

class Libp2pSocket {
  constructor (rawSocket, ma, opts) {
    this._rawSocket = rawSocket
    this._ma = ma

    this.sink = this._sink(opts)
    this.source = rawSocket
  }

  _sink (opts = {}) {
    // By default, close when the source is exhausted
    const closeOnEnd = opts.closeOnEnd !== false
    return (source) => this._write(source, closeOnEnd)
  }

  async _write (source, closeOnEnd) {
    for await (const data of source) {
      const flushed = this._rawSocket.write(data)
      if (!flushed) {
        await new Promise((resolve) => this._rawSocket.once('drain', resolve))
      }
    }

    if (closeOnEnd) {
      await this.close()
    }
  }

  close (opts = {}) {
    if (this._rawSocket.pending || this._rawSocket.destroyed) {
      return
    }

    return new Promise((resolve, reject) => {
      const start = Date.now()

      // Attempt to end the socket. If it takes longer to close than the
      // timeout, destroy it manually.
      const timeout = setTimeout(() => {
        const cOpts = this._ma.toOptions()
        log('Timeout closing socket to %s:%s after %dms, destroying it manually',
          cOpts.host, cOpts.port, Date.now() - start)
        this._rawSocket.destroy()
        resolve()
      }, opts.timeout || c.CLOSE_TIMEOUT)

      this._rawSocket.once('close', () => clearTimeout(timeout))

      this._rawSocket.end((err) => err ? reject(err) : resolve())
    })
  }

  getObservedAddrs () {
    return [this._ma]
  }
}

module.exports = Libp2pSocket
