import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads folder and database file exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const logsFile = path.join(uploadsDir, "logs.json");
if (!fs.existsSync(logsFile)) {
  fs.writeFileSync(logsFile, JSON.stringify([]));
}
const contactsFile = path.join(uploadsDir, "contacts.json");
if (!fs.existsSync(contactsFile)) {
  fs.writeFileSync(contactsFile, JSON.stringify([]));
}

const app = express();
app.use(cors());
// Set body parser limits to handle Base64 image payloads
app.use(bodyParser.json({ limit: "15mb" }));
app.use(bodyParser.urlencoded({ limit: "15mb", extended: true }));

// Serve static app files and uploaded images
app.use(express.static(__dirname));
app.use("/uploads", express.static(uploadsDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 🔑 Set your Gemini API key in the .env file
const geminiApiKey = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE";
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: "You are an agriculture expert assistant. Help farmers with crops, soil, fertilizers, and weather. You must communicate in Hindi, English, or Hinglish (Hindi written in Roman script) based on the user's input language. Keep responses helpful, simple, and tailored for farmers."
});

// 💡 Local Offline Chatbot Fallback Response Generator
function getOfflineResponse(message) {
  const msg = message.toLowerCase().trim();
  
  if (/hello|hi|hey|pranam|namaste|नमस्ते|प्रणाम/.test(msg)) {
    return "नमस्ते किसान भाई 👋! मैं आपका AI कृषि सलाहकार हूँ। (Offline Mode) आप मुझसे मौसम, मिट्टी, फसलों या खाद के बारे में पूछ सकते हैं।";
  }
  if (/rabi|winter|sardi|ठंड|रबी/.test(msg)) {
    return "रबी (सर्दियों) के सीजन में गेहूं (Wheat), सरसों (Mustard), मटर (Peas) और चना (Gram) उगाना सबसे अच्छा होता है। इसके लिए बुवाई अक्टूबर-नवंबर में की जाती है और तापमान 15°C - 25°C उत्तम रहता है।";
  }
  if (/kharif|monsoon|summer|rain|गर्मी|खरीफ|बारिश/.test(msg)) {
    return "खरीफ (बारिश/गर्मी) के सीजन में धान (Rice), मक्का (Maize), बाजरा (Millet), सोयाबीन और कपास (Cotton) मुख्य फसलें हैं। इनकी बुवाई जून-जुलाई में मानसून आने पर की जाती है।";
  }
  if (/soil|mitti|मिट्टी/.test(msg)) {
    if (/black|kali|काली/.test(msg)) {
      return "काली मिट्टी (Black Soil) नमी सोखने में बहुत अच्छी होती है। यह कपास (Cotton), सोयाबीन, मूंगफली और गेहूं के लिए सर्वोत्तम मानी जाती है। इसमें लोहा और चूना प्रचुर मात्रा में होता है।";
    }
    if (/sandy|retili|रेतीली/.test(msg)) {
      return "रेतीली मिट्टी (Sandy Soil) में पानी जल्दी सूख जाता है। इसमें बाजरा, तरबूज, खरबूजा, ग्वार और मूंगफली जैसी कम पानी वाली फसलें अच्छी होती हैं।";
    }
    return "मिट्टी कई प्रकार की होती है - काली, लाल, दोमट (Loamy), और रेतीली। अपनी मिट्टी के प्रकार के अनुसार ही फसल का चयन करें और हर 2 साल में Soil Testing जरूर करवाएं।";
  }
  if (/fertilizer|khad|urea|npk|खाद|यूरिया/.test(msg)) {
    return "फसलों में रासायनिक खाद (Urea/DAP/NPK) का प्रयोग मिट्टी की जांच के आधार पर ही करें। जैविक खाद (जैसे गोबर खाद, केंचुआ खाद) का अधिक उपयोग मिट्टी की सेहत और उपज को लंबे समय तक सुधारता है।";
  }
  if (/disease|bimar|fungus|pest|बीमारी|कीड़ा/.test(msg)) {
    return "फसल में कीड़ा या फंगस लगने पर तुरंत प्रभावित पत्ते/हिस्से को हटा दें। जैविक बचाव के लिए नीम के तेल (Neem Oil) का 5ml प्रति लीटर पानी में मिलाकर छिड़काव करें।";
  }
  if (/price|market|mandi|bhav|मंडी|भाव|रेट/.test(msg)) {
    return "ताज़ा मंडी भाव जानने के लिए आप हमारे 'Live Mandi Price Info' अनुभाग पर जा सकते हैं, जहाँ दैनिक दरें दिखाई जाती हैं।";
  }
  return "किसान भाई, आपका प्रश्न महत्वपूर्ण है। अभी मेरा सर्वर ऑफ़लाइन मोड में काम कर रहा है। कृपया फसलों, मिट्टी, खाद या मौसम के बारे में सामान्य प्रश्न पूछें या वैध Gemini API Key डालें।";
}

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  try {
    const result = await model.generateContent(userMessage);
    const replyText = result.response.text();
    res.json({ reply: replyText });
  } catch (error) {
    console.error("Gemini API Error (Falling back to Local Assistant):", error.message || error);
    const offlineReply = getOfflineResponse(userMessage);
    res.json({ reply: offlineReply });
  }
});

// 📸 Save crop image uploads and classifications to database
app.post("/api/upload-disease-log", (req, res) => {
  const { imageName, imageBase64, detectedDisease, confidence } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: "Missing image base64 data" });
  }

  try {
    const timestamp = Date.now();
    const cleanImageName = imageName || "crop_image.png";
    const ext = path.extname(cleanImageName) || ".png";
    const filename = `crop_${timestamp}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    // Decode Base64 data to binary buffer
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Write file to uploads directory
    fs.writeFileSync(filePath, buffer);

    // Save metadata entry to local JSON database
    const logs = JSON.parse(fs.readFileSync(logsFile, "utf-8") || "[]");
    const newLog = {
      id: timestamp,
      imageName: cleanImageName,
      imageUrl: `/uploads/${filename}`,
      detectedDisease,
      confidence,
      timestamp: new Date().toISOString(),
    };
    logs.push(newLog);
    fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2));

    res.json({ success: true, log: newLog });
  } catch (err) {
    console.error("Error saving crop image log:", err);
    res.status(500).json({ error: "Could not save uploaded crop image" });
  }
});

// 📊 Retrieve all logged crop image uploads
app.get("/api/disease-logs", (req, res) => {
  try {
    const logs = JSON.parse(fs.readFileSync(logsFile, "utf-8") || "[]");
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Failed to read database logs" });
  }
});

// 📩 Save user support message (Contact form submission)
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Please fill all fields" });
  }
  try {
    const contacts = JSON.parse(fs.readFileSync(contactsFile, "utf-8") || "[]");
    const newContact = {
      id: Date.now(),
      name,
      email,
      message,
      timestamp: new Date().toISOString()
    };
    contacts.push(newContact);
    fs.writeFileSync(contactsFile, JSON.stringify(contacts, null, 2));
    res.json({ success: true, message: "Support message submitted successfully!" });
  } catch (err) {
    res.status(500).json({ error: "Could not save message" });
  }
});

// 📊 Retrieve all logged contact messages
app.get("/api/contacts", (req, res) => {
  try {
    const contacts = JSON.parse(fs.readFileSync(contactsFile, "utf-8") || "[]");
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: "Failed to read contact logs" });
  }
});

// ⚙ Mock retraining endpoint
app.post("/api/retrain", (req, res) => {
  res.json({
    success: true,
    message: "AI model retraining completed successfully! Saved model accuracy improved by +1.4%."
  });
});

app.listen(8000, () => console.log("✅ AI Chat server running on http://localhost:8000"));