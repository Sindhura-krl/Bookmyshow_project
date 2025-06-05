const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const redis = require('redis');

const app = express();
app.use(cors());
app.use(express.json());

const {
  DB_HOST,
  DB_USER,
  DB_PASS,
  DB_NAME,
  REDIS_HOST,
  REDIS_PORT
} = process.env;

let pool;
let redisClient;

async function initDb() {
  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

async function initRedis() {
  redisClient = redis.createClient({
    socket: {
      host: REDIS_HOST,
      port: REDIS_PORT ? Number(REDIS_PORT) : 6379,
    }
  });
  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  await redisClient.connect();
}

(async () => {
  try {
    await initDb();
    await initRedis();
    console.log('DB and Redis connected');
  } catch (err) {
    console.error('Initialization failed:', err);
    process.exit(1);
  }
})();

// Get all events with Redis caching
app.get('/api/events', async (req, res) => {
  try {
    const cachedEvents = await redisClient.get('events');
    if (cachedEvents) {
      console.log('Serving events from Redis cache');
      return res.json(JSON.parse(cachedEvents));
    }

    const [rows] = await pool.query('SELECT * FROM events ORDER BY date ASC');

    // Cache events for 60 seconds
    await redisClient.setEx('events', 60, JSON.stringify(rows));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching events' });
  }
});

// Book a ticket (writes go to MySQL and invalidate cache)
app.post('/api/book', async (req, res) => {
  const { eventId, userName } = req.body;
  if (!eventId || !userName) {
    return res.status(400).json({ message: 'Missing eventId or userName' });
  }

  try {
    const [events] = await pool.query('SELECT * FROM events WHERE id = ?', [eventId]);
    if (events.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    await pool.query('INSERT INTO bookings (event_id, user_name) VALUES (?, ?)', [eventId, userName]);

    // Invalidate events cache (optional, depending on if bookings affect event data)
    await redisClient.del('events');

    res.json({ message: `Ticket booked for ${userName} to ${events[0].title}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Booking failed' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
