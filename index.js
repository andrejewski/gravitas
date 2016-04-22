
var $game = document.getElementById('game');
var ctx = $game.getContext('2d');

var sum = function(x,y) {return x+y};

var kFrameWidth = $game.width;
var kFrameWidthCenter = kFrameWidth / 2;
var kFrameHeight = $game.height;
var kFrameHeightCenter = kFrameHeight / 2;

var kDrawRate = 50;
var kRadiusSize = 5;

var kG = 1000; // gravitational constant
var kDefaultMass = 1; // kg

function Mass(x, y) {
  return {
    x: x,
    y: y,
    m: kDefaultMass,
    
    vx: 0,
    vy: 0,

    ax: 0,
    ay: 0,

    isTarget: false,
  };
}

function defaultSystem() {
  var target = Mass(kFrameWidthCenter, kFrameHeightCenter);
  target.isTarget = true;
  return [target];
}

function Session(system) {
  return {
    timeEllapsed: 0,
    dateStart: null,
    dateEntered: null,
    system: system,
    isPaused: false,
    isFinished: false,
  };
}

function findMassByCoords(masses, x, y) {
  var margin = 20;
  var target = null;
  var proximity = Infinity;
  var len = masses.length;
  for(var i = 0; i < len; i++) {
    var m = masses[i];
    var d = massDistance(m, {x: x, y: y});
    if(d < (m.m * kRadiusSize) && d < proximity) {
      target = m;
      proximity = d;
    }
  }
  return target;
}

function addMass(session, x, y) {
  var begin = session.system.length === 1;
  session.system.push(Mass(x,y));
  if(begin) {
    session.dateStart =
    session.dateEntered = new Date();
  }
  return true;
}

function enlargeMass(session, x, y) {
  var mass = findMassByCoords(session.system, x, y);
  if(!mass || mass.isTarget) return false;
  mass.m++;
  return true;
}

function destoryMass(session, x, y) {
  if(session.system.length <= 2) return false;
  var mass = findMassByCoords(session.system, x, y);
  if(!mass || mass.isTarget) return false;
  session.system = session.system
    .filter(function(x) {return x !== mass;});
  return true;
}

function massDistance(a, b) {
  return Math.sqrt(Math.pow(a.x-b.x, 2)+Math.pow(a.y-b.y, 2));
}

function massAngle(a, b) {
  return Math.atan(b.y - a.y, b.x - a.x);
}

function updateSystem(prevSystem, timeDelta) {
  var t = timeDelta / 1000;

  var nextSystem = prevSystem
    .map(function(m) {return Object.assign({}, m);});

  return nextSystem.map(function(mf, i) {
    var mi = prevSystem[i];
    var fgx = [];
    var fgy = [];

    prevSystem.forEach(function(mx) {
      var radius = massDistance(mi, mx);
      if(!radius) return;
      var theta = massAngle(mi, mx);
      var force = (kG * mi.m * mx.m) / Math.pow(radius, 2);
      // fgx.push(Math.sign(mx.x - mi.x)*force*Math.cos(theta));
      // fgy.push(Math.sign(mi.y - mx.y)*force*Math.sin(theta));
      fgx.push(Math.sign(mx.x - mi.x)*force*Math.cos(theta));
      fgy.push(force*Math.sin(theta));
    });

    // console.log(fgx, fgy);
    mf.ax = fgx.reduce(sum, 0) / mi.m;
    mf.ay = fgy.reduce(sum, 0) / mi.m;

    mf.vx = mi.vx + (mf.ax * t);
    mf.vy = mi.vy + (mf.ay * t);
    mf.x  = mi.x  + (mf.vx * t);
    mf.y  = mi.y  + (mf.vy * t);
    return mf;
  });
}

function cleanSystem(prevSystem) {
  var margin = 20;
  var system = prevSystem.filter(function(m) {
    return (
      (m.x + margin > 0) &&
      (m.y + margin > 0) &&
      (m.x - margin < kFrameWidth) &&
      (m.y - margin < kFrameHeight));
  });
  return system;
}

function getEventPosition(canvas, event) {
  var rect = canvas.getBoundingClientRect();
  var x = event.clientX - rect.left;
  var y = event.clientY - rect.top;
  return {x: x, y: y};
}

var $start = document.getElementById('start-button');
var $pause = document.getElementById('pause-button');

var session = null;
var physics = null; // physics calculations
var display = null; // drawing / rendering

function physicsTick(session) {
  var system = cleanSystem(session.system);
  var hasTarget = system
    .reduce(function(b, m) {return b || m.isTarget}, false);
  if(!hasTarget) {
    var dateFinished = new Date();
    session.isFinished = true;
    session.timeEllapsed += dateFinished - session.dateEntered;
    clearInterval(physics);
  } else {
    session.system = updateSystem(system, kDrawRate);
  }
}

function displayTick(session) {
  ctx.clearRect(0, 0, kFrameWidth, kFrameHeight);
  if(session.isFinished) {
    // show finish screen
    ctx.fillText("Finished", 20, 20);
  } else if(session.isPaused) {
    // show pause screen
    ctx.fillText("Paused", 20, 20);
  } else {
    // show scene
    // display masses
    session.system.forEach(function(m) {
      ctx.beginPath();
      ctx.fillStyle = m.isTarget ? '#00ff88' : 'rgba(0,0,0,0.5)';
      ctx.arc(m.x, m.y, kRadiusSize * m.m, 0, Math.PI*2);
      ctx.fill();
    });
    // display timer
  }
}

function setRenderLoop(func) {
  var isRendering = true;
  function renderStep() {
    if(isRendering) {
      func();
      window.requestAnimationFrame(renderStep);
    }
  }
  renderStep();

  return function renderStop() {
    isRendering = false;
  }
}

function clearRenderLoop(stop) { stop(); }

$start.onclick = function() {
  if(session && session.isFinished) {
    session = null;
    clearRenderLoop(display);
  }

  if(!session) {
    session = Session(defaultSystem());
    physics = setInterval(physicsTick.bind(null, session), kDrawRate);
    display = setRenderLoop(displayTick.bind(null, session));
  } else if(session.isPaused) {
    session.isPaused = false;
    session.dateEntered = new Date();
    physics = setInterval(physicsTick.bind(null, session), kDrawRate);
  }
}

$pause.onclick = function() {
  if(!session) return;
  clearInterval(physics);
  var datePause = new Date();
  session.timeEllapsed += datePause - session.dateEntered;
  session.isPaused = true;
}

$game.onclick = function(e) {
  if(!session) return;
  var coords = getEventPosition($game, e);
  
  // destoryMass(session, coords.x, coords.y) ||
  enlargeMass(session, coords.x, coords.y) ||
  addMass(session, coords.x, coords.y);
}

$game.onmousedown = function(e) {

}

$game.onmouseup = function(e) {

}


