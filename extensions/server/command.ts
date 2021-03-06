/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { db } = require("../../src/util");
const cfg = require("../../src/config");
const { startWatcher } = require("../../src/commands/update");
const { appFactory, createServer } = require("mapboard-server");
const express = require("express");
const { join } = require("path");
const http = require("http");
const cors = require("cors");

const command = "serve";
const describe = "Create a feature server";

const { server: serverCfg = {}, data_schema, topo_schema, connection } = cfg;

const handler = function () {
  const { tiles = {}, port = 3006 } = serverCfg;
  const verbose = false;

  const app = appFactory({
    connection,
    tiles,
    schema: data_schema,
    topology: topo_schema,
    createFunctions: false,
  });
  app.use(cors());

  // This should be conditional
  const { liveTileServer } = require("../live-tiles/server");
  app.use("/live-tiles", liveTileServer(cfg));

  const server = createServer(app);
  startWatcher(verbose);

  return server.listen(port, () => console.log(`Listening on port ${port}`));
};

module.exports = { command, describe, handler };
