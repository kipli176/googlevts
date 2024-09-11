// app.js

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Konfigurasi Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Konfigurasi Google Cloud Text-to-Speech
const ttsClient = new textToSpeech.TextToSpeechClient();
app.use(cors());
app.use((req, res, next) => {
  if (req.url.includes('output.mp3')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});
app.use(express.static('public'));

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    // Baca file gambar
    const imageFile = await fs.promises.readFile(req.file.path);
    const imageBase64 = imageFile.toString('base64');

    // Gunakan Google Generative AI untuk menerjemahkan gambar
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([
      "Please describe the image detail in Indonesian language. Include key visual elements such as colors, shapes, textures, and any notable objects or people in the scene. Mention the emotions conveyed, the setting or background, and any significant interactions or actions occurring in the image. Also, describe the mood or atmosphere created by the lighting and composition of the image. Be as descriptive as possible so I can visualize the scene accurately.",
      {
        inlineData: {
          data: imageBase64,
          mimeType: req.file.mimetype
        }
      }
    ]);

    const text = result.response.text();

    // Konversi teks ke suara menggunakan Text-to-Speech API
    const [response] = await ttsClient.synthesizeSpeech({
      input: { text: text },
      voice: { languageCode: 'id-ID', ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'MP3' },
    });

    // Simpan file audio
    const writeFile = util.promisify(fs.writeFile);
    await writeFile('public/output.mp3', response.audioContent, 'binary');

    // Hapus file upload setelah diproses
    await fs.promises.unlink(req.file.path);

    res.json({ text: text, audioUrl: `/output.mp3?t=${timestamp}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan saat memproses gambar' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));