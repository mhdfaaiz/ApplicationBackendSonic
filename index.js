const express = require("express");
const app = express();
const dotenv = require('dotenv').config;
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const port = process.env.PORT || 3000;
const axios = require('axios');

var mqtt = require("mqtt");
let brokerStatus = false;

// push notification URL if needed like ELM 
// https://salamah.api.elm.sa/salamahservices/api/v1/client/rull/alarm-notification
let url = "https://www.google.com/";

// var ping = require("ping");
// let devicesData = [
//   {serialNumber:"1883C404764B",ip:"10.8.0.25"},
//   {serialNumber:"1883C404764C",ip:"10.8.0.29"},
//   {serialNumber:"1883C404764D",ip:"10.8.0.33"},
//   {serialNumber:"1883C404764E",ip:"10.8.0.37"},
// ];

let devicesStatus = {
  "1883C404764B":false , 
  "1883C404764C":false , 
  "1883C404764D":false , 
  "1883C404764E":false , 
}

// function checkDevices(){
//   // do whatever you like here
//   devicesData.forEach(function (device) {
//     ping.promise.probe(device.ip).then(function (res) {
//       devicesStatus[device.serialNumber]= res.alive;
//     });
//   });
//   setTimeout(checkDevices, 1000);
// }

// checkDevices();



//connect to techbase brooker
var client = mqtt.connect({
  port: 1883,
  host: "213.192.95.198",
});

//connect to NAFCO brooker
var client2 = mqtt.connect('mqtt://true-engineer.cloudmqtt.com',
{ 
  username: "ivjutwyy",
  password: "NaOeLe2ee4WA",
});

client.on("connect", function (connack) {
  client.subscribe("#", { qos: 2 }, function (err) {
    if (!err) {
      console.log("Client 1 connected to the broker successfully");
      brokerStatus = true;
    } else {
      console.log("Failed to connect to the broker");
      brokerStatus=false;
    }
  });
});

client2.on("connect", function (connack) {
  client.subscribe("#", { qos: 2 }, function (err) {
    if (!err) {
      console.log("Client 2 connected to the broker successfully");
      brokerStatus = true;
    } else {
      console.log("Failed to connect to the broker");
      brokerStatus=false;
    }
  });
});


client.on("disconnect", function () {
  console.log("the broker forcfully disconnected you");
});

client.on("close", function () {
  brokerStatus=false;
  console.log("the broker is disconnected");
});

client.on("offline", function () {
  console.log("the client2 is offline");
});

client.on("message", function (topic, message) {
  // message is Buffer
  message= message.toString().replace(/'/g, '"');
  if(topic === "messages/init"){
    let messageBody = JSON.parse(message);
    const serialNumber = `${dec_to_hex_to_ascii(messageBody.sn1)}${dec_to_hex_to_ascii(messageBody.sn2)}${dec_to_hex_to_ascii(messageBody.sn3)}`
    const body = `${dec_to_hex_to_ascii(messageBody.body1)}${dec_to_hex_to_ascii(messageBody.body2)}${dec_to_hex_to_ascii(messageBody.body3)}${dec_to_hex_to_ascii(messageBody.body4)}${dec_to_hex_to_ascii(messageBody.body5)}${dec_to_hex_to_ascii(messageBody.body6)}${dec_to_hex_to_ascii(messageBody.body7)}${dec_to_hex_to_ascii(messageBody.body8)}${dec_to_hex_to_ascii(messageBody.body9)}`
    messageBody = {SerialNo : serialNumber, DeviceName: body,type : "INIT"};
    console.log(topic, messageBody);
    io.emit(JSON.stringify(messageBody));
  }
  if(topic === "client/status"){
    let messageBody = JSON.parse(message);
    if(messageBody.status === "up"){
      messageBody.type = "ONLINE";
    }
    if(messageBody.status=== "down"){
      messageBody.type = "OFFLINE";
    }
   console.log(topic, messageBody);
   io.emit(JSON.stringify(messageBody));
  }
  if(topic === "messages/alarm"){
    let messageBody = JSON.parse(message);
    messageBody.type = "ALARM";
    console.log(topic, messageBody);
    io.emit(JSON.stringify(messageBody));
  }
  
  // axios.post(url, {
  //   topic: topic,
  //   message: message
  // })
  // .then(function (response) {
  //   // console.log(response);
  // })
  // .catch(function (error) {
  //   // console.log(error);
  // });

  client2.publish(topic, message);
});




// client.on("packetreceive", function (packet) {
//   console.log(new Date());
//   console.log(packet);
// });

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
  res.render("dashboard.ejs", { devicesStatus ,brokerStatus});
});
app.get("/1883C404764B", async (req, res) => {
  res.render("1883C404764B.ejs");
});
app.get("/1883C404764C", (req, res) => {
  res.render("1883C404764C.ejs");
});
app.get("/1883C404764D", (req, res) => {
  res.render("1883C404764D.ejs");
});
app.get("/1883C404764E", (req, res) => {
  res.render("1883C404764E.ejs");
});

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

function dec_to_hex_to_ascii(str1)
 {
  const dec = parseInt(str1).toString(16);
	const hex  = dec.toString();
	var str = '';
	for (var n = 0; n < hex.length; n += 2) {
		str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
	}
	return str.split("").reverse().join("");
 }

