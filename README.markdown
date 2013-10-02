#various

This is an experimental in line-by-line variable logging using V8's debugger API.

Given a program:

    var x = 3
    var y = x * x

It will output:

    var x = 3
    x <- 3
    var y = x * x
    y <- 9

#Quick Start

    npm install colors async
    ./run.sh test.js
