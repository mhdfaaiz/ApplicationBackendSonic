const express = require("express");
const app = express();
const dotenv = require('dotenv').config(); // Load environment variables
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const axios = require('axios');
const cors = require('cors');
const { Pool } = require('pg');
const defaultIndicators = ["input 1", "input 2", "input 3", "input 4"];

app.use(cors());
// Use CORS middleware

// Route for the root path
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// Middleware to parse JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Parses URL-encoded bodies

// Store the broker status
let brokerStatus = false;

// MQTT Client setup
const mqtt = require("mqtt");

const client = mqtt.connect({
  host: process.env.MQTT_HOST || '3.82.230.201', // Default broker host if not set in .env
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

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

pool.connect((err) => {
  if (err) {
    console.error('Failed to connect to the database:', err);
  } else {
    console.log('Connected to the PostgreSQL database');
  }
});

let clientStatus = {};
// WebSocket connection handling
io.on("connection", (socket) => {
  console.log("User connected");
  io.emit("status", clientStatus)
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
      axios.post('http://localhost:3000/api/mqtt-data', messageBody)
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
      const serial = messageBody.SerialNo;
      const newStatus = messageBody.status;

      // Check if serialNumber is already in the dictionary
      if (clientStatus.hasOwnProperty(serial)) {
        // Update the status if it has changed
        if (clientStatus[serial] !== newStatus) {
          clientStatus[serial] = newStatus;
          console.log(`Status updated for serialNumber: ${serial}, New Status: ${newStatus}`);
        }
      } else {
        // Add new serialNumber and status as a key-value pair
        clientStatus[serial] = newStatus;
        console.log(`New serialNumber added: ${serial}, Status: ${newStatus}`);
      }
      // Emit the entire dictionary to the frontend
      io.emit("status", clientStatus);

      // Send the status data to the frontend via Axios
      axios.post('http://localhost:3000/api/status', messageBody)
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
      // Set the type to "ALARM"
      messageBody.type = "ALARM";
      // Log the message for debugging
      console.log(topic, formattedMessage);

      // Emit the processed alarm message to the frontend via WebSocket
      io.emit("alarm", JSON.stringify(formattedMessage));

      // Send the alarm data to the frontend via API
      // Make the API request inside an async function
      const sendData = async () => {
        try {
          const response = await axios.post('http://localhost:3000/api/alarm', formattedMessage);
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
  res.json(req.body);
});

app.get('/api/indicators/:serial_number', async (req, res) => {
  const { serial_number } = req.params;

  try {
    const result = await pool.query(
      'SELECT id, name FROM indicators WHERE serial_number = $1 ORDER BY id ASC',
      [serial_number]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching indicators:', error);
    res.status(500).json({ error: 'Failed to fetch indicators' });
  }
});

app.put('/api/indicators/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  try {
    const result = await pool.query(
      'UPDATE indicators SET name = $1 WHERE id = $2', [name, id]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Indicator not found for this serial number' });
    } else {
      res.json({ success: true, message: 'Indicator updated successfully' });
    }
  } catch (error) {
    console.error('Error updating indicator:', error);
    res.status(500).json({ error: 'Failed to update indicator' });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM logs');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API endpoint to fetch names and serial numbers
app.get('/api/Serial_List', async (req, res) => {
  try {
    const result = await pool.query('SELECT name, serial_number FROM Serial_List');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/initialize', async (req, res) => {
  const { serial_number } = req.body;

  try {
    // Check if the serial number already has indicators
    const result = await pool.query(
      'SELECT * FROM indicators WHERE serial_number = $1',
      [serial_number]
    );

    if (result.rows.length === 0) {
      // Serial number doesn't exist; insert default indicators
      const insertPromises = defaultIndicators.map(name =>
        pool.query(
          'INSERT INTO indicators (name, serial_number) VALUES ($1, $2)',
          [name, serial_number]
        )
      );

      await Promise.all(insertPromises);

      res.json({ success: true, message: 'Default indicators created' });
    } else {
      res.json({ success: true, message: 'Indicators already exist for this serial number' });
    }
  } catch (error) {
    console.error('Error initializing indicators:', error);
    res.status(500).json({ error: 'Failed to initialize indicators' });
  }
});

//Endpoint for retrieving reverseindicator value from database
app.get('/api/reverse-indicator/:serialNumber', async (req, res) => {
  const { serialNumber } = req.params;

  try {
    const result = await pool.query(
      'SELECT is_reversed FROM ReverseIndicators WHERE serial_number = $1',
      [serialNumber]
    );

    if (result.rows.length > 0) {
      res.json({ isReversed: result.rows[0].is_reversed });
    } else {
      res.status(404).json({ message: 'No data found for this serial number' });
    }
  } catch (error) {
    console.error('Error fetching reverse indicator:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reverse indicator' });
  }
});

// Endpoint for updating reverseindicator value from database
app.put('/api/reverse-indicator/:serialNumber', async (req, res) => {
  const { serialNumber } = req.params;
  const { isReversed } = req.body;

  try {
    const result = await pool.query(
      'UPDATE ReverseIndicators SET is_reversed = $1 WHERE serial_number = $2 RETURNING *',
      [isReversed, serialNumber]
    );

    if (result.rowCount === 0) {
      // Insert if not existing
      await pool.query(
        'INSERT INTO ReverseIndicators (serial_number, is_reversed) VALUES ($1, $2)',
        [serialNumber, isReversed]
      );
    }

    res.json({ success: true, message: 'Reverse indicator updated successfully' });
  } catch (error) {
    console.error('Error updating reverse indicator:', error);
    res.status(500).json({ success: false, error: 'Failed to update reverse indicator' });
  }
});

// Retrieve all indicator colors for a specific serial number
app.get('/api/indicatoricons/:serialNumber', async (req, res) => {
  const { serialNumber } = req.params;

  try {
    const query = `SELECT indicator, color FROM indicatoricons WHERE serial_number = $1`;
    const { rows } = await pool.query(query, [serialNumber]);

    res.status(200).send(rows);
  } catch (error) {
    console.error('Error fetching indicators:', error);
    res.status(500).send({ message: 'Error fetching indicators' });
  }
});

// Save or update indicator color
app.post('/api/indicatoricons/update', async (req, res) => {
  const { serial_number, indicator, color } = req.body;

  try {
    // Upsert query to update if exists, otherwise insert
    const query = `
          INSERT INTO indicatoricons (serial_number, indicator, color)
          VALUES ($1, $2, $3)
          ON CONFLICT (serial_number, indicator)
          DO UPDATE SET color = $3
      `;
    await pool.query(query, [serial_number, indicator, color]);

    res.status(200).send({ message: 'Indicator color updated successfully' });
  } catch (error) {
    console.error('Error updating indicator color:', error);
    res.status(500).send({ message: 'Error updating indicator color' });
  }
});



// Server setup (listening on a given port)
server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

// Function to convert decimal values to hexadecimal and then to ASCII characters
function dec_to_hex_to_ascii(str) {
  return Buffer.from(parseInt(str, 10).toString(16), 'hex').toString('ascii');
}


