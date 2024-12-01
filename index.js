const express = require("express");
const app = express();
const dotenv = require('dotenv').config(); // Load environment variables
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const axios = require('axios');
const cors = require('cors');

app.use(cors());
// Use CORS middleware

// Route for the root path
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// Middleware to parse JSON request bodies
app.use(express.json());

// Store the broker status
let brokerStatus = false;

// MQTT Client setup
const mqtt = require("mqtt");

const client = mqtt.connect({
  host: process.env.MQTT_HOST || '188.252.40.82', // Default broker host if not set in .env
  port: process.env.MQTT_PORT || 1883, // Default port if not set in .env
  // You can add other configurations like username, password, etc. if needed
});

// MQTT connection handling
client.on("connect", function () {
  client.subscribe("#", { qos: 2 }, function (err) {  // Subscribe to all topics
    if (!err) {
      console.log("Connected to MQTT broker");
      brokerStatus = true;
    } else {
      console.log("Failed to connect to broker", err);
      brokerStatus = false;
    }
  });
});
// WebSocket connection handling
io.on("connection", (socket) => {
  console.log("User connected");

  // Handle WebSocket disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// MQTT message handling
client.on("message", function (topic, message) {
  // Convert the message from Buffer to string and replace single quotes with double quotes
  message = message.toString().replace(/'/g, '"');

  if (topic === "messages/init") {
    try {
      // Parse the incoming message and process sensor data
      let messageBody = JSON.parse(message);

      // Convert the SerialNo and DeviceName to the desired format
      const serialNumber = `${dec_to_hex_to_ascii(messageBody.sn1)}${dec_to_hex_to_ascii(messageBody.sn2)}${dec_to_hex_to_ascii(messageBody.sn3)}`;
      const body = `${dec_to_hex_to_ascii(messageBody.body1)}${dec_to_hex_to_ascii(messageBody.body2)}${dec_to_hex_to_ascii(messageBody.body3)}${dec_to_hex_to_ascii(messageBody.body4)}${dec_to_hex_to_ascii(messageBody.body5)}${dec_to_hex_to_ascii(messageBody.body6)}${dec_to_hex_to_ascii(messageBody.body7)}${dec_to_hex_to_ascii(messageBody.body8)}${dec_to_hex_to_ascii(messageBody.body9)}`;

      // Construct the final message body
      messageBody = { SerialNo: serialNumber, DeviceName: body, type: "INIT" };
      console.log(messageBody)

      // Emit the message to the frontend via WebSocket (Socket.IO)
      io.emit("message", JSON.stringify(messageBody));

      // Send the data to the frontend via an API (for REST-based access)
      axios.post('https://applicationbackendsonic-2.onrender.com/api/mqtt-data', messageBody)
        .then(response => {
          console.log('Data sent to frontend via API:', response.data);
        })
        .catch(error => {
          console.error('Error sending data via API:', error);
        });

    } catch (error) {
      console.error('Error processing message from MQTT:', error);
    }
  }

  if (topic === "client/status") {
    try {
      let messageBody = JSON.parse(message);

      // Check if status is 'up' or 'down' and set the 'type' accordingly
      if (messageBody.status === "up") {
        messageBody.type = "ONLINE";
      } else if (messageBody.status === "down") {
        messageBody.type = "OFFLINE";
      }

      // Log the message for debugging
      console.log(topic, messageBody);

      // Emit the processed message to the frontend via WebSocket
      io.emit("status", JSON.stringify(messageBody));

      // Send the status data to the frontend via Axios
      axios.post('https://applicationbackendsonic-2.onrender.com/api/status', messageBody)
        .then(response => {
          console.log('Status data sent to frontend via API:', response.data);
        })
        .catch(error => {
          console.error('Error sending status data via API:', error);
        });

    } catch (error) {
      console.error('Error processing message from client status:', error);
    }
  }

  if (topic === "messages/alarm") {
    try {
      let messageBody = JSON.parse(message);
      console.log(messageBody)
      console.log(messageBody)

      // Convert the SerialNo and DeviceName to the desired format
      const serialNumber = messageBody.SerialNo
      const body = `${dec_to_hex_to_ascii(messageBody.body1)}${dec_to_hex_to_ascii(messageBody.body2)}${dec_to_hex_to_ascii(messageBody.body3)}${dec_to_hex_to_ascii(messageBody.body4)}${dec_to_hex_to_ascii(messageBody.body5)}${dec_to_hex_to_ascii(messageBody.body6)}${dec_to_hex_to_ascii(messageBody.body7)}${dec_to_hex_to_ascii(messageBody.body8)}${dec_to_hex_to_ascii(messageBody.body9)}`;
      const Input = messageBody.INPUT
      const Value = messageBody.VALUE
      const Time = messageBody.TIMESTAMP



      // Construct the final message body
      messageBody = { SerialNo: serialNumber, DeviceName: body, type: "INIT" };
      console.log(messageBody)

      // Set the type to "ALARM"


      // Ensure the message has the necessary fields
      const formattedMessage = {
        timestamp: Time, // assuming the timestamp is now
        data: Input || "INPUT", // change this as needed
        status: Value || "VALUE", // change this as needed
        serialno: serialNumber || "SERIAL NUMBER"
      };
      messageBody.type = "ALARM";
      // Log the message for debugging
      console.log(topic, formattedMessage);

      // Emit the processed alarm message to the frontend via WebSocket
      io.emit("alarm", JSON.stringify(formattedMessage));

      // Send the alarm data to the frontend via API
      // Make the API request inside an async function
      const sendData = async () => {
        try {
          const response = await axios.post('https://applicationbackendsonic-2.onrender.com/api/alarm', formattedMessage);
          console.log('Alarm data sent to frontend via API:', response.data);
        } catch (error) {
          console.error('Error sending alarm data via API:', error);
        }
      };

      // Call the async function
      sendData();

    } catch (error) {
      console.error('Error processing alarm message:', error);
    }

  }

  app.get('/api/mqtt-data', (req, res) => {
    let messageBody = JSON.parse(message);
    const inp = messageBody.INPUT
    const mqttData = [
      { TIMESTAMP: new Date().toISOString(), INPUT: inp, VALUE: messageBody.VALUE, SerialNo: messageBody.SerialNo },
      { TIMESTAMP: '2024-11-28 12:05:00', INPUT: 'Input2', VALUE: 'Value2' },
    ];
    res.json(mqttData); // Return the data as JSON
  });

});


// API route to send MQTT data (this can be used to fetch data from the frontend)
app.post('/api/mqtt-data', (req, res) => {
  const mqttData = req.body;  // Received data from MQTT
  console.log('Received data from MQTT:', mqttData);

  // Respond with the data (you can modify this if additional processing is needed)
  res.json({ success: true, data: mqttData });
});
app.post('/api/alarm', (req, res) => {
  // Handle the request here
  console.log(req.body);
  res.json({ success: true, data: req.body });
});
app.post('/api/status', (req, res) => {
  res.send({ message: 'Status received' });
});




// Server setup (listening on a given port)
server.listen(3000, () => {
  console.log("Server running on https://applicationbackendsonic-2.onrender.com");
});

// Function to convert decimal values to hexadecimal and then to ASCII characters
function dec_to_hex_to_ascii(str) {
  return Buffer.from(parseInt(str, 10).toString(16), 'hex').toString('ascii');
}

