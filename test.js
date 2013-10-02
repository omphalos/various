function square(num) {
  var result = num * num
  return result
}

var x = 3
var y = 2
var x2 = square(x)
var y2 = square(y)
var z = x2 + y2
console.log('z is', z)