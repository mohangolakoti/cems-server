const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
const { format } = require('date-fns');
const router = require('./Routes/route');
const dotEnv = require('dotenv')
const app = express();
dotEnv.config()

app.use(cors());
app.use(bodyParser.json());

const port = process.env.PORT || 8080;

let initialEnergyValue = null;
let firstStoredEnergyValue = null;
let isFirstDataStoredToday = false;

/* const config = {
  host: process.env.host,
  user: process.env.user,
  password: process.env.password,
  database: process.env.database
};
 */

const config = {
  host: "localhost",
  user: "root",
  password: "",
  database: "energy",
  port: 3306
};

// Routes are coming from Routes folder route.js
app.use('/api', router);

async function initializeInitialEnergyValue() {
  try {
    console.log("Initializing initial energy value...");
    const connection = await mysql.createConnection(config);

    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
    const today = format(new Date(), 'yyyy-MM-dd');
    const previousDayQuery = `
      SELECT energy FROM sensordata 
      WHERE DATE(timestamp) = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
    const todayFirstRecordQuery = `
      SELECT energy FROM sensordata 
      WHERE DATE(timestamp) = ? 
      ORDER BY timestamp ASC 
      LIMIT 1
    `;

    const [previousDayRows] = await connection.execute(previousDayQuery, [yesterday]);
    if (previousDayRows.length > 0) {
      initialEnergyValue = previousDayRows[0].energy;
      console.log("Initial energy value stored from previous day:", initialEnergyValue);
    } else {
      console.log("No data found for the previous day. Fetching today's first record.");
      const [todayRows] = await connection.execute(todayFirstRecordQuery, [today]);
      if (todayRows.length > 0) {
        initialEnergyValue = todayRows[0].energy;
        console.log("Initial energy value set to today's first record:", initialEnergyValue);
      } else {
        console.log("No data found for today yet.");
      }
    }

    await connection.end();
  } catch (error) {
    console.error("Error initializing initial energy value:", error);
  }
}

async function fetchDataAndStore() {
  try {
    console.log("Fetching and storing sensor data...");
    const response = await axios.get("https://energybackend.onrender.com/api/sensordata");
    const newData = response.data;

    if (initialEnergyValue === null) {
      initialEnergyValue = newData.energy;
      console.log("Setting initial energy value to the current value:", initialEnergyValue);
    }

    let energyConsumption = null;
    if (initialEnergyValue !== null) {
      energyConsumption = newData.energy - initialEnergyValue;
    }
    const todayDate = format(new Date(), 'yyyy-MM-dd');

    const query = `
      INSERT INTO sensordata (timestamp, current, power, energy, IRcurrent, IYcurrent, IBcurrent, VRvoltage, VYvoltage, VBvoltage, 
        IRLcurrent, IYLcurrent, IBLcurrent, VRLvoltage, VYLvoltage, VBLvoltage, R_power, Y_power, B_power, Active_power, Reactive_power, 
        Power_factor, Energy_Meter, Voltage, energy_consumption, date) 
      VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      newData.current, newData.power, newData.energy, newData.IRcurrent, newData.IYcurrent, newData.IBcurrent, 
      newData.VRvoltage, newData.VYvoltage, newData.VBvoltage, newData.IRLcurrent, newData.IYLcurrent, newData.IBLcurrent, 
      newData.VRLvoltage, newData.VYLvoltage, newData.VBLvoltage, newData.R_power, newData.Y_power, newData.B_power, 
      newData.Active_power, newData.Reactive_power, newData.Power_factor, newData.Energy_Meter, newData.Voltage, energyConsumption, todayDate
    ];
    
    console.log("Executing query:", query);
    console.log("With values:", values);

    const connection = await mysql.createConnection(config);
    const [result] = await connection.query(query, values);
    await connection.end();

    console.log("Sensor data stored successfully:", newData);
    console.log("Database insert result:", result);

    if (!isFirstDataStoredToday) {
      firstStoredEnergyValue = newData.energy;
      isFirstDataStoredToday = true;
      console.log("First stored energy value for today:", firstStoredEnergyValue);
    }

    const currentDate = format(new Date(), 'yyyy-MM-dd');
    const fileName = `VITB_${currentDate}.txt`;
    const filePath = path.join(__dirname, "VIT-Data", fileName);

    appendDataToFile(newData, filePath);
  } catch (error) {
    console.error("Error fetching and storing sensor data:", error);
  }

  // Call the function recursively with a delay (e.g., every 20 minutes)
 /*  setTimeout(fetchDataAndStore, 20 * 60000); */
}

function formatSensorData(data) {
  const dateTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const formattedData = `${dateTime},${data.current},${data.power},${data.energy},${data.IRcurrent},${data.IYcurrent},${data.IBcurrent},${data.VRvoltage},${data.VYvoltage},${data.VBvoltage},${data.IRLcurrent},${data.IYLcurrent},${data.IBLcurrent},${data.VRLvoltage},${data.VYLvoltage},${data.VBLvoltage},${data.R_power},${data.Y_power},${data.B_power},${data.Active_power},${data.Reactive_power},${data.Power_factor},${data.Energy_Meter},${data.Voltage}\n`;
  return formattedData;
}

function appendDataToFile(data, filePath) {
  const formattedData = formatSensorData(data);

  fs.appendFile(filePath, formattedData, { flag: 'a+' }, (err) => {
    if (err) {
      console.error("Error appending data to file:", err);
    } else {
      console.log("Data appended to file successfully.");
    }
  });
}

initializeInitialEnergyValue().then(() => {
  // Schedule fetchDataAndStore to run every 20 minutes
  setInterval(fetchDataAndStore, 30*60000);
  // Schedule initializeInitialEnergyValue to run every 24 hours
  setInterval(initializeInitialEnergyValue,  30*60000);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

/* const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
const { format } = require('date-fns');
const router =require('./Routes/route')

const app = express();

app.use(cors());
app.use(bodyParser.json());

const port = process.env.PORT || 8080;

let initialEnergyValue = null;
let firstStoredEnergyValue = null;
let isFirstDataStoredToday = false;


const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'energy'
}

//Routes are coming from Routes folder route.js
app.use('/api',router);

async function initializeInitialEnergyValue() {
  try {
    console.log("Initializing initial energy value...");
    const connection = await mysql.createConnection(config);

    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
    const today = format(new Date(), 'yyyy-MM-dd');
    const previousDayQuery = `
      SELECT energy FROM sensordata 
      WHERE DATE(timestamp) = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
    const todayFirstRecordQuery = `
      SELECT energy FROM sensordata 
      WHERE DATE(timestamp) = ? 
      ORDER BY timestamp ASC 
      LIMIT 1
    `;

    const [previousDayRows] = await connection.execute(previousDayQuery, [yesterday]);
    if (previousDayRows.length > 0) {
      initialEnergyValue = previousDayRows[0].energy;
      console.log("Initial energy value stored from previous day:", initialEnergyValue);
    } else {
      console.log("No data found for the previous day. Fetching today's first record.");
      const [todayRows] = await connection.execute(todayFirstRecordQuery, [today]);
      if (todayRows.length > 0) {
        initialEnergyValue = todayRows[0].energy;
        console.log("Initial energy value set to today's first record:", initialEnergyValue);
      } else {
        console.log("No data found for today yet.");
      }
    }

    await connection.end();
  } catch (error) {
    console.error("Error initializing initial energy value:", error);
  }
}

async function fetchDataAndStore() {
  try {
    console.log("Fetching and storing sensor data...");
    const response = await axios.get("https://energybackend.onrender.com/api/sensordata");
    const newData = response.data;

    if (initialEnergyValue === null) {
      initialEnergyValue = newData.energy;
      console.log("Setting initial energy value to the current value:", initialEnergyValue);
    }

    let energyConsumption = null;
    if (initialEnergyValue !== null) {
      energyConsumption = newData.energy - initialEnergyValue;
    }

    const query = `
      INSERT INTO sensordata (timestamp, current, power, energy, IRcurrent, IYcurrent, IBcurrent, VRvoltage, VYvoltage, VBvoltage, 
        IRLcurrent, IYLcurrent, IBLcurrent, VRLvoltage, VYLvoltage, VBLvoltage, R_power, Y_power, B_power, Active_power, Reactive_power, 
        Power_factor, Energy_Meter, Voltage, energy_consumption) 
      VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      newData.current, newData.power, newData.energy, newData.IRcurrent, newData.IYcurrent, newData.IBcurrent, 
      newData.VRvoltage, newData.VYvoltage, newData.VBvoltage, newData.IRLcurrent, newData.IYLcurrent, newData.IBLcurrent, 
      newData.VRLvoltage, newData.VYLvoltage, newData.VBLvoltage, newData.R_power, newData.Y_power, newData.B_power, 
      newData.Active_power, newData.Reactive_power, newData.Power_factor, newData.Energy_Meter, newData.Voltage, energyConsumption
    ];

    const connection = await mysql.createConnection(config);
    await connection.query(query, values);
    await connection.end();

    console.log("Sensor data stored successfully:", newData);

    if (!isFirstDataStoredToday) {
      firstStoredEnergyValue = newData.energy;
      isFirstDataStoredToday = true;
      console.log("First stored energy value for today:", firstStoredEnergyValue);
    }

    const currentDate = format(new Date(), 'yyyy-MM-dd');
    const fileName = `VITB_${currentDate}.txt`;
    const filePath = path.join("D:/VIT-Data", fileName);

    appendDataToFile(newData, filePath);
  } catch (error) {
    console.error("Error fetching and storing sensor data:", error);
  }

  // Call the function recursively with a delay (e.g., every 60 seconds)
  /* setTimeout(fetchDataAndStore, 10*60000); 
}

function formatSensorData(data) {
  const dateTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const formattedData = `${dateTime},${data.current},${data.power},${data.energy},${data.IRcurrent},${data.IYcurrent},${data.IBcurrent},${data.VRvoltage},${data.VYvoltage},${data.VBvoltage},${data.IRLcurrent},${data.IYLcurrent},${data.IBLcurrent},${data.VRLvoltage},${data.VYLvoltage},${data.VBLvoltage},${data.R_power},${data.Y_power},${data.B_power},${data.Active_power},${data.Reactive_power},${data.Power_factor},${data.Energy_Meter},${data.Voltage}\n`;
  return formattedData;
}

function appendDataToFile(data, filePath) {
  const formattedData = formatSensorData(data);

  fs.appendFile(filePath, formattedData, { flag: 'a+' }, (err) => {
    if (err) {
      console.error("Error appending data to file:", err);
    } else {
      console.log("Data appended to file successfully.");
    }
  });
}

initializeInitialEnergyValue().then(() => {
  // Schedule fetchDataAndStore to run every 20 minutes
  setInterval(fetchDataAndStore, 20*60000);
  // Schedule initializeInitialEnergyValue to run every 24 hours
  setInterval(initializeInitialEnergyValue, 24*60*60000);
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); */

/* const mysql = require("mysql2/promise"); */
// Import the MySQL module
/* const mysql = require('mysql');

// Create a connection to the database
const connection = mysql.createConnection({
  host: '127.0.0.1',  // Database host
  port: '3306',           // Database port
  user: 'cems',           // Database username
  password: 'spsolutions',// Database password
  database: 'cems',       // Database name
  connectTimeout: 10000   // Optional: 10 seconds timeout
});

// Connect to the database
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to the database.');

  // Define the data to insert
  const data = { id: 1, person: 'Avinash' }; // Replace with actual column names and values

  // Insert data into the table
  const query = 'INSERT INTO demo1 SET ?';
  connection.query(query, data, (error, results, fields) => {
    if (error) {
      console.error('Error inserting data:', error.stack);
      return;
    }
    console.log('Data inserted successfully, ID:', results.insertId);

    // Close the database connection
    connection.end((err) => {
      if (err) {
        console.error('Error closing the connection:', err.stack);
        return;
      }
      console.log('Database connection closed.');
    });
  });
});
 */
