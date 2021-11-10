var mqtt = require("mqtt");

var client = mqtt.connect({
  port: 1883,
  host: "213.192.95.198",
  keepalive: 5,
});


client.on("message", function (topic, message) {
  // message is Buffer
  console.log(topic, message.toString());

  // client.end();
});
var x ="0";
client.on("connect", function () {
  client.publish("/messages/alarm/do1/1883C404764D", x);
  client.publish("/messages/alarm/do2/1883C404764D", x);
  client.publish("/messages/alarm/do3/1883C404764D", x);
  client.publish("/messages/alarm/do4/1883C404764D", x);
});

