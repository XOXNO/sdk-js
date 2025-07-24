import { endpoints } from './src/sdk/swagger'
import { coveredMethods } from './src/sdk/utils'
import { XOXNOClient } from './src/utils/api'

async function _fn() {
  XOXNOClient.init()

  const entries = Object.entries(endpoints)

  console.log(
    entries
      .filter(([key, value]) => {
        const splitted = key.split('/')
        const cond1 = !splitted.at(-1)?.startsWith(':')
        const cond2 = coveredMethods.some((method) => method in value)
        return (
          splitted.filter((item) => item.startsWith(':')).length > 1 && cond2
        )
      })
      .map(([key]) => key)
  )
}

_fn()
