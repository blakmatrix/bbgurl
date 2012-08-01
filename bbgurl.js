#!/usr/bin/env node

var optimist = require('optimist'),
    http = require('http'),
    fs = require('fs'),
    path = require('path'),
    util = require('util'),
    url = require('url'),
    Stream = require('stream'),
    streamspeed = require('streamspeed'),
    Speedometer = require('./node_modules/streamspeed/lib/speedometer.js'),
    multimeter = require('multimeter'),
    argv,
    _logref, _logfile, log,
    request,
    uri,
    output,
    prettyPipe,
    req,
    speedometer, total, expected;

// Parse arguments.
argv = optimist
  .usage([
    'bbgurl: A tiny cli http client; a thin wrapper around mikeal/request. Named by @blakmatrix.',
    '',
    'USAGE: $0 <url> [<options>]'
  ].join('\n'))
  .options({
    'body': {
      alias: 'd',
      describe: 'String body for http request.'
    },
    'followRedirect': {
      boolean: true,
      default: true,
      describe: 'Follow the first http 30x redirect (if any).'
    },
    'followAllRedirects': {
      boolean: true,
      default: false,
      describe: 'Follow *all* http 30x redirects (if any).'
    },
    'headers': {
      alias: 'H',
      describe: 'A JSON representation of any headers.'
    },
    'include': {
      alias: 'i',
      boolean: true,
      default: false,
      describe: 'Print the response headers.'
    },
    'logfile': {
      describe: 'Optional file to write logs to.'
    },
    'method': {
      alias: 'X',
      default: 'GET',
      describe: 'HTTP method.'
    },
    'output': {
      alias: 'o',
      describe: 'HTTP response output file (stdout if not specified)'
    },
    'pretty': {
      alias: 'p',
      default: false,
      boolean: true,
      describe: 'Attempt to reformat JSON chunks in a human-readable format'
    },
    'strictSSL': {
      default: false,
      boolean: true,
      describe: 'Require that SSL certificates be valid.'
    },
    'user': {
      alias: 'u',
      describe: 'Specify basic auth credentials (ex: `-u user:pass`)'
    },
    'verbose': {
      alias: 'v',
      boolean: true,
      describe: 'Output logs to stderr.'
    }
  })
  .check((function () {
    // Checks to make sure that a uri is specified.
    var fn = function (argv) {
      return !!(argv._.length || argv.uri)
    };
    fn.toString = function () {
      return 'Must specify a uri.';
    };
    return fn;
  })())
  .argv
;

// Configure logging based on requested verbosity and/or logfile spec.
// NOTE: We need to define process.logging and get our events in a row
// **before** requiring request!
if (argv.verbose && !argv.logfile) {
  log = console.error;
}
else if (argv.logfile) {
  _logfile = fs.createWriteStream(path.resolve(argv.logfile));
  log = function (msg) {
     _logfile.write(util.format(msg) + '\n');
  };
}
else {
  // Default is to noop.
  log = function () {};
}

// Define process.logging to write to our log.
process.logging = function (name) {
  return function (msg, ctx) {
    log('[%s] ' + logrefFormatter(msg, ctx || {}), name);
  }

  // Ripped out of logref.
  function logrefFormatter (msg, ctx) {
    while (msg.indexOf('%') !== -1) {
      var start = msg.indexOf('%')
        , end = msg.indexOf(' ', start)
        ;
      if (end === -1) end = msg.length 
      msg = msg.slice(0, start) + ctx[msg.slice(start+1, end)] + msg.slice(end)
    }
    return msg
  }
};

// Finally, we may require request.
request = require('request');

// Handle the uri argument, attach to argv.
uri = url.parse(argv.uri || argv._.join(' '));
if (!uri.protocol) {
  uri = url.parse('http://' + uri.href);
}

if (argv.user) {
  uri.auth = argv.user;
  delete argv.user;
}

argv.uri = uri;

// Define the output stream.
output = argv.output
  ? fs.createWriteStream(path.resolve(argv.output))
  : process.stdout;

if (argv.headers) {
  try {
    argv.headers = JSON.parse(argv.headers);
  }
  catch (err) {
    log('[bbgurl] Unable to parse headers information. Defaulting to {}.');
    argv.headers = {};
  }
}

// Shim stream for prettifying json
prettyPipe = new Stream();
prettyPipe.writable = true;
prettyPipe.write = function (data) {
  try {
    output.write(JSON.stringify(JSON.parse(data.toString()), null, 2));
  } catch(ex) {
    output.write(data);
  }

  return true;
};
prettyPipe.end = function (data) {
  output.write('\n');
};

//
// meat and potatoes.
//
req = request(argv);
req.pipe(argv.pretty ? prettyPipe : output);

// Print saved location.
if (argv.output) {
  output.on('close', function () {
    log('[bbgurl] Data written to %s', path.resolve(argv.output));
  });
}

// In verbose mode, show the download bar.
if (argv.verbose) {
  // Use the speedometer directly so that we may get at the total.
  speedometer = new Speedometer();

  req.on('response', function (response) {
    expected = response.headers['content-length'];
  });

  total = 0;

  // Create a progress bar.
  createBar({
    width: 30,
    before: '[bbgurl] Downloading: (',
    after: ') ',
    solid: {
      background: null,
      foreground: 'magenta',
      text: '♥'
    },
    empty: {
      background: null,
      foreground: null,
      text: ' '
    }
  }, function (bar, done) {

    req.on('data', function (data) {
      total += data.length;
      speedometer.update(data, null, function (bps, avg) {
        var percentage = expected
          ? 100 * total / expected
          : 0
        ;

        if (
          (percentage < 0) ||
          (percentage > 100) ||
          isNaN(percentage)
        ) {
          percentage = 0;
        }

        percentage = Math.floor(percentage * 10) / 10;

        bar.percent(percentage, util.format(
          '%d% (%s/%s, %s/sec)',
           percentage,
           streamspeed.toHuman(total),
           streamspeed.toHuman(expected),
           streamspeed.toHuman(bps)
        ));

      });
    });
    req.on('end', function () {
      // Set the bar to 100%.
      bar.percent(100, util.format(
        '100% (%s/%s)                    ',
         streamspeed.toHuman(total),
         streamspeed.toHuman(expected)
      ));

      done(function (err) {
        if (err) {
          throw err;
        }
      });
    });
  });

  // Creates a progress bar.
  function createBar(opts, cb) {
    process.stdin.setRawMode(true);
    var multi = multimeter(process.stdin, process.stderr);
    multi.charm.cursor(false);
    multi.drop(opts, function (bar) {
      cb(bar, cleanup(multi));
    });
    multi.charm.on('^C', cleanup(multi));
  }

  // Destroys the progress bar of the moment.
  function cleanup(multi) {
    return function done(cb) {
      multi.charm.cursor(true);
      multi.charm.display('reset');
      process.stdin.setRawMode(false);
      multi.write('\n').destroy();
      if (cb) {
        cb();
      }
    }
  }

}

// if --include, print the response headers.
// I couldn't actually find the raw response headers,
// so I do some finagling to rebuild them here.
if (argv.include) {
  req.on('response', function (res) {

    write('HTTP/%s %d %s',
      res.httpVersion,
      res.statusCode,
      http.STATUS_CODES[res.statusCode]
    );

    Object.keys(res.headers).forEach(function (k) {
      write('%s: %s', upperCase(k), res.headers[k]);
    });

    write();

    function write() {
      output.write(util.format.apply(null, arguments) + '\r\n');
    }

    function upperCase(key) {
      return key.split('-').map(function (w) {
        return w.substr(0, 1).toUpperCase() + w.substr(1);
      }).join('-');
    }

  });
}
