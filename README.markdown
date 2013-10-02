#various

This is an experiment in line-by-line variable logging using V8's debugger API.

Given a program:

    var x = 3
    var y = x * x
    console.log('done')

It will output:

    var x = 3
    x <- 3
    var y = x * x
    y <- 9
    console.log('done')

#Quick Start

    npm install colors async
    ./run.sh test.js
