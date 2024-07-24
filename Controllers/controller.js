const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2/promise");
const app = express();
const { format,subDays, startOfDay, endOfDay } = require('date-fns');
const dotEnv = require('dotenv')
dotEnv.config()
app.use(cors());
app.use(bodyParser.json());

const config = {
  host: process.env.host,
  user: process.env.user,
  password: process.env.password,
  database: process.env.database,
  port:process.env.port
};

const sensorData = async (req, res) => {
   try {
    const connection = await mysql.createConnection(config);
    const query = `
      SELECT *
      FROM sensordata
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    const [rows] = await connection.query(query);
    await connection.end();
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error fetching latest sensor data" });
  }
  };
  
  const energyConsumption = async (req, res) => {
    try {
        const connection = await mysql.createConnection(config);
        const dates = [
          subDays(new Date(), 6),
          subDays(new Date(), 5),
          subDays(new Date(), 4),
          subDays(new Date(), 3),
          subDays(new Date(), 2),
          subDays(new Date(), 1),
            new Date()
        ];

        const queries = dates.map(date => `
            (SELECT energy_consumption, DATE_FORMAT(timestamp, '%Y-%m-%d') as date FROM sensordata 
            WHERE timestamp BETWEEN '${format(startOfDay(date), 'yyyy-MM-dd HH:mm:ss')}' AND '${format(endOfDay(date), 'yyyy-MM-dd HH:mm:ss')}'
            ORDER BY timestamp DESC 
            LIMIT 1)
        `).join(' UNION ');

        const sql = `
            SELECT energy_consumption, date 
            FROM (${queries}) as subquery
            ORDER BY date
        `;

        const [rows] = await connection.execute(sql);
        const data = rows.map(row => ({
            date: row.date,
            energy: row.energy_consumption
        }));

        await connection.end();

        res.status(200).json(data);
    } catch (error) {
        console.error("Error fetching energy values:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};


  const realTimeGraph = async (req, res) => {
    const today = new Date();
    const start = format(startOfDay(today), 'yyyy-MM-dd HH:mm:ss');
    const end = format(today, 'yyyy-MM-dd HH:mm:ss'); // Current time
  
    try {
      const connection = await mysql.createConnection(config);
      const [rows] = await connection.query(
        'SELECT * FROM sensordata WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp ASC',
        [start, end]
      );
      await connection.end();
      res.json(rows);
    } catch (error) {
      console.error('Error fetching power data:', error);
      res.status(500).send('Error fetching power data');
    }
  };
  
    const dailyWiseGraph = async (req, res) => {
    const date = req.params.date;
    const start = format(startOfDay(new Date(date)), 'yyyy-MM-dd HH:mm:ss');
    const end = format(endOfDay(new Date(date)), 'yyyy-MM-dd HH:mm:ss');
  
    try {
      const connection = await mysql.createConnection(config);
      const [rows] = await connection.query(
        'SELECT * FROM sensordata WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp ASC',
        [start, end]
      );
      await connection.end();
      res.json(rows);
    } catch (error) {
      console.error('Error fetching power data:', error);
      res.status(500).send('Error fetching power data');
    }
  };


  const prevDayEnergy = async (req, res) => {
    try {
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
  
      let initialEnergyValue = null;
  
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
  
      res.status(200).json({ initialEnergyValue });
    } catch (error) {
      console.error("Error fetching previous day's energy value:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };





module.exports={sensorData,realTimeGraph,dailyWiseGraph,prevDayEnergy,energyConsumption};