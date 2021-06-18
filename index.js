const makeFetch = require('hypercore-fetch')
const { Readable } = require('stream')

module.exports = createServeHyperdrive

function createServeHyperdrive (Hyperdrive, {
  writable = false,
  ...opts
} = {}) {
  const fetch = makeFetch({ Hyperdrive, writable, ...opts })

  return async function serveHyperdrive (request, reply) {
    const { headers, params, method, url: requestPath, body } = request
    const { key, '*': path } = params

    // Lazy way to get the querystring from the URL. :P
    const { search: queryString } = new URL('http://example' + requestPath)

    const url = `hyper://${key}/${path}${queryString}`

    const response = await fetch(url, {
      method,
      headers,
      body
    })

    for (const [header, value] of response.headers) {
      reply.header(header, value)
    }

    reply.status(response.status)
    reply.send(Readable.from(response.body))
  }
}
