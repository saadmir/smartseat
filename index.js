"use strict"

var fs          = require('fs');
var express = require('express');
var sqlite3 = require("sqlite3").verbose();

var app = express();
app.use(express.static(__dirname + '/public'));

var query = {};

var db  = new sqlite3.Database('/home/pi/data/smartseat.sqlite');
db.serialize(function() {
  db.run("CREATE TABLE IF NOT EXISTS tist(tid, timestamp INTEGER, event TEXT, temp_ir REAL, temp_amb REAL, a_x REAL, a_y REAL, a_z REAL, g_x REAL, g_y REAL, g_z REAL, h REAL, m_x REAL, m_y REAL, m_z REAL, p REAL, temp_p REAL)");
  //db.run("INSERT INTO demo (runtime) VALUES (?)", new Date().getTime());
  //db.each("SELECT runtime FROM demo", function(err, row) {
      //console.log("This app was run at " + row.runtime);
  //});
  query.insert = db.prepare("INSERT INTO tist VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  query.delete = db.prepare("DELETE FROM tist WHERE rowid=?");
});

app.get('/update/:tid/:event', function(req, res){

  switch (req.params.event) {
    case "occupied":
    case "empty":
    case "disconnected":
    case "paired":
      var query = "INSERT INTO tist('tid','timestamp','event') VALUES ('" + req.params.tid + "'," + new Date().getTime() + ",'" + req.params.event.toUpperCase() + "')";
      db.run(query);
      broadcast({
        tid: req.params.tid,
        event: req.params.event
      });
      break;
    case "data":
      console.log(req.query);
      var cols = [];
      var vals = [];
      Object.keys(req.query || {}).forEach(function(k){
        if (req.query[k]){
          cols.push(k);
          vals.push(req.query[k]);
        }
      });
      if (cols.length && vals.length && cols.length === vals.length){
        cols.unshift('tid','timestamp', 'event');
        vals.unshift("'"+req.params.tid+"'", new Date().getTime(), "'DATA'");
      }

      var query = "INSERT INTO tist(" + cols.join(',') + ") VALUES (" + vals.join(',') + ")";
      console.log(query);
      db.run(query);

      var data = {
        tid: req.params.tid,
        event: req.params.event
      };

      data.data = req.query || {};
      broadcast(data);
      break;
  }

  db.all("SELECT * FROM tist WHERE tid='" + req.params.tid + "'", function(err, rows) {
    console.log(rows.length);
    res.json(rows);
    res.end();
  });
});

app.get('/:uid/:event', function(req, res){
  var query = "SELECT * FROM tist WHERE tid='" + req.params.uid + "' AND event='" + req.params.event.toUpperCase() + "' ORDER BY timestamp DESC ";
  db.all(query, function(err, rows) {
    console.log(rows.length);
    res.json(rows);
    res.end();
  });
});

app.get('/:uid/:event/:limit', function(req, res){
  var query = "SELECT * FROM tist WHERE tid='" + req.params.uid + "' AND event='" + req.params.event.toUpperCase() + "' ORDER BY timestamp DESC ";
  if (req.params.limit) query += "LIMIT " + req.params.limit;
  db.all(query, function(err, rows) {
    console.log(rows.length);
    res.json(rows);
    res.end();
  });
});

app.get('/', function(req, res){
  res.send('hello world');
});

var WebSocketServer = require('ws').Server
var wss = new WebSocketServer({port: 8080});

var idx = 0;
var clients = {};
wss.on('connection', function(ws){
  idx++;
  ws.idx = idx;
  console.log('inserting client: ' + ws.idx);
  clients[idx] = ws;
  ws.on('close', function() {
    console.log('stopping client: ' + ws.idx);
    delete clients[idx];
  });
});

var broadcast = function(json){
  var data = JSON.stringify(json);
  for(var i in clients){
    clients[i].send(data, function() {});
  }
};

app.listen(3000);



