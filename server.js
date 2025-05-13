const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Parser } = require("json2csv");

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Simple home route
app.get("/", (req, res) => {
  res.send("API is up and running!");
});

// ✅ MongoDB Connection
mongoose
  .connect("mongodb://localhost:27017/thewoods", { dbName: "thewoods" })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB error:", err));

// ✅ User Schema & Model
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
});
const User = mongoose.model("User", userSchema);

// ✅ Order Schema & Model
const orderSchema = new mongoose.Schema({
  name: String,
  phone: String,
  address: String,
  items: [
    {
      name: String,
      price: Number,
    },
  ],
  total: Number,
  paid: { type: Boolean, default: false },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
const Order = mongoose.model("Order", orderSchema);

// ✅ Booking Schema & Model
const bookingSchema = new mongoose.Schema({
  name: String,
  phone: String,
  date: String,
  time: String,
  people: Number,
  requests: String,
  createdAt: { type: Date, default: Date.now }
});
const Booking = mongoose.model("Booking", bookingSchema);

// ✅ Register Route
app.post("/api/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashed, role });
    await newUser.save();

    res.json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// ✅ Login Route
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Incorrect password" });

    const token = jwt.sign({ userId: user._id }, "secret_key", { expiresIn: "1h" });

    res.json({ token, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ✅ Order Checkout Route
app.post("/api/checkout", async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    res.status(201).json({ message: "Order placed successfully!" });
  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// ✅ Dashboard Summary Route
app.get("/api/dashboard", async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $group: { _id: null, sum: { $sum: "$total" } } }
    ]);

    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now - 365 * 24 * 60 * 60 * 1000);

    const weeklySummary = await Order.countDocuments({ createdAt: { $gte: weekAgo } });
    const monthlySummary = await Order.countDocuments({ createdAt: { $gte: monthAgo } });
    const yearlySummary = await Order.countDocuments({ createdAt: { $gte: yearAgo } });

    res.json({
      totalOrders,
      totalRevenue: totalRevenue[0]?.sum || 0,
      weeklySummary,
      monthlySummary,
      yearlySummary,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});

// ✅ Table Booking Route
app.post("/api/booktable", async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();
    res.status(201).json({ message: "Table booked successfully!" });
  } catch (error) {
    console.error("Booking error:", error);
    res.status(500).json({ error: "Failed to book table" });
  }
});

// ✅ Payment Confirmation Route
app.post("/api/payment-confirm", async (req, res) => {
  const { phone } = req.body;
  try {
    const order = await Order.findOne({ phone }).sort({ createdAt: -1 });
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.paid = true;
    await order.save();

    res.json({ message: "Payment confirmed!" });
  } catch (error) {
    res.status(500).json({ error: "Error confirming payment" });
  }
});

// ✅ Order History Route
app.get("/api/orders", async (req, res) => {
  const { phone } = req.query;
  try {
    const orders = await Order.find({ phone });
    res.json(orders);
  } catch (err) {
    console.error("Failed to fetch orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ✅ Export Orders as CSV
app.get("/api/export-orders", async (req, res) => {
  try {
    const orders = await Order.find();
    const fields = ['name', 'phone', 'address', 'total', 'createdAt'];
    const parser = new Parser({ fields });
    const csv = parser.parse(orders);

    res.header("Content-Type", "text/csv");
    res.attachment("orders.csv");
    return res.send(csv);
  } catch (err) {
    console.error("Error exporting orders:", err);
    res.status(500).json({ error: "Error exporting orders" });
  }
});

// ✅ Start server on port 3001
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
