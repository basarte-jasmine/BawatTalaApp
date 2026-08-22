const express = require('express');
const {
  getVoiceConfig,
  synthesizeEdgeSpeech,
  transcribeWithGroqWhisper,
} = require('../services/voice.service');

const router = express.Router();

router.post('/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType, filename } = req.body || {};
    if (!audioBase64) {
      return res.status(400).json({ ok: false, message: 'Missing audio data for transcription.' });
    }
    const transcription = await transcribeWithGroqWhisper({
      audioBase64,
      mimeType: mimeType || 'audio/m4a',
      filename: filename || 'recording.m4a',
    });
    return res.json({
      ok: true,
      text: transcription.text,
      language: transcription.language,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error?.message || 'Transcription failed.' });
  }
});

router.post('/speak', async (req, res) => {
  try {
    const { text, voice, rate, pitch } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ ok: false, message: 'Text is required for speech synthesis.' });
    }
    const cleanText = String(text).trim();
    const selected = getVoiceConfig(cleanText, voice);
    const audioBuffer = await synthesizeEdgeSpeech({
      text: cleanText,
      voice,
      rate: rate || '+0%',
      pitch: pitch || '+0Hz',
    });
    const base64Audio = audioBuffer.toString('base64');
    return res.json({
      ok: true,
      audioBase64: base64Audio,
      contentType: 'audio/mp3',
      language: selected.lang,
      voice: selected.voice,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error?.message || 'Speech synthesis failed.' });
  }
});

module.exports = router;
