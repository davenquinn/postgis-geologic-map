PGPromise = require 'pg-promise'
{join, resolve} = require 'path'
colors = require 'colors'
Promise = require 'bluebird'

{database, srid, topo_schema,
 data_schema, host, port, connection, tolerance} = require '../config.json'

logFunc = (e)->
  console.log colors.grey(e.query)
  if e.params?
    console.log "    "+colors.cyan(e.params)
logFunc = null

pgp = PGPromise(promiseLib: Promise, query: logFunc)

{QueryFile} = pgp
{readFileSync} = require 'fs'

host ?= 'localhost'
port ?= 5432
connection ?= { host, port, database, user, password}
tolerance ?= 1

db = pgp(connection)

__base = resolve __dirname, '..'

qfileIndex = {}

sql = (fn)->
  params = {topo_schema, data_schema, srid, tolerance}
  if not fn.endsWith('.sql')
    fn += '.sql'
  p = join __base, fn
  unless qfileIndex[p]?
    qfileIndex[p] = QueryFile p, {params}
  return qfileIndex[p]

proc = (fn)->
  procedure = sql(fn)
  try
    res = await db.multi procedure
  catch err
    console.error err.toString().red
    console.error "   in: ".grey+fn

module.exports = {db,sql,proc}
