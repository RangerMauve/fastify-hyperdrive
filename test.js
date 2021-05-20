const fastify = require('fastify')
const SDK = require('hyper-sdk')
const fetch = require('cross-fetch')
const test = require('tape')

const fastifyHyperdrive = require('./')

test('Load data from drive through server', async (t) => {
  const { close, address, Hyperdrive } = await setup()
  try {
    const drive = Hyperdrive('example')

    await drive.writeFile('/example.txt', 'Example')

    const toFetch = new URL(`/${drive.key.toString('hex')}/example.txt`, address)

    const response = await fetch(toFetch.href)

    t.pass('Got response')
    t.equals(response.status, 200)
    t.equals(response.headers.get('etag'), '"2"', 'Got expected version')
    t.equals(response.headers.get('content-type'), 'text/plain; charset=utf-8', 'Got expected content type')
    t.equals(response.headers.get('content-length'), '7', 'Got expected content length')
    t.equals(response.headers.get('accept-ranges'), 'bytes', 'Got expected accept-ranges header')

    const text = await response.text()

    t.equal(text, 'Example', 'Got file contents')
  } finally {
    close()
  }
})

test('404 error for unknown files', async (t) => {
  const { close, address, Hyperdrive } = await setup()
  try {
    const drive = Hyperdrive('example')

    await drive.writeFile('/example.txt', 'Example')

    const toFetch = new URL(`/${drive.key.toString('hex')}/other.txt`, address)

    const response = await fetch(toFetch.href)

    t.pass('Got response')
    t.equals(response.status, 404, 'Got expected status')
    t.equals(response.headers.get('etag'), '"2"', 'Got expected version')
    t.equals(response.headers.get('content-type'), 'text/plain; charset=utf-8')

    const text = await response.text()

    t.ok(text.startsWith('Error: Not Found'), 'Got file contents')
  } finally {
    close()
  }
})

test('directory lookup', async (t) => {
  const { close, address, Hyperdrive } = await setup()
  try {
    const drive = Hyperdrive('example')

    await drive.writeFile('/example/b.txt', 'b')
    await drive.writeFile('/example/a.txt', 'a')

    const toFetch = new URL(`/${drive.key.toString('hex')}/example`, address)

    const response = await fetch(toFetch.href)

    t.pass('Got response')
    t.equals(response.status, 200, 'Got expected response code')
    t.equals(response.headers.get('etag'), '"3"')
    t.equals(response.headers.get('content-type'), 'text/html; charset=utf-8')

    const text = await response.text()

    t.equal(text, `
        <!DOCTYPE html>
        <title>hyper://${drive.key.toString('hex')}/example</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <h1>Index of example</h1>
        <ul>
          <li><a href="../">../</a></li>
          <li><a href="b.txt">./b.txt</a></li>
        
          <li><a href="a.txt">./a.txt</a></li>
        
        </ul>
      `, 'Got file contents')
  } finally {
    close()
  }
})

test('getHyperDrive doesnt return anything results in 404', async (t) => {
  const { close, address } = await setup({ denyAll: true })
  try {
    const toFetch = new URL('/d95ad1cdc074ffc406cabfb42f4ac45f1d57fa3a23d4112a6366ea6eb7a4d531/example.txt', address)

    const response = await fetch(toFetch.href)

    t.pass('Got response')
    t.equal(response.status, 404)

    const text = await response.text()
    t.equal(text, 'Unknown drive', 'Drive unknown')
  } finally {
    close()
  }
})

async function setup ({ denyAll } = {}) {
  const sdk = await SDK({ persist: false })
  const { Hyperdrive } = sdk

  async function getHyperdrive (key) {
    if (denyAll) {
      return null
    }
    return Hyperdrive(key)
  }

  const server = fastify({ logger: false })
  server.all('/:key/*path', fastifyHyperdrive(getHyperdrive))

  try {
    return {
      sdk,
      Hyperdrive: sdk.Hyperdrive,
      address: await new Promise((resolve, reject) => {
        server.listen(0, (err, address) => {
          if (err) reject(err)
          else resolve(address)
        })
      }),
      close () {
        sdk.close()
        server.close()
      }
    }
  } catch (err) {
    sdk.close()
    throw err
  }
}
