node --debug-brk=8081 $1 &
node runner.js test.js
pkill node
