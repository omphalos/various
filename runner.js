require('colors')

var async = require('async')
  , fs = require('fs')
  , Client = require('./vendor/debugger.js').Client
  , c = new Client()
  , s = new Store()

c.on('error', function() {
  console.error('client error', arguments)
})

c.on('break', function(res) {
  c.breakpoint = res
})

c.on('ready', function() {
  setBreakpoints()
})

c.on('close', function() {
  console.log('client closed')
  fs.writeFileSync('out.json', JSON.stringify(s.log, null, '  '))
  print()
})

c.connect(8081, 'localhost')

function setBreakpoints() {

  // Set breakpoints on every line of every file

  var breakpointRequests = []

  var files = process.argv.filter(function(x) {
    return (
      x !== 'node' &&
      x.indexOf('/runner.js', x.length - '/runner.js'.length) === -1)
  }).forEach(function(f) {

    var fileName = fs.realpathSync(f)
      , lines = fs.readFileSync(fileName).toString().split('\n')

    lines.forEach(function(l, index) {

      breakpointRequests.push(function(callback) {

        c.req({
          command: 'setbreakpoint',
          arguments: {
            type: 'script', target: fileName, line: index 
          }
        }, callback);
      })
    })
  })

  async.series(breakpointRequests, function(err, res) {

    if(err) return console.error(err)

    // When all the breakpoints are set, get ready to log backtraces.
    c.on('break', backtrace)

    // Handle the race condition where we may already be at a breakpoint
    // because of --debug-brk
    if(c.breakpoint) backtrace(c.breakpoint)
  })
}

// Continue after a breakpoint
function resume() {
  c.reqContinue(function(err, res) {
    if(err) return console.error(err)
    c.breakpoint = null
  })
}

// Get the backtrace for the current breakpoint
function backtrace() {

  if(c.destroyed) return console.log('destroyed, aborting backtrace')

  c.reqBacktrace(function(err, res) {

    if(err) return console.error(err)

    var frame = res.frames[0]
    logPos(frame, res)
  })
}

// Track the locals in a frame
function logPos(frame, res) {

  if(c.destroyed) return console.log('destroyed, aborting logPos')

  if(!c.handles[frame.script.ref]) {
    // If we don't have the script, request it first
    return reqScripts(frame, res)
  }

  s.track(res)

  resume()
}

// Request a script, then log it
function reqScripts(frame, backtrace) {

  if(c.destroyed) return console.log('destroyed, aborting reqScripts')

  c.reqScripts(function(err, res) {
    if(err) return console.error(err)
    logPos(frame, backtrace)
  })
}

// Store our instrumentation data
function Store() {

  this.lastTotalFrames = 0
  this.stack = []
  this.log = {}
}

Store.prototype.track = function(backtrace) {

  var self = this

  // Sync stack size
  while(self.stack.length > backtrace.totalFrames)
    self.stack.shift()

  while(self.stack.length < backtrace.totalFrames)
    self.stack.unshift({ vars: {} })

  // Update changing locals
  var savedLocals = self.stack[0].vars
    , frame = backtrace.frames[0]
    , locals = getLocals(frame)

  Object.keys(locals).forEach(function(l) {
    if(savedLocals[l] === locals[l]) return
    self.logLocal(
      backtrace, 0, l, locals[l], frame.line)
  })

  savedLocals.lastLine = frame.line
  self.lastTotalFrames = backtrace.totalFrames
}

Store.prototype.logLocal =
  function(backtrace, frameIndex, varName, varValue, frameLine) {

  var stackLocals = this.stack[frameIndex]
    , frame = backtrace.frames[frameIndex]
    , name = getName(frame)

  var file = this.log[name] = this.log[name] || {}
    , line = file[frameLine] = file[frameLine] || {}

  stackLocals.vars[varName] = line[varName] = varValue

  console.log(name + '(' + frameLine + ')', varName + '=' + varValue)
}

// Turn a frame's locals into a key->value hashtable object
function getLocals(frame) {

  var locals = {}

  frame.locals.filter(function(l) {
    return l.value.value
  }).forEach(function(l) {
    locals[l.name] = JSON.stringify(l.value.value, null, '  ')
  })

  return locals
}

// Resolve a script's name
function getName(frame) {
  return c.scripts[frame.func.scriptId].name
}

// Print insturmentation data to the screen
function print() {

  Object.keys(s.log).forEach(function(file) {

    console.log()
    console.log(('***' + file + '***').cyan)
    console.log()

    var lines = fs.readFileSync(file).toString().split('\n')
    lines.forEach(function(line, index) {

      var codeLine = line.substring()

      var vars = s.log[file][index] || {}
        , indent = line.substring(0, line.length - line.trimLeft().length)

      Object.keys(vars).forEach(function(v) {
        console.log(indent + v.green, '<-'.grey, vars[v].yellow)
      })

      console.log(codeLine)
    })
  })
}
