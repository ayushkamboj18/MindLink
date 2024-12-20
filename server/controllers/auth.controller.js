const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const JWT_SECRET = process.env.JWT_SECRET;
const { OAuth2Client } = require("google-auth-library");
const Id = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(Id);


const signup = async (req, res) => {
  const { name:username, email, password } = req.body;

  try {
    if(!username || !email || !password) return res.status(400).json({ error: "Please fill in all fields" });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });

    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error during signup" });
  }
};

const signin = async (req, res) => {
  const { email, password } = req.body;

  try {
    if(!email || !password) return res.status(400).json({ error: "Please fill in all fields" });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(404).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, {
      expiresIn: "2h",
    });

    const userData = user.toObject();
    delete userData.password;
    
    res.status(200).json({ token,id: user._id, username: user.username,profileUpdated: user.profileUpdated });
  } catch (err) {
    res.status(500).json({ error: "Server error during login" });
  }
};

const verify = async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1]; 

  if (!token) {
    return res.status(401).json({ message: "Token required" });
  }

  jwt.verify(token,JWT_SECRET, async (err, existingUser) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await User.findById(existingUser.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    return res.json({ valid: true, id: user._id, username: user.username,profileUpdated: user.profileUpdated });
  });
};

const googleSign = async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: Id,
    });
    
    const payload = ticket.getPayload();
    const { email, name } = payload;
    const pass = await bcrypt.hash(name, 10);

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        username: name,
        password: pass,
      });
    }

    res.status(200).json({ email,password: name });
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: "Invalid User sign in" });
  }
};

module.exports = { signup, signin, verify, googleSign };