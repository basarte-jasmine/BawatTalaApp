const express = require('express');
const {
  getVoiceConfig,
  synthesizeEdgeSpeech,
  transcribeWithGroqWhisper,
  TranscriptionError,
} = require('../services/voice.service');

const router = express.Router();

function errorPayload(error, fallbackCode, fallbackMessage) {
  return {
    ok: false,
    code: error?.code || fallbackCode,
    message: error?.message || fallbackMessage,
  };
}

router.post('/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType, filename } = req.body || {};
    if (!audioBase64 || !String(audioBase64).trim()) {
      return res.status(400).json({
        ok: false,
        code: 'EMPTY_AUDIO',
        message: 'Missing audio data for transcription.',
      });
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
      model: transcription.model,
    });
  } catch (error) {
    const status = error instanceof TranscriptionError ? error.status : 500;
    return res
      .status(status)
      .json(errorPayload(error, 'TRANSCRIPTION_FAILED', 'Transcription failed.'));
  }
});

router.post('/speak', async (req, res) => {
  try {
    const { text, rate, pitch } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({
        ok: false,
        code: 'TEXT_REQUIRED',
        message: 'Text is required for speech synthesis.',
      });
    }
    // The client cannot choose Muni's voice. Any `voice` in the body is ignored; the server
    // always synthesizes with Blessica Neural.
    const selected = getVoiceConfig();
    const audioBuffer = await synthesizeEdgeSpeech({
      text: String(text).trim(),
      rate: rate || '+0%',
      pitch: pitch || '+0Hz',
    });
    return res.json({
      ok: true,
      audioBase64: audioBuffer.toString('base64'),
      contentType: 'audio/mp3',
      language: selected.lang,
      voice: selected.voice,
    });
  } catch (error) {
    return res
      .status(error?.status || 500)
      .json(errorPayload(error, 'TTS_FAILED', 'Speech synthesis failed.'));
  }
});

module.exports = router;
