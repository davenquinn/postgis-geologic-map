const PGPromise = require("pg-promise");
const { join, resolve, isAbsolute, dirname } = require("path");
const colors = require("colors");
const Promise = require("bluebird");
const { TSParser } = require("tsparser");
let { readFileSync } = require("fs");
const stripComments = require("sql-strip-comments");

const {
  srid,
  topo_schema,
  data_schema,
  connection,
  tolerance,
} = require("./config");

global.log = console.log;

const logFunc = function (e) {
  if (!global.verbose) {
    return;
  }
  //console.log global.verbose
  //return unless global.verbose
  global.log(colors.grey(e.query));
  if (e.params != null) {
    return global.log("    " + colors.cyan(e.params));
  }
};

const logNoticesFunction = function (client, dc, isFresh) {
  if (!isFresh) {
    return;
  }
  if (!global.verbose) {
    return;
  }
  return client.on("notice", function (msg) {
    msg = String(msg).slice(8);
    return global.log("NOTICE ".blue + msg);
  });
};

const pgp = PGPromise({
  promiseLib: Promise,
  query: logFunc,
  connect: logNoticesFunction,
});

const { QueryFile } = pgp;
({ readFileSync } = require("fs"));

const db = pgp(connection);

const __base = resolve(__dirname, "..");

const queryIndex = {};

const sql = function (fn) {
  // Function to get sql queries from a file
  let p;
  if (isAbsolute(fn)) {
    p = fn;
  } else {
    if (!fn.endsWith(".sql")) {
      fn += ".sql";
    }
    p = join(__base, fn);
  }

  const d = dirname(require.resolve(p));
  const params = { topo_schema, data_schema, srid, tolerance, dirname: d };

  if (queryIndex[p] == null) {
    // Using queryFile because it is best-documented
    // way to pre-format SQL. We could probably use
    // its internal interface
    let _ = readFileSync(p, "utf8");
    _ = pgp.as.format(_, params, { partial: true });
    queryIndex[p] = _;
  }

  return queryIndex[p];
};

const queryInfo = function (queryText) {
  let s = queryText.replace(/\/\*[\s\S]*?\*\/|--.*?$/gm, "");
  const arr = /^[\s\n]*([A-Za-z\s]+[a-zA-Z_."]*)/g.exec(s);
  if (arr != null && arr[1] != null) {
    s = arr[1];
  }
  return s.replace(/"/g, "");
};

const logQueryInfo = function (sql, indent) {
  if (indent == null) {
    indent = "";
  }
  const qi = queryInfo(sql);
  return console.log(indent + qi.gray);
};

const runQuery = async function (q, opts = {}) {
  if (opts.indent == null) {
    opts.indent = "";
  }
  try {
    logQueryInfo(q, opts.indent);
    return await db.query(q);
  } catch (err) {
    const ste = err.toString();
    if (ste.endsWith("already exists")) {
      return console.error(opts.indent + ste.dim.red);
    } else {
      return console.error(opts.indent + ste.red);
    }
  }
};

const proc = function (fn, opts) {
  //# Execute a (likely multi-transaction) stored procedure
  // Trim leading path for display if asked for
  let fnd;
  if (opts == null) {
    opts = {};
  }
  let { indent, trimPath } = opts;
  if (indent == null) {
    indent = "";
  }

  if (trimPath != null) {
    fnd = fn.replace(opts.trimPath, "");
    if (fnd.indexOf("/") === 0) {
      fnd = fnd.substr(1);
    }
  }
  if (fnd == null) {
    fnd = fn;
  }

  try {
    const _ = stripComments(sql(fn));
    const procedures = TSParser.parse(_, "pg", ";");
    console.log(indent + fnd.green);
    return db.tx(async function (ctx) {
      for (let q of Array.from(procedures)) {
        await runQuery(q, { indent });
      }
      return console.log("");
    });
  } catch (err) {
    return console.error(indent + `${err.stack}`.red);
  }
};

module.exports = { db, sql, proc, __base, logQueryInfo };