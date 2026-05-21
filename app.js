// Import required modules
  const express = require("express");
  const { MongoClient } = require("mongodb");
  const bodyParser = require("body-parser");
  const cors = require("cors");
  const { v4: uuidv4 } = require("uuid");
  require("dotenv").config();

  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("Missing MONGODB_URI environment variable.");
  }

  const client = new MongoClient(uri);

  let db;

  // Block API routes unti MongoDB connection is established.
  app.use("/apiforms/api", (req, res, next) => {
    if (!db) {
      return res.status(503).json({
        success: false,
        message: "Database not connected. Start MongoDB and retry.",
      });
    }
    next();
  });

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
  try {
    let data = { ...req.body };

    // ✅ 1. Extract Program_Name from Training_* fields
    let programName = null;

    for (const key in data) {
      if (key.toLowerCase().startsWith("training_")) {
        if (data[key]) {
          programName = data[key]; // take value
        }
        delete data[key]; // ✅ REMOVE Training_* field
      }
    }

    // ✅ 2. Store unified Program_Name (only if exists)
    if (programName) {
      data.Program_Name = programName;
    }

    // ✅ 3. Add timestamp
    data.timestamp = new Date().toISOString();

    // ✅ 4. REMOVE null, undefined, and empty string values
    Object.keys(data).forEach((key) => {
      if (
        data[key] === null ||
        data[key] === undefined ||
        data[key] === ""
      ) {
        delete data[key];
      }
    });

    // ✅ 5. Insert only clean data
    await db.collection("feedback").insertOne(data);

    res.status(200).json({
      success: true,
      message: "Feedback submitted successfully!",
      Program_Name: programName,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/apiforms/api/getFilteredProgramFeedback", async (req, res) => {
  try {
    const {
      college_name,
      program_name,
      batch,
      filterType,
      specificDate,
      fromDate,
      toDate,
      search,
    } = req.query;

    const query = {
      college_name,
      program_name,
    };

    // ✅ DATE FILTERS
    if (filterType === "SpecificDate" && specificDate) {
      const from = new Date(specificDate);
      const to = new Date(specificDate);
      to.setHours(23, 59, 59, 999);
      query.timestamp = { $gte: from.toISOString(), $lte: to.toISOString() };
    }

    if (filterType === "Custom" && fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      query.timestamp = { $gte: from, $lte: to };
    }

    if (filterType === "Today") {
      const today = new Date();
      const start = new Date(today.setHours(0, 0, 0, 0));
      const end = new Date(today.setHours(23, 59, 59, 999));
      query.timestamp = { $gte: start, $lte: end };
    }

    if (filterType === "Yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const start = new Date(y.setHours(0, 0, 0, 0));
      const end = new Date(y.setHours(23, 59, 59, 999));
      query.timestamp = { $gte: start, $lte: end };
    }

    if (filterType === "DayBeforeYesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 2);
      const start = new Date(y.setHours(0, 0, 0, 0));
      const end = new Date(y.setHours(23, 59, 59, 999));
      query.timestamp = { $gte: start, $lte: end };
    }

    // ✅ BATCH FILTER
    if (batch && batch !== "All") {
      query.$or = Object.keys(req.query)
        .filter((key) => key.startsWith("batch_"))
        .map((key) => ({ [key]: batch }));
    }

    // ✅ SEARCH FILTER
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        ...(query.$or || []),
        { content_delivery: regex },
        { improvements: regex },
        { Name: regex },
        { email: regex },
        { phone_number: regex },
      ];
    }

    const data = await db.collection("feedback").find(query).toArray();

    res.status(200).json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});


app.delete("/apiforms/api/deleteFeedbackByCollegeAndProgram", async (req, res) => {
  try {
    const { college_name, program_name } = req.body;

    const result = await db.collection("feedback").deleteMany({
      college_name: college_name,
      Program_Name: program_name,
    });

    res.status(200).json({
      success: true,
      message: "All feedback deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
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
    const data = await db
      .collection("feedback")
      .aggregate([
        {
          $group: {
            _id: "$college_name",
            programs: { $addToSet: "$Program_Name" }
          }
        },
        {
          $project: {
            _id: 0,
            college_name: "$_id",
            programs: 1
          }
        }
      ])
      .toArray();

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get("/apiforms/api/getFeedbackByCollegeAndProgram", async (req, res) => {
  try {
    const { college_name, program_name } = req.query;

    const data = await db.collection("feedback").find({
      college_name,
      Program_Name: program_name,
    }).toArray();

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});


  app.get("/apiforms/api/getFeedbackByCollege", async (req, res) => {
    const { collegeName } = req.params;
    // collegeName = "BIT";
    // log
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

  app.get("/apiforms/api/getProgramsByCollege", async (req, res) => {
  console.log("dskgaekdhkasjdbasj");
  
  // const { collegeName } = req.params;
  let collegeName = "BIT";
  
  try {
    if (!collegeName) {
      return res.status(400).json({
        success: false,
        message: "College name is required."
      });
    }

    const feedbacks = await db
      .collection("feedback")
      .find({ college_name: collegeName })
      .toArray();

    const programSet = new Set();

    feedbacks.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (
          key.toLowerCase().includes("program_name") &&
          item[key] !== null &&
          item[key] !== ""
        ) {
          programSet.add(item[key]);
        }
      });
    });

    const programs = [...programSet];

    console.log(programs);
    

    res.status(200).json({
      success: true,
      college: collegeName,
      programs
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


  // Simple GET route
  app.get("/apiforms/get", async (req, res) => {
    res.status(200).json({ success: true, data: "success" });
  });


  //

  const PORT = 8000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });