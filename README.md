# bbgurl

* npm-installable cli http client
* thin wrapper around [mikeal/request](https://github.com/mikeal/request)
* named by [@blakmatrix](https://github.com/blakmatrix)

## Install:

    npm install bbgurl -g

## Usage:

```
$ bbgurl 
bbgurl: A tiny cli http client; a thin wrapper around mikeal/request. Named by @blakmatrix.

USAGE: node ./bbgurl.js <url> [<options>]

Options:
  --body, -d            String body for http request.                             
  --followRedirect      Follow the first http 30x redirect (if any).                [boolean]  [default: true]
  --followAllRedirects  Follow *all* http 30x redirects (if any).                   [boolean]  [default: false]
  --headers, -H         A JSON representation of any headers.                       [default: {}]
  --include, -i         Print the request headers.                                  [boolean]  [default: false]
  --logfile             Optional file to write logs to.                           
  --method, -X          HTTP method.                                                [default: "GET"]
  --output, -o          HTTP response output file (stdout if not specified)       
  --pretty, -p          Attempt to reformat JSON chunks in a human-readable format  [boolean]  [default: false]
  --strictSSL           Require that SSL certificates be valid.                     [boolean]  [default: false]
  --user, -u            Specify basic auth credentials (ex: `-u user:pass`)       
  --verbose, -v         Output logs to stderr.                                      [boolean]

Argument check failed: Must specify a uri.
```

## A Few Examples:

### Hit an endpoint

```
$ bbgurl http://whatismyip.nodejitsu.com/index.json
{ "ip": "71.198.76.200" }
```

### Set some headers

```
$ bbgurl http://whatismyip.jit.su -H '{ "accept": "application/json" }'
{ "ip": "71.198.76.200" }
```

### Do some basic auth

```
$ bbgurl -u josh:supersekritpw http://localhost:8080
{ "success": true, "message": "Welcome to the inner sanctum." }
```

### Download a tarball

```
$ bbgurl --verbose http://nodejs.org/dist/v0.8.4/node-v0.8.4.tar.gz -o node-v0.8.4.tar.gz
[bbgurl] Downloading: (♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥) 100% (11.29MB/11.29MB)                    

[bbgurl] Data written to /home/josh/dev/bbgurl/node-v0.8.4.tar.gz
$ tar -xzf node-v0.8.4.tar.gz 
$ cd node-v0.8.4/
$ ls
AUTHORS    BSDmakefile  common.gypi  deps  lib      Makefile  README.md  test   vcbuild.bat
benchmark  ChangeLog    configure    doc   LICENSE  node.gyp  src        tools
```

## License:

MIT/X11.
