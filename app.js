// Import required modules
const express = require("express");
const { MongoClient } = require("mongodb");
const bodyParser = require("body-parser");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const uri =
  "mongodb+srv://bettertomorrowoffi:Better123@better0.ioq5uvm.mongodb.net/portfolio-forms";

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let db;
client
  .connect()
  .then(() => {
    db = client.db("portfolio-forms");
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
  });

app.post("/apiforms/api/messages", async (req, res) => {
  const { collegeName, email, message } = req.body;
  try {
    const newMessage = {
      id: uuidv4(),
      collegeName,
      email,
      message,
    };

    const result = await db.collection("messages").insertOne(newMessage);
    res.send(200);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/apiforms/api/registrations", async (req, res) => {
  const {
    name,
    college_name,
    company_name,
    mail_id,
    phone_number,
    year_of_studies,
    year_of_exp,
    course_duration,
    time_slot,
    course_name,
    role,
  } = req.body;

  try {
    const newRegistration = {
      id: uuidv4(),
      name,
      college_name,
      company_name,
      mail_id,
      phone_number,
      year_of_studies,
      year_of_exp,
      course_duration,
      time_slot,
      course_name,
      role,
    };

    const result = await db
      .collection("registrations")
      .insertOne(newRegistration);
    res.send(200);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/apiforms/api/subscribe", async (req, res) => {
  const { email } = req.body;

  try {
    const newUser = {
      id: uuidv4(),
      email,
    };

    const result = await db.collection("subscribers").insertOne(newUser);
    console.log("Inserted into db");

    res.send(200);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post("/apiforms/api/feedback", async (req, res) => {
  const data = req.body;
  try {
    data.timestamp = new Date().toISOString();

    await db.collection("feedback").insertOne(data);

    res
      .status(200)
      .json({ success: true, message: "Feedback submitted successfully!" });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get("/apiforms/api/getFeedback", async (req, res) => {
  try {
    const feedbacks = await db.collection("feedback").find().toArray();
    console.log(feedbacks);

    res.status(200).json({ success: true, data: feedbacks });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get("/apiforms/api/getCampusNames", async (req, res) => {
  try {
    const campusNames = await db
      .collection("feedback")
      .distinct("college_name");

    res.status(200).json({ success: true, data: campusNames });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get("/apiforms/api/getFeedbackByCollege", async (req, res) => {
  const { collegeName } = req.query;
  try {
    if (!collegeName) {
      return res
        .status(400)
        .json({ success: false, message: "College name is required." });
    }

    const feedbacks = await db
      .collection("feedback")
      .find({ college_name: collegeName })
      .toArray();

    res.status(200).json({ success: true, data: feedbacks });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Simple GET route
app.get("/apiforms/get", async (req, res) => {
  res.status(200).json({ success: true, data: "success" });
});

// Start the server
// const PORT = 8000;
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });
app.listen();