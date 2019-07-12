const express = require('express');
const request = require('request');
const app = express();
var needle = require('needle');
//46363672
//f44b5cbe6c13c8c66b1f5a907b4ee4fa60e5a8b9


//const server = require('http').createServer(app)
const fetch = require('node-fetch');
const socket = require('socket.io');
var http = require('http');

const port = process.env.PORT || 2000;
const userRouter = require('./routers/user');
require('./database/mongoose');

//onsole.log(io);

app.use(express.static('public'));
app.use(express.json());
app.use(userRouter);

let SOCKET_LIST = {};
let ID_MAP = {};
var initPack = {player: [], bullet: []};
var removePack = {player: [], bullet:[]};
let COLORS = ["#BB8FCE", "#3498DB", "#D35400", "#CB4335", "#0E6655", "#D4AC0D", "#C39BD3", "#E74C3C", "#9C640C"];
//let PLAYERS = {};



var createEntity = function(x, y) {
  var self = {
    x: x,
    y: y,
    spdX: 0,
    spdY: 0,
    id: '',
    color: 'black',
    mult: 1
  }

  self.update = function() {
    self.updatePosition();
  }

  self.updatePosition = function () {
    self.x += (self.spdX * self.mult);
    self.y += (self.spdY * self.mult);
  }

  self.getDistance = function(pt) {
    return Math.sqrt(Math.pow(self.x-pt.x, 2) + Math.pow(self.y - pt.y, 2));
  }

  return self
}
var Player = function (id, x, y, hp, score)
{
  var data = createEntity(x, y);
  data.id = id;
  data.color = COLORS[Math.floor(Math.random() * 9)];
  data.up = false,
  data.down = false,
  data.left = false,
  data.right = false,
  data.attack = false,
  data.mouseAngle = 0;
  data.spd = 8;
  data.canShoot = true;
  data.lastShot = 0;
  data.reloadTime = 200;
  //console.log(hp);
  data.hp = hp;
  data.fullhp = 100;
  data.score = score;


  data.update = function() {
    data.updatePosition();

    for(let i = 0; i < Wall.list.length; i++)
    {
      // let xx = data.x;
      // let yy = data.y;
      // if(data.left === true)
      //   xx = data.x
      // if(data.right === true)
      //   xx = data.x + 20;
      // if(data.up === true)
      //   yy = data.y
      // if(data.down === true)
      //   yy = data.y + 20;

      if(Wall.list[i].collide(data.x, data.y))
      {
        if(data.up === true)
          data.y += 8;
        if(data.down === true)
          data.y -= 8;
        if(data.left === true)
          data.x += 8;
        if(data.right === true)
          data.x -= 8;
      }
    }

    if(data.canShoot === false && (Date.now() - data.lastShot) > data.reloadTime)
      data.canShoot = true;
    if(data.attack && data.canShoot)
    {
      data.shootBullet(data.mouseAngle);
      data.canShoot = false;
      data.lastShot = Date.now();
    }
  }

  data.shootBullet = function (angle) {
    var b = Bullet(data, angle)
    //console.log(angle);

    b.x = data.x;
    b.y = data.y;
  }

  data.updatePosition = function()
  {
    if(data.right)
      data.x += data.spd;
    if(data.left)
      data.x -= data.spd;
    if(data.up)
      data.y -= data.spd;
    if(data.down)
      data.y += data.spd;
  }

  data.getInitPack = function ()
  {
    return {
      id: data.id,
      x: data.x,
      y: data.y,
      hp: data.hp,
      hpMax: data.fullhp,
      score: data.score,
      color: data.color
    }
  }

  data.getUpdatePack = function ()
  {
    return {
      id: data.id,
      x: data.x,
      score: data.score,
      hp: data.hp,
      y: data.y,
    }
  }
  Player.list[id] = data;
  initPack.player.push(data.getInitPack());
  //console.log(initPack);
  return data;
}

Player.list = {};

Player.onConnect = function(socket, x, y, hp, score)
{
  //console.log(score)
  var currentPlayer = Player(socket.id, x, y, hp, score);
  socket.on('keyPress', (data) => {
    //console.log('dsadf')
    if(data.input === 'left')
      currentPlayer.left = data.state;
    else if(data.input === 'right')
      currentPlayer.right = data.state;
    else if(data.input === 'up')
      currentPlayer.up = data.state;
    else if(data.input === 'down')
      currentPlayer.down = data.state;
    else if(data.input == 'shoot')
      currentPlayer.attack = data.state;
    else if(data.input === 'mouseAngle')
    {
      let angle = Math.atan2(currentPlayer.y - data.state.y, currentPlayer.x - data.state.x) * 180 / Math.PI;
      // console.log(currentPlayer.x + ' ' + currentPlayer.y);
      // console.log(data.state.x + ' ' + data.state.y);
      //console.log(angle);
      //console.log(currentPlayer.y - data.state.y + ' ' + currentPlayer.x - data.state.x);
      currentPlayer.mouseAngle = angle;
      //console.log(currentPlayer.mouseAngle);
    }
  });


  socket.emit('init', {
    player: Player.getSignIn(),
    bullet: Bullet.getSignIn()
  })
}

Player.getSignIn = function() {
  var players = [];
  for(var i in Player.list)
  {
    players.push(Player.list[i].getInitPack())
  }

  return players;

}

Player.onDisconnect = function(socket) {
  delete Player.list[socket.id];
  removePack.player.push(socket.id);
}

Player.update = function()
{
  var package = [];
  for(var i in Player.list)
  {
    let player = Player.list[i];
    // player.x++;
    // player.y++;
    player.update();
    //console.log(socket.color);
    package.push(player.getUpdatePack());
  }

  return package;
}

var Bullet = function(parent, angle)
{
  var self = createEntity(parent.x, parent.y)
  self.id = Math.random();
  self.parent = parent;
  self.spd = 20;
  self.spdX = -Math.cos(angle/180*Math.PI) * 20;
  self.spdY = -Math.sin(angle/180*Math.PI) * 20;
  self.dmg = 5;
  self.timer = 0;
  self.remove = false;
  var super_update = self.update;

  self.update = function () {
    if(self.timer++ > 15)
    {
      self.remove = true;
    }
    super_update();

    for(var i in Player.list)
    {
      var p = Player.list[i];
      //hit and its hitting a different player
      if(self.getDistance(p) < 30 && self.parent.id !== p.id)
      {
        p.hp -= self.dmg;;
        var shooter = Player.list[self.parent.id]

        if(p.hp <= 0)
        {
          if(shooter)
          {
            shooter.score += 1;
          }

          p.hp = p.fullhp;
          p.x = 50;
          p.y = 50;
          p.score = 0
        }
        self.remove = true;
      }
    }
  }

  self.getInitPack = function ()
  {
    return {
      id: self.id,
      x: self.x,
      y: self.y,
    }
  }

  self.getUpdatePack = function ()
  {
    return {
      id: self.id,
      x: self.x,
      y: self.y,
    }
  }

  Bullet.list[self.id] = self;
  //console.log(self.x + ' ' + self.y);
  initPack.bullet.push(self.getInitPack());

  return self;
}

Bullet.getSignIn = function ()
{
  var bullets = [];
  for(var i in Bullet.list)
  {
    bullets.push(Bullet.list[i].getInitPack())
  }

  return bullets;
}

Bullet.list = {};

Bullet.update = function()
{
  var package = [];
  for(var i in Bullet.list)
  {
    let bullet = Bullet.list[i];

    for(let i = 0; i < Wall.list.length; i++)
    {
      if(Wall.list[i].collide(bullet.x, bullet.y))
      {
        bullet.spdX  *= -1;
        bullet.spdY *= -1;
      }
    }
    if(bullet.remove)
    {
      //console.log('delete')
      delete Bullet.list[i];
      removePack.bullet.push({
        id: bullet.id,
      });
    }
    bullet.update();

    //console.log(socket.color);
    package.push(bullet.getUpdatePack());


  }

  return package;
}
//server.listen(port);


var server = app.listen(port, () => {
  needle.patch(`http://localhost:${port}/users/logoutAll`);
  console.log('Server is running on port ' + port);
});

var io = socket(server);

io.on('connection', function(socket) {
  console.log('user connected!', socket.id)

  socket.on('join',function (data){
      socket.id = Math.random();//data._id;
      data = JSON.parse(data);
      //console.log(data);
      let name = data.name;
      //initializeSession();
      // socket.x = 50;
      // socket.y = 50;
      // socket.color = COLORS[Math.floor(Math.random() * 9)];
      ////var currentPlayer = Player(socket.id, data.x, data.y);
      console.log(Wall.list);
      socket.emit('walls', Wall.list);
      SOCKET_LIST[socket.id] = socket;
      ID_MAP[socket.id] = data._id;
      Player.onConnect(socket, data.x, data.y, data.hp, data.score)
      //PLAYERS[socket.id] = currentPlayer;
      //SOCKET_LIST[data._id]
      //console.log(SOCKET_LIST.length);
      socket.emit

      socket.on('disconnect', function() {
        var update = {
          x: Player.list[socket.id].x,
          y: Player.list[socket.id].y,
          score: Player.list[socket.id].score,
          hp: Player.list[socket.id].hp,
          loggedIn: false
        }

        //console.log(update);

        needle.patch(`http://localhost:${port}/users/save/${name}`, update, {json: true}, function(err, resp) {

        });


        //instead i think i need to make a socket.io call to do this on the front end

        delete ID_MAP[socket.id];
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket)



      });
    })
  });


setInterval(function() {
  var package = {
    player: Player.update(),
    bullet: Bullet.update(),
  }
 //
 //  if(package.player.length !== 0)
 //  {
 //    //console.log(initPack.player.length)
 //   console.log(package);
 // }

  for(var i in SOCKET_LIST)
  { //emit pack to each socket;
    //console.log(i);
    let socket = SOCKET_LIST[i];
    socket.emit('update', package)
    socket.emit('init', initPack)
    socket.emit('remove', removePack);
  }
  initPack.player = [];
  initPack.bullet = [];
  removePack.player = [];
  removePack.bullet = [];

}, 40)


// io.on('connection', function(socket) {
//   console.log('a user connected');
// })
// serve the homepage
app.get('/', (req, res) => {
  res.sendFile('/Users/henrymacarthur/Desktop/Projects/Game/public/index.html');
});


/////////////
class Wall
{
  constructor(x, y, w, h)
  {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  collide(x, y)
  {

    if( (x + 20 >= this.x && x + 20 <= this.x + this.w && y >= this.y && y <= this.y + this.h)
      || (x  >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h)
      || (x + 20 >= this.x && x + 20 <= this.x + this.w && y + 20 >= this.y && y +20 <= this.y + this.h)
      || (x >= this.x && x <= this.x + this.w && y +20 >= this.y && y + 20<= this.y + this.h)){      // console.log(x + ' ' + y)
      // console.log(this);
      //console.log(y+20 + ' ' + this.y)
      return true;
    }
    return false;
  }
}

Wall.list = [new Wall(100, 0, 30, 300), new Wall(300, 150, 200, 30), new Wall(100, 300, 200, 30),
new Wall(100, 400, 200, 30), new Wall(280, 100, 30, 200), new Wall(200, 50, 30, 200), new Wall(600, 100, 30, 300),
new Wall(750, 100, 30, 300), new Wall(675, 400, 30, 100), new Wall(400, 400, 150, 30),
new Wall(500, 0, 30, 100), new Wall(620, 300, 60, 30), new Wall(680, 200, 70, 30), new Wall(-18, 0, 20, 800),
new Wall(0, -20, 900, 20), new Wall(0, 500, 800, 20), new Wall(800, 0, 20, 500)];
