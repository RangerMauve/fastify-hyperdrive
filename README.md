# fastify-hyperdrive
Serve files from Hyperdrive as a fastify route

## Usage

```
npm i --save fastify-hyperdrive

# or

yarn add fastify-hyperdrive
```

```js
const fastifyHyperdrive = require('fastify-hyperdrive')

// Make a function that maps keys to hyperdrive instances
// Make sure you have networking set up for them
// Either use `drive.promises` from the stock Hyperdrive repo
// Or use the Hyperdrive constructor from dat-sdk
// Check out `test.js` for more info
async function getHyperdrive(key) {
  // If you use the stock version of hyperdrive
  return hyperdrive(key).promises
  // Or if you use dat-sdk or hyperdrive-promise
  return hyperdrive(key)
}

fastify.get('/:key/*`, fastifyHyperdrive(getHyperdrive))
// This might be needed for Range requests?
fastify.head('/:key/*', fastifyHyperdrive(getHyperdrive))
```

## API

### `fastifyHyperdrive(async getHyperdrive(key)) => (request, reply) => Promise`

Create a route handler for fastify which will resolve paths within hyperdrives.
The return value is the callback expected in [`fastify.get()`](https://www.fastify.io/docs/latest/Routes/#shorthand-declaration)
