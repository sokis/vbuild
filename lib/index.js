'use strict'
const path = require('path')
const pathExists = require('path-exists')
const co = require('co')
const chalk = require('chalk')
const merge = require('lodash.merge')
const tildify = require('tildify')
const updateConfig = require('./update-config')
const requireWithContext = require('./require-with-context')

module.exports = co.wrap(function * (options) {
  let configFilePath = path.resolve(options.config || 'vue.config.js')

  let fileConfig
  let devConfig
  let prodConfig
  if (options.config !== false) {
    if (!/\.js$/.test(configFilePath)) {
      configFilePath += '.js'
    }
    const tildyPath = tildify(configFilePath)
    if (yield pathExists(configFilePath)) {
      fileConfig = yield requireWithContext(configFilePath)
      console.log(`> Using config file at ${tildyPath}`)
    } else if (options.config) {
      console.log(chalk.red(`> Could not resolve config file at: ${tildyPath}`))
    }

    if (fileConfig) {
      devConfig = fileConfig.development
      prodConfig = fileConfig.production
      delete fileConfig.development
      delete fileConfig.production
    }
  }

  const isDev = options.dev

  process.env.NODE_ENV = isDev ? 'development' : 'production'

  let port = options.port || 4000

  if (options.dev) {
    port = yield require('./detect-free-port')(port)

    if (!port) return // eslint-disable-line curly
  }

  const buildOptions = merge(
    {
      port,
      notify: false,
      host: 'localhost',
      dist: 'dist',
      static: {
        from: 'static',
        to: './'
      }
    },
    fileConfig,
    isDev ? devConfig : prodConfig,
    options
  )

  let webpackConfig = isDev ?
    require('./webpack/config.dev') :
    require('./webpack/config.prod')

  // update webpack config by given options
  webpackConfig = yield updateConfig(webpackConfig, buildOptions)

  // merge user provided webpack config
  if (buildOptions.mergeConfig) {
    webpackConfig = require('./merge-config')(webpackConfig, buildOptions)
  }

  if (typeof buildOptions.webpack === 'function') {
    webpackConfig = buildOptions.webpack(webpackConfig, buildOptions)
  }

  if (buildOptions.test) {
    require('./test')(webpackConfig, buildOptions)
  } else if (buildOptions.dev) {
    require('./dev')(webpackConfig, buildOptions)
  } else {
    yield require('./build')(webpackConfig, buildOptions)
  }
})
