/* const mysql = require("mysql2/promise"); */
// Import the MySQL module
const mysql = require('mysql');

// Create a connection to the database
const connection = mysql.createConnection({
  host: '192.168.1.100',    // Database host
  port:'3306',
  user: 'root',// Database username
  password: 'spsolutions', // Database password
  database: 'cems'      // Database name
});

// Connect to the database
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to the database.');
});

// Define the data to insert
const data = { id: '1', person: 'Avinash' }; // Replace with actual column names and values

// Insert data into the table
const query = 'INSERT INTO demo1 SET ?';
connection.query(query, data, (error, results, fields) => {
  if (error) {
    console.error('Error inserting data:', error.stack);
    return;
  }
  console.log('Data inserted successfully, ID:', results.insertId);
});

// Close the database connection
connection.end((err) => {
  if (err) {
    console.error('Error closing the connection:', err.stack);
    return;
  }
  console.log('Database connection closed.');
});
